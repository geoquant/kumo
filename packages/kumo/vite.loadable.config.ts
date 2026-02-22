import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Separate Vite config for the UMD cross-boundary loadable bundle.
 *
 * Bundles React + ReactDOM + kumo renderer + Tailwind CSS into a single
 * `<script>`-loadable file. Host pages get `window.CloudflareKumo` without
 * needing a React toolchain.
 *
 * Usage:
 *   pnpm --filter @cloudflare/kumo build:loadable
 *
 * Output:
 *   dist/loadable/kumo-loadable.umd.js   — UMD bundle
 *   dist/loadable/style.css              — Tailwind + component styles
 */
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // Ensure the standalone CSS import in loadable/index.ts resolves
      // to the source file (Tailwind plugin processes it)
      "@cloudflare/kumo/styles/standalone": resolve(
        __dirname,
        "src/styles/kumo-standalone.css",
      ),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/loadable/index.ts"),
      name: "CloudflareKumo",
      fileName: () => "kumo-loadable.umd.js",
      formats: ["umd"],
      cssFileName: "style",
    },
    outDir: resolve(__dirname, "dist/loadable"),
    emptyOutDir: true,
    // React is NOT externalized — bundled for zero-dependency <script> usage
    rollupOptions: {
      output: {
        // Inline all dynamic imports into the UMD wrapper
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    minify: "esbuild",
    sourcemap: true,
    // Target ES2017 for broad browser compat (UMD consumers may not transpile)
    target: "es2017",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
