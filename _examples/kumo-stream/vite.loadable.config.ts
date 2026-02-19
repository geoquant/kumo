import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

/**
 * Separate Vite config for the UMD cross-boundary loadable bundle.
 * Bundles React + Kumo + renderer into a single file loadable via <script>.
 *
 * Tailwind plugin required — @cloudflare/kumo/styles/standalone contains
 * Tailwind directives that must be processed into final CSS.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/loadable/index.ts"),
      name: "CloudflareKumo",
      fileName: (_format: string) => "component-loadable.umd.js",
      formats: ["umd"],
      cssFileName: "style",
    },
    outDir: "dist/loadable",
    // React is NOT externalized -- bundled in for cross-boundary use
    rollupOptions: {},
    cssCodeSplit: false,
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
