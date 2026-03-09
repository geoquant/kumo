import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
      "virtual:kumo-registry": resolve(
        __dirname,
        "src/test-support/mock-kumo-registry.ts",
      ),
      "@cloudflare/kumo/streaming": resolve(
        __dirname,
        "../kumo/src/streaming/index.ts",
      ),
      "@cloudflare/kumo/generative/graders": resolve(
        __dirname,
        "../kumo/src/generative/graders.ts",
      ),
      "@cloudflare/kumo/generative": resolve(
        __dirname,
        "../kumo/src/generative/index.ts",
      ),
      "@cloudflare/kumo/catalog": resolve(
        __dirname,
        "../kumo/src/catalog/index.ts",
      ),
      "@cloudflare/kumo": resolve(__dirname, "../kumo/src/index.ts"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.{ts,tsx}",
    ],
    setupFiles: ["./src/test-support/setup.ts"],
  },
});
