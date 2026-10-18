# OTS Wallet server

HTTP backend for the Telegram wallet. It serves the compiled frontend, validates
Telegram `initData`, owns the MySQL wallet vault, and signs user transactions.

It does not run a blockchain node and has no P2P, LevelDB, or VM runtime. Blockchain
state, transaction history, and submission of signed transactions go through the REST
API provided by `node/api`. Configure that endpoint with `NODE_API_URL` (default:
`http://127.0.0.1:3000`).

The service hosts both the wallet API and the compiled frontend on
`WALLET_API_PORT` (default: `3001`). The frontend uses relative API URLs in the
production build, so no `VITE_WALLET_API_URL` is needed.

`OTS_NETWORK` on the server and `VITE_OTS_NETWORK` at frontend build time must
match. Local development defaults to `devnet`; production builds default to
`mainnet`. The Dockerfile accepts a `VITE_OTS_NETWORK` build argument, and the
deployment Compose file supplies the same profile to both sides. Never use the
public devnet test keys for real funds.

Build and run it from the repository root:

```powershell
docker build -f wallet/server/Dockerfile -t ots-wallet .
docker run --env-file wallet/server/.env -p 3001:3001 ots-wallet
```

Use `.env.example` as the configuration template.

`node/api` remains responsible for synchronizing blockchain state and broadcasting
transactions to the P2P network.
