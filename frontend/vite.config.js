import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7000,
    strictPort: true,
    host: '0.0.0.0',       // listen on all interfaces so LAN IPs can reach it
    proxy: {
      '/api': {
        target: 'http://localhost:6000',
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
});
