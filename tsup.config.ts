import { defineConfig } from "tsup";

export default defineConfig([
  // Browser component (React)
  {
    entry: { "browser/index": "src/browser/index.tsx" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: ["react", "react-dom"],
    outDir: "dist",
    clean: true,
    injectStyle: true,
  },
  // MCP Server (Node.js)
  {
    entry: { "server/index": "src/server/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    platform: "node",
    outDir: "dist",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
