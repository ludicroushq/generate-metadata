import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.NODE_ENV === "development" ? "/" : "/docs",
  build: {
    rollupOptions: {
      // Shiki results in a huge bundle because Rollup tries to bundle every language/theme
      external: ["shiki"],
      // most React.js libraries now include 'use client'
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
          return;
        }
        warn(warning);
      },
    },
  },
  plugins: [
    tanstackStart({
      customViteReactPlugin: true,
      tsr: {
        srcDirectory: "./src",
      },
    }),
    react(),
    tsConfigPaths(),
    tailwindcss(),
  ],
});
