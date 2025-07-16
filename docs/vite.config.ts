import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
      prerender: {
        enabled: true,
        crawlLinks: true,
      },
    }),
    react(),
    tsConfigPaths(),
    tailwindcss(),
  ],
});
