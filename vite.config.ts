import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The whole prototype is a static single-page app: `npm run build` writes
// dist/, which any static host serves (vercel.json sends every path to
// index.html so deep links work).
export default defineConfig({
  plugins: [react()],
  server: { port: 5280 },
  preview: { port: 5281 },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
