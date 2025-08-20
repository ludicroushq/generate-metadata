import "dotenv/config";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src", "!src/**/*.test.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  env: {
    GENERATE_METADATA_NODE_ENV:
      process.env.GENERATE_METADATA_NODE_ENV || "production",
  },
});
