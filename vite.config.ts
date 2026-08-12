import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  build: {
    emptyOutDir: false,
  },
  server: {
    port: 1384,
    proxy: {
      '/api': {
        target: 'http://localhost:1385',
        changeOrigin: true,
      },
    },
  },
  define: {
    'process.env.APP_VERSION': JSON.stringify(pkg.version),
  },
});
