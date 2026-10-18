const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateServerConfig } = require('../serverConfig');

const good = {
    NODE_ENV: 'production',
    TELEGRAM_BOT_TOKEN: '123456:real-test-token',
    JWT_SECRET: 'a'.repeat(32),
    VAULT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    MYSQL_URL: 'mysql://user:pass@mysql:3306/ots_wallet',
    NODE_API_URL: 'http://api:3000'
};

test('production starts only with configured secrets and backend URLs', () => {
    assert.doesNotThrow(() => validateServerConfig(good));
    assert.throws(() => validateServerConfig({ ...good, JWT_SECRET: 'short' }), /JWT_SECRET/);
    assert.throws(() => validateServerConfig({ ...good, VAULT_ENCRYPTION_KEY: 'broken' }), /VAULT_ENCRYPTION_KEY/);
    assert.throws(() => validateServerConfig({ ...good, NODE_API_URL: 'api:3000' }), /NODE_API_URL/);
    assert.throws(() => validateServerConfig({ ...good, TELEGRAM_BOT_TOKEN: 'replace-with-token' }), /TELEGRAM_BOT_TOKEN/);
});
