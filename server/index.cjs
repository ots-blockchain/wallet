const path = require('path');
const express = require('express');
const cors = require('cors');
const { registerWalletApi } = require('./walletApi');
const { validateServerConfig } = require('./serverConfig');

const PORT = Number(process.env.WALLET_API_PORT || 3001);
const WEB_ROOT = path.resolve(process.env.WALLET_WEB_ROOT || path.join(__dirname, 'public'));

async function start() {
    validateServerConfig();
    const app = express();
    const origins = (process.env.CORS_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
    app.use(cors({ origin: origins.length ? origins : false }));
    app.use(express.json({ limit: '256kb' }));
    const walletApi = registerWalletApi(app);
    await walletApi.ready;
    app.get('/health', (_req, res) => res.json({ ok: true, service: 'ots-wallet-api' }));
    app.use((error, _req, res, _next) => {
        const status = Number(error.status || 500);
        if (status >= 500) console.error(error.stack || error.message);
        res.status(status).json({ error: status >= 500 ? 'Internal server error' : error.message, code: error.code || 'internal_error' });
    });
    // The production image places the Vite build here.  API routes are
    // registered first, so frontend navigation can safely fall back to the SPA.
    app.use(express.static(WEB_ROOT, { index: 'index.html' }));
    app.get(/^(?!\/(?:api|auth|health)(?:\/|$)).*/, (_req, res) => res.sendFile(path.join(WEB_ROOT, 'index.html')));
    app.listen(PORT, () => console.info(`Wallet API listening on :${PORT}`));
}

start().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
