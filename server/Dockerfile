# Build from the wallet repository root:
# docker build -f server/Dockerfile -t grovvik/ots-wallet:local .
FROM node:22-alpine AS web-build
WORKDIR /build
COPY package.json ./
RUN npm install
COPY . ./
ARG VITE_OTS_NETWORK=mainnet
RUN npm run build

FROM node:22-alpine
WORKDIR /app

# Native argon2 builds need these packages when a prebuilt binary is unavailable.
RUN apk add --no-cache python3 make g++
WORKDIR /app/wallet/server
COPY server/package.json ./package.json
RUN npm install --omit=dev

COPY server/index.cjs server/walletApi.js server/walletStore.js server/walletSecurity.js server/serverConfig.js ./
COPY --from=web-build /build/dist ./public

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "index.cjs"]
