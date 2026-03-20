import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1800, // Phaser is large
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          phaser: ['phaser'],
          react: ['react', 'react-dom'],
          vendor: ['zustand', 'framer-motion'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@phaser': path.resolve(__dirname, 'src/phaser'),
      '@data': path.resolve(__dirname, 'src/data'),
    },
  },
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: ['..'],
    },
  },
  optimizeDeps: {
    include: ['phaser', 'react', 'react-dom', 'zustand'],
  },
});
