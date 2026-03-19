import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);

function loadOptionalJsxLocPlugin() {
  try {
    const { jsxLocPlugin } = require("@builder.io/vite-plugin-jsx-loc");
    return jsxLocPlugin();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[vite] jsx-loc plugin disabled: ${message}`);
    return null;
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), loadOptionalJsxLocPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  worker: {
    format: "es",
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
