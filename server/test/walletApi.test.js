const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TELEGRAM_BOT_TOKEN = '123456:test-token';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough';
process.env.VAULT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const { registerWalletApi } = require('../walletApi');
const { encryptWalletSecret } = require('../walletSecurity');

function createApp() {
    const routes = new Map();
    const app = {};
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'use']) {
        app[method] = (path, ...handlers) => {
            routes.set(`${method.toUpperCase()} ${path}`, handlers.at(-1));
            return app;
        };
    }
    return { app, routes };
}

test('vault reset verifies the current PIN before deleting data', async () => {
    const calls = [];
    const store = {
        init: async () => {},
        verifyPin: async (_userId, pin) => {
            calls.push(['verifyPin', pin]);
            if (pin !== '2468') throw Object.assign(new Error('Incorrect PIN'), { status: 401, code: 'incorrect_pin' });
        },
        resetVault: async userId => calls.push(['resetVault', userId])
    };
    const { app, routes } = createApp();
    registerWalletApi(app, {}, { store });
    const reset = routes.get('DELETE /api/wallet/vault');

    let error;
    await reset({ telegramUserId: '42', body: {} }, { json: () => assert.fail('reset must not succeed') }, value => { error = value; });
    assert.equal(error?.code, 'incorrect_pin');
    assert.deepEqual(calls, [['verifyPin', undefined]]);

    let response;
    await reset({ telegramUserId: '42', body: { pin: '2468' } }, { json: value => { response = value; } }, value => assert.fail(value));
    assert.deepEqual(response, { ok: true });
    assert.deepEqual(calls, [['verifyPin', undefined], ['verifyPin', '2468'], ['resetVault', '42']]);
});

test('account data is read from node/api over HTTP', async () => {
    const store = {
        init: async () => {},
        getWallet: async () => ({ public_key: 'public-key' })
    };
    const { app, routes } = createApp();
    registerWalletApi(app, { nodeApiUrl: 'http://node.test' }, { store });

    const originalFetch = global.fetch;
    global.fetch = async url => {
        assert.equal(url, 'http://node.test/api/account/public-key');
        return {
            ok: true,
            status: 200,
            json: async () => ({ balance: '12', stake: '3', nonce: 4, currentBlockIndex: 9, history: [] })
        };
    };

    try {
        let response;
        await routes.get('GET /api/wallet/wallets/:walletId/account')(
            { telegramUserId: '42', params: { walletId: 'wallet-id' } },
            { json: value => { response = value; } },
            error => assert.fail(error)
        );
        assert.deepEqual(response, {
            balance: '12', stake: '3', nonce: 4, unbonding: [], currentBlockIndex: 9,
            code: null, storage: {}
        });
    } finally {
        global.fetch = originalFetch;
    }
});

test('signed transactions are submitted to node/api over HTTP', async () => {
    const WalletCrypto = (await import('@otsblockchain/lib/crypto')).default;
    const privateKey = '1'.padStart(64, '0');
    const publicKey = WalletCrypto.getPublicKey(privateKey);
    const encrypted = encryptWalletSecret({ privateKey, mnemonic: null });
    const store = {
        init: async () => {},
        verifyPin: async () => {},
        getWallet: async () => ({
            id: 'wallet-id', address: WalletCrypto.publicKeyToBase58(publicKey), public_key: publicKey,
            secret_ciphertext: encrypted.ciphertext, secret_iv: encrypted.iv,
            secret_auth_tag: encrypted.authTag
        })
    };
    const { app, routes } = createApp();
    registerWalletApi(app, { nodeApiUrl: 'http://node.test' }, { store });

    const requests = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        requests.push({ url, options });
        if (options?.method === 'POST') {
            return { ok: true, status: 202, json: async () => ({ ok: true }) };
        }
        return { ok: true, status: 200, json: async () => ({ nonce: 5, nextNonce: 6, history: [] }) };
    };

    try {
        let response;
        await routes.get('POST /api/wallet/wallets/:walletId/transactions')(
            {
                telegramUserId: '42', params: { walletId: 'wallet-id' },
                body: { pin: '2468', type: 'unstake', amountOts: '1' }
            },
            { status: status => ({ json: value => { response = { status, value }; } }) },
            error => assert.fail(error)
        );
        assert.equal(requests.length, 2);
        assert.equal(requests[0].url, `http://node.test/api/account/${publicKey}`);
        assert.equal(requests[1].url, 'http://node.test/api/transactions');
        assert.equal(requests[1].options.method, 'POST');
        assert.equal(response.status, 202);
        assert.equal(response.value.transaction.nonce, 6);
        assert.ok(JSON.parse(requests[1].options.body).transaction);
    } finally {
        global.fetch = originalFetch;
    }
});
