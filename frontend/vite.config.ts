import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import backendManager from './vite-plugin-backend-manager';

export default defineConfig({
  plugins: [react(), backendManager()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/webhook': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
