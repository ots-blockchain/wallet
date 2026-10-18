const mysql = require('mysql2/promise');
const { HttpError, hashPin, comparePin } = require('./walletSecurity');

const MAX_PIN_ATTEMPTS = Number(process.env.WALLET_MAX_PIN_ATTEMPTS || 5);
const BASE_LOCKOUT_SECONDS = Number(process.env.WALLET_LOCKOUT_SECONDS || 30);

class WalletStore {
    constructor() {
        this.pool = process.env.MYSQL_URL ? mysql.createPool(process.env.MYSQL_URL) : null;
    }

    async init() {
        if (!this.pool) throw new Error('MYSQL_URL is required');
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS wallet_users (
                telegram_user_id VARCHAR(32) PRIMARY KEY,
                pin_hash VARCHAR(255) NULL,
                failed_pin_attempts INT UNSIGNED NOT NULL DEFAULT 0,
                pin_locked_until DATETIME(3) NULL,
                created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS wallets (
                id CHAR(36) PRIMARY KEY,
                telegram_user_id VARCHAR(32) NOT NULL,
                name VARCHAR(80) NOT NULL,
                address VARCHAR(128) NOT NULL,
                public_key VARCHAR(130) NOT NULL,
                position INT UNSIGNED NOT NULL DEFAULT 0,
                secret_ciphertext MEDIUMTEXT NOT NULL,
                secret_iv VARCHAR(32) NOT NULL,
                secret_auth_tag VARCHAR(32) NOT NULL,
                key_version INT UNSIGNED NOT NULL DEFAULT 1,
                created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
                UNIQUE KEY uq_wallet_owner_address (telegram_user_id, address),
                INDEX idx_wallet_owner_position (telegram_user_id, position),
                CONSTRAINT fk_wallet_owner FOREIGN KEY (telegram_user_id)
                    REFERENCES wallet_users(telegram_user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    async ensureUser(telegramUserId) {
        await this.pool.execute(
            'INSERT IGNORE INTO wallet_users (telegram_user_id) VALUES (?)',
            [telegramUserId]
        );
        return this.getUser(telegramUserId);
    }

    async getUser(telegramUserId) {
        const [rows] = await this.pool.execute(
            'SELECT * FROM wallet_users WHERE telegram_user_id = ? LIMIT 1',
            [telegramUserId]
        );
        return rows[0] || null;
    }

    async setupPin(telegramUserId, pin) {
        const user = await this.ensureUser(telegramUserId);
        if (user.pin_hash) throw new HttpError(409, 'PIN is already configured', 'pin_already_configured');
        const pinHash = await hashPin(pin);
        await this.pool.execute(
            'UPDATE wallet_users SET pin_hash = ?, failed_pin_attempts = 0, pin_locked_until = NULL WHERE telegram_user_id = ?',
            [pinHash, telegramUserId]
        );
    }

    async verifyPin(telegramUserId, pin) {
        const user = await this.getUser(telegramUserId);
        if (!user?.pin_hash) throw new HttpError(409, 'PIN is not configured', 'pin_not_configured');
        const lockedUntil = user.pin_locked_until ? new Date(user.pin_locked_until).getTime() : 0;
        if (lockedUntil > Date.now()) {
            const retryAfter = Math.ceil((lockedUntil - Date.now()) / 1000);
            throw new HttpError(429, `PIN is locked. Retry in ${retryAfter}s`, 'pin_locked');
        }

        const valid = await comparePin(user.pin_hash, pin).catch(() => false);
        if (valid) {
            await this.pool.execute(
                'UPDATE wallet_users SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE telegram_user_id = ?',
                [telegramUserId]
            );
            return true;
        }

        const attempts = Number(user.failed_pin_attempts || 0) + 1;
        const lockSeconds = attempts >= MAX_PIN_ATTEMPTS
            ? Math.min(BASE_LOCKOUT_SECONDS * (2 ** (attempts - MAX_PIN_ATTEMPTS)), 15 * 60)
            : 0;
        await this.pool.execute(
            'UPDATE wallet_users SET failed_pin_attempts = ?, pin_locked_until = ? WHERE telegram_user_id = ?',
            [attempts, lockSeconds ? new Date(Date.now() + lockSeconds * 1000) : null, telegramUserId]
        );
        throw new HttpError(lockSeconds ? 429 : 401, 'Incorrect PIN', lockSeconds ? 'pin_locked' : 'incorrect_pin');
    }

    async changePin(telegramUserId, currentPin, nextPin) {
        await this.verifyPin(telegramUserId, currentPin);
        const pinHash = await hashPin(nextPin);
        await this.pool.execute(
            'UPDATE wallet_users SET pin_hash = ?, failed_pin_attempts = 0, pin_locked_until = NULL WHERE telegram_user_id = ?',
            [pinHash, telegramUserId]
        );
    }

    async resetVault(telegramUserId) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('DELETE FROM wallets WHERE telegram_user_id = ?', [telegramUserId]);
            await connection.execute(
                'UPDATE wallet_users SET pin_hash = NULL, failed_pin_attempts = 0, pin_locked_until = NULL WHERE telegram_user_id = ?',
                [telegramUserId]
            );
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async listWallets(telegramUserId) {
        const [rows] = await this.pool.execute(
            `SELECT id, name, address, public_key AS publicKey, position, created_at AS createdAt
             FROM wallets WHERE telegram_user_id = ? ORDER BY position, created_at`,
            [telegramUserId]
        );
        return rows;
    }

    async getWallet(telegramUserId, walletId, includeSecret = false) {
        const columns = includeSecret ? '*' : 'id, name, address, public_key, position';
        const [rows] = await this.pool.execute(
            `SELECT ${columns} FROM wallets WHERE id = ? AND telegram_user_id = ? LIMIT 1`,
            [walletId, telegramUserId]
        );
        if (!rows[0]) throw new HttpError(404, 'Wallet not found', 'wallet_not_found');
        return rows[0];
    }

    async createWallet(record) {
        const [positionRows] = await this.pool.execute(
            'SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition FROM wallets WHERE telegram_user_id = ?',
            [record.telegramUserId]
        );
        await this.pool.execute(
            `INSERT INTO wallets
             (id, telegram_user_id, name, address, public_key, position, secret_ciphertext, secret_iv, secret_auth_tag, key_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [record.id, record.telegramUserId, record.name, record.address, record.publicKey,
                Number(positionRows[0].nextPosition), record.ciphertext, record.iv, record.authTag, record.keyVersion]
        );
        return this.getWallet(record.telegramUserId, record.id);
    }

    async renameWallet(telegramUserId, walletId, name) {
        const [result] = await this.pool.execute(
            'UPDATE wallets SET name = ? WHERE id = ? AND telegram_user_id = ?',
            [name, walletId, telegramUserId]
        );
        if (!result.affectedRows) throw new HttpError(404, 'Wallet not found', 'wallet_not_found');
    }

    async deleteWallet(telegramUserId, walletId) {
        const [result] = await this.pool.execute(
            'DELETE FROM wallets WHERE id = ? AND telegram_user_id = ?',
            [walletId, telegramUserId]
        );
        if (!result.affectedRows) throw new HttpError(404, 'Wallet not found', 'wallet_not_found');
    }

    async reorderWallets(telegramUserId, walletIds) {
        const existing = await this.listWallets(telegramUserId);
        const existingIds = new Set(existing.map(wallet => wallet.id));
        if (walletIds.length !== existingIds.size || walletIds.some(id => !existingIds.has(id))) {
            throw new HttpError(400, 'Wallet order must include every owned wallet exactly once', 'invalid_wallet_order');
        }
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            for (let position = 0; position < walletIds.length; position += 1) {
                await connection.execute(
                    'UPDATE wallets SET position = ? WHERE id = ? AND telegram_user_id = ?',
                    [position, walletIds[position], telegramUserId]
                );
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = WalletStore;
