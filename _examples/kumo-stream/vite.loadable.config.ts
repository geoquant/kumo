import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * Separate Vite config for the UMD cross-boundary loadable bundle.
 * Bundles React + Kumo + renderer into a single file loadable via <script>.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/loadable/index.ts"),
      name: "CloudflareKumo",
      fileName: "component-loadable",
      formats: ["umd"],
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
