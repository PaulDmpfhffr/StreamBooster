import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.join(__dirname, 'renderer'),
  plugins: [react()],
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@streambooster/shared': path.join(__dirname, '../../packages/shared/src'),
    },
  },
  base: './',
});
