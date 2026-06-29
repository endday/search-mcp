import { loadMcpConfig } from "./config.js";
import { createServer, startServer } from "./server.js";

export async function main() {
  const config = loadMcpConfig();
  const server = createServer(config);
  await startServer(server);
  console.error("Search MCP Server running on stdio");
  console.error(`Mode: ${config.mode}`);
}
