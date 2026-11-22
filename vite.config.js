import { defineConfig } from "vite";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL(".", import.meta.url));

// Match GitHub Pages' directory redirect in local development and preview.
function revoiceDirectoryRedirect(server) {
  server.middlewares.use((req, res, next) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/PorusRevoice") return next();
    res.writeHead(308, { Location: `/PorusRevoice/${url.search}` });
    res.end();
  });
}

export default defineConfig({
  plugins: [{
    name: "revoice-directory-redirect",
    configureServer: revoiceDirectoryRedirect,
    configurePreviewServer: revoiceDirectoryRedirect,
  }],
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
        revoice: `${root}PorusRevoice/index.html`,
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
