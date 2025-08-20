import 'dotenv/config';
import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src', '!src/**/*.test.ts'],
  env: {
    GENERATE_METADATA_NODE_ENV:
      process.env.GENERATE_METADATA_NODE_ENV || 'production',
  },
  format: ['cjs', 'esm'],
  outDir: 'dist',
  sourcemap: true,
  splitting: false,
});
