import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
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
    'process.env.APP_VERSION': JSON.stringify('1.5.0'),
  },
});
