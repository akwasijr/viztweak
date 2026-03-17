import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "copy-extension-files",
      writeBundle() {
        const dist = resolve(__dirname, "dist");
        if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
        copyFileSync(resolve(__dirname, "manifest.json"), resolve(dist, "manifest.json"));
        // Copy content.css
        copyFileSync(resolve(__dirname, "src/content/content.css"), resolve(dist, "content.css"));
        // Copy icons
        const iconsDir = resolve(dist, "icons");
        if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
        const srcIcons = resolve(__dirname, "public/icons");
        for (const size of ["icon-16.png", "icon-48.png", "icon-128.png"]) {
          const src = resolve(srcIcons, size);
          if (existsSync(src)) {
            copyFileSync(src, resolve(iconsDir, size));
          }
        }
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "src/sidepanel/index.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/content.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "sidepanel") return "sidepanel.js";
          return "[name].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (info) => {
          if (info.name === "content.css") return "content.css";
          return "assets/[name][extname]";
        },
      },
    },
    target: "chrome116",
    minify: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
