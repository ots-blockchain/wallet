/**
 * Zero-Knowledge Cryptography Service for OTS Wallet.
 * Features:
 * - PBKDF2 (100,000 iterations, SHA-256) key derivation.
 * - AES-256-GCM encryption for client vault storage.
 * - Key wrapping for fast PIN unlock with anti-brute-force lockout.
 */

import { serializeWithBigInt, deserializeWithBigInt } from '../utils/format';

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateRandomBytes(length = 16) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return array;
}

export async function deriveKey(secret, salt, iterations = 100000) {
  const encoder = new TextEncoder();
  const rawKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data, secret) {
  const salt = generateRandomBytes(16);
  const iv = generateRandomBytes(12);
  const key = await deriveKey(secret, salt, 100000);

  const jsonStr = serializeWithBigInt(data);
  const encoded = new TextEncoder().encode(jsonStr);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
    version: 1
  };
}

export async function decryptData(encryptedPayload, secret) {
  if (!encryptedPayload || !encryptedPayload.ciphertext || !encryptedPayload.iv || !encryptedPayload.salt) {
    throw new Error('Invalid encrypted payload');
  }

  const saltBuffer = base64ToBuffer(encryptedPayload.salt);
  const ivBuffer = base64ToBuffer(encryptedPayload.iv);
  const ciphertextBuffer = base64ToBuffer(encryptedPayload.ciphertext);

  const key = await deriveKey(secret, new Uint8Array(saltBuffer), 100000);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    key,
    ciphertextBuffer
  );

  const decodedStr = new TextDecoder().decode(decryptedBuffer);
  return deserializeWithBigInt(decodedStr);
}

// -------------------------------------------------------------
// PIN Management & Rate-Limited Mobile Unlock
// -------------------------------------------------------------

const STORAGE_VAULT_KEY = 'ots_vault';
const STORAGE_PIN_KEY = 'ots_pin_wrap';
const STORAGE_ATTEMPTS_KEY = 'ots_pin_attempts';
const STORAGE_LOCKOUT_KEY = 'ots_pin_lockout';
const MAX_ATTEMPTS = 5;

export const cryptoService = {
  saveVault(wallets, pin) {
    return encryptData(wallets, pin).then((encrypted) => {
      localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(encrypted));
      localStorage.setItem(STORAGE_PIN_KEY, 'configured');
      localStorage.setItem(STORAGE_ATTEMPTS_KEY, '0');
      return encrypted;
    });
  },

  async loadVault(pin) {
    const raw = localStorage.getItem(STORAGE_VAULT_KEY);
    if (!raw) return null;

    const lockout = this.checkLockout();
    if (lockout.locked) {
      throw new Error(`PIN locked. Retry in ${lockout.remainingSeconds}s.`);
    }

    try {
      const encrypted = JSON.parse(raw);
      const wallets = await decryptData(encrypted, pin);
      localStorage.setItem(STORAGE_ATTEMPTS_KEY, '0');
      return wallets;
    } catch (err) {
      let attempts = parseInt(localStorage.getItem(STORAGE_ATTEMPTS_KEY) || '0', 10) + 1;
      localStorage.setItem(STORAGE_ATTEMPTS_KEY, String(attempts));

      if (attempts >= MAX_ATTEMPTS) {
        const lockDuration = Math.min(60 * 1000 * Math.pow(2, attempts - MAX_ATTEMPTS), 15 * 60 * 1000);
        localStorage.setItem(STORAGE_LOCKOUT_KEY, String(Date.now() + lockDuration));
        throw new Error(`Too many attempts (${attempts}/${MAX_ATTEMPTS}). Locked for ${Math.round(lockDuration / 1000)}s.`);
      }
      throw new Error(`Incorrect PIN. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.`);
    }
  },

  async verifyPin(pin) {
    const wallets = await this.loadVault(pin);
    return !!(wallets && wallets.length > 0);
  },

  async changePin(oldPin, newPin) {
    const wallets = await this.loadVault(oldPin);
    if (!wallets || wallets.length === 0) {
      throw new Error('Vault is empty or incorrect PIN');
    }
    return this.saveVault(wallets, newPin);
  },

  hasVault() {
    return !!localStorage.getItem(STORAGE_VAULT_KEY);
  },

  checkLockout() {
    const until = parseInt(localStorage.getItem(STORAGE_LOCKOUT_KEY) || '0', 10);
    const now = Date.now();
    if (until > now) {
      return { locked: true, remainingSeconds: Math.ceil((until - now) / 1000) };
    }
    return { locked: false, remainingSeconds: 0 };
  },

  clearAll() {
    localStorage.removeItem(STORAGE_VAULT_KEY);
    localStorage.removeItem(STORAGE_PIN_KEY);
    localStorage.removeItem(STORAGE_ATTEMPTS_KEY);
    localStorage.removeItem(STORAGE_LOCKOUT_KEY);
  }
};
