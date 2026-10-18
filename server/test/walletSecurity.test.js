const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.TELEGRAM_BOT_TOKEN = '123456:test-token';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough';
process.env.VAULT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.TELEGRAM_INIT_DATA_MAX_AGE = '3600';

const {
    validateTelegramInitData,
    issueSessionToken,
    authenticateJwt,
    rejectClientUserId,
    hashPin,
    comparePin,
    encryptWalletSecret,
    decryptWalletSecret
} = require('../walletSecurity');

function makeInitData({ userId = 42, authDate = Math.floor(Date.now() / 1000), token = process.env.TELEGRAM_BOT_TOKEN } = {}) {
    const values = new URLSearchParams({
        auth_date: String(authDate),
        query_id: 'test-query',
        user: JSON.stringify({ id: userId, first_name: 'Test' })
    });
    const check = [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    values.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
    return values.toString();
}

test('extracts user id only from valid signed Telegram initData', () => {
    assert.equal(validateTelegramInitData(makeInitData({ userId: 987654 })).id, '987654');
});

test('rejects forged and expired Telegram initData', () => {
    assert.throws(() => validateTelegramInitData(makeInitData({ token: 'wrong-token' })), /signature/);
    assert.throws(() => validateTelegramInitData(makeInitData({ authDate: 1 })), /expired/);
});

test('JWT middleware restores the signed Telegram subject', () => {
    const req = { headers: { authorization: `Bearer ${issueSessionToken('777')}` } };
    let error;
    authenticateJwt(req, null, value => { error = value; });
    assert.equal(error, undefined);
    assert.equal(req.telegramUserId, '777');
});

test('client supplied user identifiers are rejected', () => {
    let error;
    rejectClientUserId({ body: { user_id: 'someone-else' } }, null, value => { error = value; });
    assert.equal(error.status, 400);
});

test('wallet encryption is authenticated and does not expose plaintext', () => {
    const secret = { privateKey: 'a'.repeat(64), mnemonic: 'one two three' };
    const encrypted = encryptWalletSecret(secret);
    assert.equal(JSON.stringify(encrypted).includes(secret.privateKey), false);
    assert.deepEqual(decryptWalletSecret({
        secret_ciphertext: encrypted.ciphertext,
        secret_iv: encrypted.iv,
        secret_auth_tag: encrypted.authTag
    }), secret);
});

test('PIN is stored as an Argon2id hash', async () => {
    const hash = await hashPin('1234');
    assert.match(hash, /^\$argon2id\$/);
    assert.equal(await comparePin(hash, '1234'), true);
    assert.equal(await comparePin(hash, '4321'), false);
});
