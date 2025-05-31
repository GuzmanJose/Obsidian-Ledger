import { defineConfig } from 'vite';

// Obsidian plugin build config: no HTML, just TypeScript -> main.js
export default defineConfig({
  build: {
    lib: {
      entry: './src/main.ts',
      formats: ['cjs'], // Obsidian expects CommonJS output
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: ['obsidian'],
      output: {
        entryFileNames: 'main.js',
        assetFileNames: '[name][extname]',
      }
    },
    emptyOutDir: false,
    outDir: 'dist',
    minify: false
  }
});

