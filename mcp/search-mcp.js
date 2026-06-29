#!/usr/bin/env node

import { main } from "../src/mcp/index.js";

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
