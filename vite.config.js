import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      buffer: 'buffer/'
    }
  },
  define: {
    'global': 'globalThis'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@telegram-apps+telegram-ui')) return 'telegram-ui';
          if (id.includes('@noble+') || id.includes('@scure+')) return 'crypto-libs';
        }
      }
    }
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/auth': process.env.DEV_WALLET_API_TARGET || 'http://127.0.0.1:3001',
      '/api/wallet': process.env.DEV_WALLET_API_TARGET || 'http://127.0.0.1:3001'
    }
  }
});
