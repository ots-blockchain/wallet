const crypto = require('crypto');
const WalletStore = require('./walletStore');
const {
    HttpError,
    validateTelegramInitData,
    issueSessionToken,
    authenticateJwt,
    rejectClientUserId,
    validatePin,
    encryptWalletSecret,
    decryptWalletSecret
} = require('./walletSecurity');

let walletLibraryPromise;
const walletTransactionQueues = new Map();
function getWalletLibrary() {
    walletLibraryPromise ||= Promise.all([
        import('@otsblockchain/lib/crypto').then(module => module.default),
        import('@otsblockchain/lib/models').then(module => module.Transaction)
    ]).then(([CryptoUtils, Transaction]) => ({ CryptoUtils, Transaction }));
    return walletLibraryPromise;
}

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function normalizeName(value) {
    const name = String(value || '').trim();
    if (!name || name.length > 80) throw new HttpError(400, 'Wallet name must be between 1 and 80 characters', 'invalid_wallet_name');
    return name;
}

function toNanoOts(value) {
    const raw = String(value ?? '0').trim();
    if (!/^\d+(\.\d{0,9})?$/.test(raw)) throw new HttpError(400, 'Invalid OTS amount', 'invalid_amount');
    const [whole, fraction = ''] = raw.split('.');
    return BigInt(`${whole}${fraction.padEnd(9, '0')}`);
}

function parseNano(value) {
    const raw = String(value ?? '0');
    if (!/^\d+$/.test(raw)) throw new HttpError(400, 'Invalid nanoOTS amount', 'invalid_amount');
    return BigInt(raw);
}

async function withWalletTransactionLock(walletId, operation) {
    const previous = walletTransactionQueues.get(walletId) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    walletTransactionQueues.set(walletId, current);
    try {
        return await current;
    } finally {
        if (walletTransactionQueues.get(walletId) === current) walletTransactionQueues.delete(walletId);
    }
}

function publicWallet(row) {
    return {
        id: row.id,
        name: row.name,
        address: row.address,
        publicKey: row.publicKey || row.public_key,
        position: Number(row.position || 0),
        createdAt: row.createdAt || row.created_at
    };
}

const defaultNodeApiUrl = (process.env.NODE_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function nodeApiRequest(nodeApiUrl, path, options = {}) {
    let response;
    try {
        response = await fetch(`${nodeApiUrl}${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });
    } catch (_error) {
        throw new HttpError(502, 'Node API is unavailable', 'node_api_unavailable');
    }

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new HttpError(response.status >= 500 ? 502 : response.status,
            payload.error || 'Node API rejected the request', payload.code || 'node_api_error');
    }
    return response.json();
}

async function getNodeAccount(nodeApiUrl, address) {
    return nodeApiRequest(nodeApiUrl, `/api/account/${encodeURIComponent(address)}`);
}

async function getNodeHistory(nodeApiUrl, address, limit) {
    const payload = await nodeApiRequest(nodeApiUrl,
        `/api/address/${encodeURIComponent(address)}?historyLimit=${limit}`);
    if (!Array.isArray(payload.history)) {
        throw new HttpError(502, 'Node API returned invalid transaction history', 'node_api_invalid_response');
    }
    return payload.history;
}

function formatTx(tx) {
    return {
        hash: tx.hash || tx.signature || (typeof tx.getHash === 'function' ? tx.getHash() : ''),
        signature: tx.signature || tx.hash || '',
        type: tx.type,
        from: tx.from || tx.sender,
        to: tx.to || tx.receiver || null,
        amount: String(tx.amount || 0),
        data: tx.data || '',
        nonce: Number(tx.nonce || 0),
        timestamp: Number(tx.timestamp || Date.now()),
        blockIndex: tx.blockIndex === undefined ? null : Number(tx.blockIndex),
        fee: String(tx.fee || 0),
        gasLimit: tx.gasLimit === undefined || tx.gasLimit === null ? undefined : String(tx.gasLimit),
        valid: tx.valid === undefined ? true : Boolean(tx.valid)
    };
}

function registerWalletApi(app, { nodeApiUrl = defaultNodeApiUrl } = {}, { store = new WalletStore() } = {}) {
    const ready = store.init();

    app.post('/auth/telegram', rejectClientUserId, asyncRoute(async (req, res) => {
        await ready;
        const telegramUser = validateTelegramInitData(req.body?.initData);
        const user = await store.ensureUser(telegramUser.id);
        const wallets = await store.listWallets(telegramUser.id);
        res.json({
            token: issueSessionToken(telegramUser.id),
            expiresInSeconds: 900,
            hasPin: Boolean(user.pin_hash),
            hasWallets: wallets.length > 0,
            user: {
                id: telegramUser.id,
                firstName: telegramUser.first_name || '',
                username: telegramUser.username || ''
            }
        });
    }));

    app.use('/api/wallet', authenticateJwt, rejectClientUserId);

    app.get('/api/wallet/bootstrap', asyncRoute(async (req, res) => {
        await ready;
        const user = await store.ensureUser(req.telegramUserId);
        const wallets = await store.listWallets(req.telegramUserId);
        res.json({ hasPin: Boolean(user.pin_hash), wallets: wallets.map(publicWallet) });
    }));

    app.post('/api/wallet/pin', asyncRoute(async (req, res) => {
        await ready;
        await store.setupPin(req.telegramUserId, req.body?.pin);
        res.status(201).json({ ok: true });
    }));

    app.post('/api/wallet/pin/verify', asyncRoute(async (req, res) => {
        await ready;
        await store.verifyPin(req.telegramUserId, req.body?.pin);
        res.json({ ok: true });
    }));

    app.put('/api/wallet/pin', asyncRoute(async (req, res) => {
        await ready;
        await store.changePin(req.telegramUserId, req.body?.currentPin, req.body?.newPin);
        res.json({ ok: true });
    }));

    app.delete('/api/wallet/vault', asyncRoute(async (req, res) => {
        await ready;
        await store.verifyPin(req.telegramUserId, req.body?.pin);
        await store.resetVault(req.telegramUserId);
        res.json({ ok: true });
    }));

    app.get('/api/wallet/wallets', asyncRoute(async (req, res) => {
        await ready;
        const wallets = await store.listWallets(req.telegramUserId);
        res.json({ wallets: wallets.map(publicWallet) });
    }));

    app.post('/api/wallet/wallets', asyncRoute(async (req, res) => {
        await ready;
        await store.verifyPin(req.telegramUserId, req.body?.pin);
        const name = normalizeName(req.body?.name);
        const mnemonic = typeof req.body?.mnemonic === 'string' ? req.body.mnemonic.trim() : '';
        const suppliedPrivateKey = typeof req.body?.privateKey === 'string' ? req.body.privateKey.trim() : '';
        if (!mnemonic && !suppliedPrivateKey) {
            throw new HttpError(400, 'Mnemonic or private key is required', 'wallet_secret_required');
        }

        const { CryptoUtils: WalletCrypto } = await getWalletLibrary();
        const privateKey = mnemonic ? WalletCrypto.mnemonicToPrivateKey(mnemonic) : suppliedPrivateKey;
        if (!/^[a-f0-9]{64}$/i.test(privateKey)) throw new HttpError(400, 'Invalid private key', 'invalid_private_key');
        const publicKey = WalletCrypto.getPublicKey(privateKey);
        const address = WalletCrypto.publicKeyToBase58(publicKey);
        const encrypted = encryptWalletSecret({ privateKey, mnemonic: mnemonic || null });

        try {
            const row = await store.createWallet({
                id: crypto.randomUUID(), telegramUserId: req.telegramUserId, name, address, publicKey, ...encrypted
            });
            res.status(201).json({ wallet: publicWallet(row) });
        } catch (error) {
            if (error?.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Wallet already added', 'wallet_exists');
            throw error;
        }
    }));

    app.patch('/api/wallet/wallets/:walletId', asyncRoute(async (req, res) => {
        await ready;
        await store.verifyPin(req.telegramUserId, req.body?.pin);
        await store.renameWallet(req.telegramUserId, req.params.walletId, normalizeName(req.body?.name));
        res.json({ ok: true });
    }));

    app.delete('/api/wallet/wallets/:walletId', asyncRoute(async (req, res) => {
        await ready;
        await store.verifyPin(req.telegramUserId, req.body?.pin);
        await store.deleteWallet(req.telegramUserId, req.params.walletId);
        res.json({ ok: true });
    }));

    app.put('/api/wallet/wallets-order', asyncRoute(async (req, res) => {
        await ready;
        await store.verifyPin(req.telegramUserId, req.body?.pin);
        const walletIds = Array.isArray(req.body?.walletIds) ? req.body.walletIds.map(String) : [];
        await store.reorderWallets(req.telegramUserId, walletIds);
        res.json({ ok: true });
    }));

    app.get('/api/wallet/wallets/:walletId/account', asyncRoute(async (req, res) => {
        await ready;
        const wallet = await store.getWallet(req.telegramUserId, req.params.walletId);
        const account = await getNodeAccount(nodeApiUrl, wallet.public_key);
        res.json({
            balance: String(account.balance || 0),
            stake: String(account.stake || 0),
            nonce: Number(account.nonce || 0),
            unbonding: account.unbonding || [],
            currentBlockIndex: Number(account.currentBlockIndex || 0),
            code: account.code || null,
            storage: account.storage || {}
        });
    }));

    app.get('/api/wallet/wallets/:walletId/history', asyncRoute(async (req, res) => {
        await ready;
        const wallet = await store.getWallet(req.telegramUserId, req.params.walletId);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
        const history = await getNodeHistory(nodeApiUrl, wallet.public_key, limit);
        res.json({ history: history.map(formatTx) });
    }));

    app.post('/api/wallet/wallets/:walletId/transactions', asyncRoute(async (req, res) => {
        await ready;
        await store.verifyPin(req.telegramUserId, req.body?.pin);
        const wallet = await store.getWallet(req.telegramUserId, req.params.walletId, true);
        const type = String(req.body?.type || '');
        if (!['transfer', 'stake', 'unstake', 'deploy', 'call'].includes(type)) {
            throw new HttpError(400, 'Unsupported transaction type', 'invalid_transaction_type');
        }

        const amount = req.body?.amountNano !== undefined
            ? parseNano(req.body.amountNano)
            : toNanoOts(req.body?.amountOts || '0');
        const gasLimit = req.body?.gasLimitNano !== undefined
            ? parseNano(req.body.gasLimitNano)
            : toNanoOts(req.body?.gasLimitOts || '0');
        if (amount < 0n || gasLimit < 0n) throw new HttpError(400, 'Amounts cannot be negative', 'invalid_amount');
        const { CryptoUtils: WalletCrypto, Transaction } = await getWalletLibrary();
        let data = req.body?.data ?? '';
        if (type === 'deploy' && typeof data !== 'string') data = WalletCrypto.serializeWithBigInt(data);
        data = String(data);
        if (data.length > 256000) throw new HttpError(413, 'Transaction data is too large', 'transaction_data_too_large');

        const tx = await withWalletTransactionLock(wallet.id, async () => {
            const secret = decryptWalletSecret(wallet);
            let to = req.body?.to ? String(req.body.to).trim() : null;
            try {
                if (type === 'transfer' || type === 'stake') {
                    to = to || wallet.address;
                    to = to.length === 66 || to.length === 130 ? to : WalletCrypto.base58ToPublicKey(to);
                } else if (type === 'unstake') {
                    to = wallet.public_key;
                } else if (type === 'call' && !WalletCrypto.isValidAddress(to)) {
                    throw new Error('Invalid contract address');
                }
            } catch (error) {
                throw new HttpError(400, error.message || 'Invalid destination address', 'invalid_address');
            }

            const account = await getNodeAccount(nodeApiUrl, wallet.public_key);
            const nonce = Number(account.nextNonce ?? account.nonce ?? 0);
            const signed = new Transaction({ type, from: wallet.public_key, to, amount, data, nonce, gasLimit });
            signed.sign(secret.privateKey);
            await nodeApiRequest(nodeApiUrl, '/api/transactions', {
                method: 'POST',
                body: JSON.stringify({ transaction: signed.serialize() })
            });
            return signed;
        });
        res.status(202).json({ ok: true, hash: tx.getHash(), transaction: formatTx(tx) });
    }));

    return { store, ready };
}

module.exports = { registerWalletApi };
