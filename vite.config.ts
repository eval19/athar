import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://dorar.net",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

function productionCspPlugin(): Plugin {
  return {
    name: 'athar-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), productionCspPlugin()],
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
