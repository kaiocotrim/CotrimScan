import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cpSync } from 'node:fs';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { index: resolve(__dirname, 'src/index.html') },
    },
  },
  server: { fs: { allow: ['..'] } },
  plugins: [{
    transformIndexHtml(html, context) {
      return context.server ? html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, '') : html;
    },
    name: 'copy-static-assets',
    closeBundle() {
      cpSync(resolve(__dirname, 'src/assets'), resolve(__dirname, 'dist/assets'), { recursive: true });
    },
  }],
});
