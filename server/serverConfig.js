function validateServerConfig(env = process.env) {
    if (env.NODE_ENV !== 'production') return;
    for (const name of ['TELEGRAM_BOT_TOKEN', 'JWT_SECRET', 'VAULT_ENCRYPTION_KEY', 'MYSQL_URL', 'NODE_API_URL']) {
        if (!env[name] || /replace-with|YOUR_/i.test(env[name])) throw new Error(`${name} must be configured for production`);
    }
    if (Buffer.byteLength(env.JWT_SECRET) < 32) throw new Error('JWT_SECRET must be at least 32 bytes');
    const encoded = env.VAULT_ENCRYPTION_KEY;
    const key = /^[a-f0-9]{64}$/i.test(encoded) ? Buffer.from(encoded, 'hex') : Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new Error('VAULT_ENCRYPTION_KEY must decode to exactly 32 bytes');
    if (!/^https?:\/\//.test(env.NODE_API_URL)) throw new Error('NODE_API_URL must be an HTTP URL');
}

module.exports = { validateServerConfig };
