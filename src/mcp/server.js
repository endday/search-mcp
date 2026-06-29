import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  CONTENT_INPUT_SCHEMA,
  createSearchInputSchema,
  JINA_CONTENT_INPUT_SCHEMA,
} from "./schemas.js";
import { handleWebSearch } from "./tools/webSearch.js";
import { handleContent } from "./tools/content.js";
import { handleJinaContent } from "./tools/jinaContent.js";

export function createServer(config) {
  const server = new Server(
    { name: "search-mcp", version: "2.0.0" },
    { capabilities: { tools: {} } }
  );

  const TOOL_LIST = {
    tools: [
      {
        name: "web_search",
        description:
          "Search the web with local-first MCP execution. Returns deduplicated results with snippets and source authority scores.",
        inputSchema: createSearchInputSchema(config.allEngines),
      },
      {
        name: "content",
        description:
          "Extract readable text from a URL with local-first MCP execution. Returns title, URL, and extracted content.",
        inputSchema: CONTENT_INPUT_SCHEMA,
      },
      {
        name: "jina_content",
        description:
          "Extract readable text from a URL using Jina AI reader. Per-user rate limit unless JINA_API_KEY is configured.",
        inputSchema: JINA_CONTENT_INPUT_SCHEMA,
      },
    ],
  };

  const VALID_TOOL_NAMES = new Set(["web_search", "content", "jina_content"]);

  server.setRequestHandler(ListToolsRequestSchema, async () => TOOL_LIST);

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    if (!VALID_TOOL_NAMES.has(name)) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const args = request.params.arguments || {};

    if (name === "web_search") {
      return handleWebSearch(config, args);
    }

    if (name === "content") {
      return handleContent(config, args);
    }

    return handleJinaContent(config, args);
  });

  return server;
}

export async function startServer(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
