import { tmaService } from './tmaService';

const API_BASE = (import.meta.env.VITE_WALLET_API_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
let sessionToken = '';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed with HTTP ${response.status}`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

async function request(path, options = {}, allowSessionRefresh = true) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401 && allowSessionRefresh && sessionToken && path !== '/auth/telegram') {
    const errorPayload = await response.clone().json().catch(() => ({}));
    if (errorPayload.code === 'invalid_session' || errorPayload.code === 'session_required') {
      await authenticateSession();
      return request(path, options, false);
    }
  }
  return parseResponse(response);
}

async function authenticateSession() {
  const initData = tmaService.getInitData();
  if (!initData) throw new Error('Open this wallet from Telegram to continue');
  const result = await request('/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData })
  }, false);
  sessionToken = result.token;
  return result;
}

export const apiService = {
  async authenticate() {
    return authenticateSession();
  },

  clearSession() {
    sessionToken = '';
  },

  bootstrap: () => request('/api/wallet/bootstrap'),
  setupPin: (pin) => request('/api/wallet/pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  verifyPin: (pin) => request('/api/wallet/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  changePin: (currentPin, newPin) => request('/api/wallet/pin', {
    method: 'PUT', body: JSON.stringify({ currentPin, newPin })
  }),
  resetVault: (pin) => request('/api/wallet/vault', { method: 'DELETE', body: JSON.stringify({ pin }) }),
  listWallets: async () => (await request('/api/wallet/wallets')).wallets,
  createWallet: async ({ name, mnemonic, privateKey, pin }) => (
    await request('/api/wallet/wallets', {
      method: 'POST', body: JSON.stringify({ name, mnemonic, privateKey, pin })
    })
  ).wallet,
  renameWallet: (walletId, name, pin) => request(`/api/wallet/wallets/${walletId}`, {
    method: 'PATCH', body: JSON.stringify({ name, pin })
  }),
  deleteWallet: (walletId, pin) => request(`/api/wallet/wallets/${walletId}`, {
    method: 'DELETE', body: JSON.stringify({ pin })
  }),
  reorderWallets: (walletIds, pin) => request('/api/wallet/wallets-order', {
    method: 'PUT', body: JSON.stringify({ walletIds, pin })
  }),
  getAccount: (walletId) => request(`/api/wallet/wallets/${walletId}/account`),
  getHistory: async (walletId) => (await request(`/api/wallet/wallets/${walletId}/history`)).history.map((item) => ({
    ...item,
    amount: BigInt(item.amount || 0),
    gasLimit: item.gasLimit !== undefined ? BigInt(item.gasLimit || 0) : 0n
  })),
  sendTransaction: (walletId, intent, pin) => request(`/api/wallet/wallets/${walletId}/transactions`, {
    method: 'POST', body: JSON.stringify({ ...intent, pin })
  })
};
