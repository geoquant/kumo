import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/loader.tsx'),
      name: 'CloudflareKumo',
      fileName: 'kumo-bundle',
      formats: ['umd'], // Standard format for cross-site script tags
    },
    rollupOptions: {
      // Important: We do NOT externalize react here. We bundle it.
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});