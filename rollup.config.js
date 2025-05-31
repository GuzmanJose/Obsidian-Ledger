import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from '@rollup/plugin-terser';

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/main.js',
    format: 'cjs',       // CommonJS for Obsidian plugins
    sourcemap: true,
  },
  external: ['obsidian', 'obsidian-dataview'], // Don’t bundle the Obsidian API itself
  plugins: [
    nodeResolve(),        // Finds modules in node_modules
    commonjs(),           // Converts CommonJS → ES Modules
    typescript(),         // Transpile TypeScript → JavaScript
    terser({              // Minify, but keep console.logs for debugging
      compress: { drop_console: false }
    }),
  ],
};

