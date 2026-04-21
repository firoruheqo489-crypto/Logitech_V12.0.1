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
  esbuild: false,
  optimizeDeps: {
    entries: ["index.html", "src/main.tsx", "src/App.tsx"],
    include: [
      "react",
      "react-dom",
      "wouter",
      "sonner",
      "lucide-react",
      "recharts",
      "framer-motion",
      "react-day-picker",
      "@supabase/supabase-js",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
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
    chunkSizeWarningLimit: 1000,
    minify: "esbuild",
    cssMinify: "esbuild",
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("/xlsx/")) {
            return "vendor-xlsx";
          }

          if (id.includes("/exceljs/")) {
            return "vendor-exceljs";
          }

          if (id.includes("/jszip/")) {
            return "vendor-jszip";
          }

          if (
            id.includes("/jspdf/") ||
            id.includes("/html2canvas/") ||
            id.includes("/html2pdf.js/")
          ) {
            return "vendor-pdf-export";
          }

          if (id.includes("/pdfjs-dist/")) {
            return "vendor-pdf-viewer";
          }

          if (
            id.includes("/recharts/") ||
            id.includes("/d3-") ||
            id.includes("/internmap/") ||
            id.includes("/victory-vendor/")
          ) {
            return "vendor-charts";
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "vendor-react-core";
          }
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
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
