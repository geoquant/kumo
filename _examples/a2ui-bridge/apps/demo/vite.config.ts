import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteApiPlugin } from "./vite-api-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), viteApiPlugin()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
