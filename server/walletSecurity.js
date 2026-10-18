const crypto = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

const MAX_INIT_DATA_AGE_SECONDS = Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE || 3600);
const JWT_TTL = process.env.WALLET_JWT_TTL || '15m';

class HttpError extends Error {
    constructor(status, message, code = 'request_failed') {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function requireSecret(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
}

function validateTelegramInitData(initData) {
    if (typeof initData !== 'string' || !initData) {
        throw new HttpError(401, 'Telegram initData is required', 'telegram_auth_required');
    }

    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
        throw new HttpError(401, 'Invalid Telegram initData hash', 'invalid_telegram_auth');
    }

    params.delete('hash');
    const dataCheckString = [...params.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    const botToken = requireSecret('TELEGRAM_BOT_TOKEN');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
    const receivedHashBuffer = Buffer.from(receivedHash, 'hex');
    if (receivedHashBuffer.length !== expectedHash.length || !crypto.timingSafeEqual(receivedHashBuffer, expectedHash)) {
        throw new HttpError(401, 'Invalid Telegram initData signature', 'invalid_telegram_auth');
    }

    const authDate = Number(params.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(authDate) || authDate <= 0 || now - authDate > MAX_INIT_DATA_AGE_SECONDS || authDate > now + 30) {
        throw new HttpError(401, 'Telegram initData has expired', 'telegram_auth_expired');
    }

    let user;
    try {
        user = JSON.parse(params.get('user') || 'null');
    } catch {
        throw new HttpError(401, 'Invalid Telegram user payload', 'invalid_telegram_auth');
    }
    if (!user || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) {
        throw new HttpError(401, 'Telegram user is missing', 'invalid_telegram_auth');
    }

    return { ...user, id: String(user.id) };
}

function issueSessionToken(telegramUserId) {
    return jwt.sign(
        { sub: String(telegramUserId), aud: 'ots-wallet', iss: 'ots-api' },
        requireSecret('JWT_SECRET'),
        { expiresIn: JWT_TTL, algorithm: 'HS256' }
    );
}

function authenticateJwt(req, _res, next) {
    try {
        const authorization = req.headers.authorization || '';
        if (!authorization.startsWith('Bearer ')) {
            throw new HttpError(401, 'Bearer token is required', 'session_required');
        }
        const payload = jwt.verify(authorization.slice(7), requireSecret('JWT_SECRET'), {
            algorithms: ['HS256'], audience: 'ots-wallet', issuer: 'ots-api'
        });
        if (!payload.sub) throw new HttpError(401, 'Invalid session', 'invalid_session');
        req.telegramUserId = String(payload.sub);
        next();
    } catch (error) {
        next(error instanceof HttpError ? error : new HttpError(401, 'Invalid or expired session', 'invalid_session'));
    }
}

function rejectClientUserId(req, _res, next) {
    const body = req.body || {};
    if ('user_id' in body || 'userId' in body || 'telegram_user_id' in body || 'telegramUserId' in body) {
        return next(new HttpError(400, 'Client supplied user identifiers are not accepted', 'client_user_id_rejected'));
    }
    next();
}

function validatePin(pin) {
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
        throw new HttpError(400, 'PIN must contain exactly four digits', 'invalid_pin_format');
    }
    return pin;
}

async function hashPin(pin) {
    return argon2.hash(validatePin(pin), {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 3,
        parallelism: 1
    });
}

async function comparePin(hash, pin) {
    validatePin(pin);
    return argon2.verify(hash, pin, { type: argon2.argon2id });
}

function getVaultKey() {
    const encoded = requireSecret('VAULT_ENCRYPTION_KEY');
    const key = /^[a-f0-9]{64}$/i.test(encoded) ? Buffer.from(encoded, 'hex') : Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new Error('VAULT_ENCRYPTION_KEY must decode to exactly 32 bytes');
    return key;
}

function encryptWalletSecret(secret) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getVaultKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(secret), 'utf8'), cipher.final()]);
    return {
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        keyVersion: 1
    };
}

function decryptWalletSecret(record) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getVaultKey(), Buffer.from(record.secret_iv, 'base64'));
    decipher.setAuthTag(Buffer.from(record.secret_auth_tag, 'base64'));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(record.secret_ciphertext, 'base64')),
        decipher.final()
    ]).toString('utf8');
    return JSON.parse(plaintext);
}

module.exports = {
    HttpError,
    validateTelegramInitData,
    issueSessionToken,
    authenticateJwt,
    rejectClientUserId,
    validatePin,
    hashPin,
    comparePin,
    encryptWalletSecret,
    decryptWalletSecret
};
