import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    proxy: {
      '/dorar-proxy': {
        target: 'https://dorar.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dorar-proxy/, ''),
      },
    },
  },
  build: {
    target: 'es2020',
  },
});
