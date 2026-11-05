import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  publicDir: 'static',
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: 'public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 3000,
  },
});
