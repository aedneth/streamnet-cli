import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
  shims: true,
  // Heavy / optional native deps stay external and are resolved at runtime.
  external: ['webtorrent', 'ink', 'react'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
