import { defineConfig } from "vite";

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
