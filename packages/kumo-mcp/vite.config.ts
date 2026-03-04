import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    // Strip +types/ imports that React Router generates at build time.
    // During dev / typecheck they don't exist on disk, so resolve to an empty module.
    {
      name: "strip-typegen-imports",
      enforce: "pre",
      resolveId(id) {
        if (id.includes("+types/")) return id;
      },
      load(id) {
        if (id.includes("+types/")) return "export {}";
      },
    },
    cloudflare({
      viteEnvironment: { name: "ssr" },
      inspectorPort: false,
    }),
    reactRouter(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});
