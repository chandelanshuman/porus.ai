import { defineConfig } from "vite";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      input: {
        main: `${root}index.html`,
        app: `${root}app.html`,
      },
      output: {
        // stable hashed asset names for long-term caching
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 4173,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
});
