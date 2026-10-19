#!/usr/bin/env node

import { createEdgeServer } from "../server.js";

async function main() {
  try {
    const { start } = createEdgeServer();
    await start();
  } catch (error) {
    console.error("Fatal error starting edge-devtools-mcp server:", error);
    process.exit(1);
  }
}

main();
