import swc from 'unplugin-swc';
import { defineConfig, defaultExclude } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    exclude: [...defaultExclude, '**/spike/**'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
