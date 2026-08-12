import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

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
    'process.env.APP_VERSION': JSON.stringify('2.0.1'),
  },
});
