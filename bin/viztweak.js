#!/usr/bin/env node

/**
 * VizTweak CLI entry point.
 * Starts the MCP server + WebSocket bridge when invoked via `npx viztweak`.
 */

import("../dist/server/index.js").catch((err) => {
  console.error("[viztweak] Failed to start:", err.message);
  console.error("[viztweak] Try running 'npm run build' first, or use 'npx viztweak'");
  process.exit(1);
});
