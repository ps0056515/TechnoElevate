import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api to the Node backend. Must match the port where the API actually runs (default 6000; many setups use 6001).
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, process.cwd(), '');
  const proxyTarget = (rootEnv.VITE_DEV_PROXY || 'http://localhost:6000').replace(/\/$/, '');
  return {
  plugins: [react()],
  server: {
    port: 7000,
    strictPort: true,
    host: '0.0.0.0',       // listen on all interfaces so LAN IPs can reach it
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
  },
  }
});
