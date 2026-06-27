#!/usr/bin/env node

/**
 * Search MCP Server
 *
 * Environment Variables:
 * - SEARCH_MCP_URL: The URL of your Search MCP Worker (required)
 * - SEARCH_MCP_TOKEN: Authentication token for the search API (optional)
 * - JINA_API_KEY: Jina AI API key for higher rate limits (optional)
 * - JINA_BASE_URL: Jina reader base URL (default: https://r.jina.ai/)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SEARCH_MCP_URL = process.env.SEARCH_MCP_URL;
const SEARCH_MCP_TOKEN = process.env.SEARCH_MCP_TOKEN;
const JINA_API_KEY = process.env.JINA_API_KEY;
const JINA_BASE_URL = process.env.JINA_BASE_URL || "https://r.jina.ai/";

if (!SEARCH_MCP_URL) {
  console.error("Error: SEARCH_MCP_URL environment variable is required");
  process.exit(1);
}

const ALL_ENGINES = [
  "startpage",
  "duckduckgo",
  "brave",
  "bing",
  "toutiao",
  "mojeek",
];

// Pre-build constants to avoid per-call allocation
const AUTH_HEADERS = SEARCH_MCP_TOKEN ? { Authorization: `Bearer ${SEARCH_MCP_TOKEN}` } : {};
const JINA_AUTH_HEADERS = JINA_API_KEY ? { Authorization: `Bearer ${JINA_API_KEY}` } : {};
const API_BASE_URL = SEARCH_MCP_URL.endsWith("/") ? SEARCH_MCP_URL : `${SEARCH_MCP_URL}/`;

// Truncation constants shared between schema and normalizeMaxChars
const MAX_CHARS_MIN = 500;
const MAX_CHARS_MAX = 20000;
const MAX_CHARS_DEFAULT = 4000;

function getApiEndpoint(path) {
  return new URL(path, API_BASE_URL);
}

function appendSearchParams(params, engines, options) {
  if (engines?.length > 0) {
    params.append("engines", engines.join(","));
  }

  if (options.language) params.append("language", options.language);
  if (options.location) params.append("location", options.location);
  if (options.time_range) params.append("time_range", options.time_range);
  if (Number.isInteger(options.pageno)) params.append("pageno", String(options.pageno));
  if (Number.isFinite(options.min_authority_score)) params.append("min_authority_score", String(options.min_authority_score));
  if (options.include_source_types?.length > 0) params.append("include_source_types", options.include_source_types.join(","));
  if (options.exclude_source_types?.length > 0) params.append("exclude_source_types", options.exclude_source_types.join(","));
}

function normalizeMaxChars(value) {
  return Number.isInteger(value) ? Math.min(Math.max(value, MAX_CHARS_MIN), MAX_CHARS_MAX) : MAX_CHARS_DEFAULT;
}

// #1 fix: URL validation shared between content and jina_content
function requireUrl(args) {
  const url = args.url;
  if (!url || typeof url !== "string") throw new Error("url required");
  return url;
}

// #2 fix: Read error body before throwing so diagnostic info is preserved
async function readApiError(prefix, response) {
  const status = response.status;
  try {
    const body = await response.text();
    return new Error(`${prefix}: ${status} ${body}`);
  } catch (_) {
    return new Error(`${prefix}: ${status}`);
  }
}

async function searchAPI(query, engines = null, options = {}) {
  const resolvedEngines = engines?.length > 0 ? engines : ALL_ENGINES;
  const params = new URLSearchParams({ q: query });
  appendSearchParams(params, resolvedEngines, options);

  const url = getApiEndpoint("search");
  url.search = params.toString();
  const response = await fetch(url, { headers: AUTH_HEADERS });

  if (!response.ok) {
    throw await readApiError("Search failed", response);
  }

  return await response.json();
}

// #6 fix: Forward max_bytes to Worker so it can truncate on server side
async function contentAPI(targetUrl, options = {}) {
  const params = new URLSearchParams({ url: targetUrl });
  if (Number.isInteger(options.max_bytes)) params.append("max_bytes", String(options.max_bytes));

  const url = getApiEndpoint("content");
  url.search = params.toString();
  const response = await fetch(url, { headers: AUTH_HEADERS });

  if (!response.ok) {
    throw await readApiError("Content failed", response);
  }

  return await response.json();
}

// #2 fix: Encode target URL to prevent query/fragment pollution
async function jinaContentAPI(targetUrl) {
  const encodedUrl = encodeURIComponent(targetUrl);
  const jinaUrl = `${JINA_BASE_URL}${encodedUrl}`;
  const response = await fetch(jinaUrl, { headers: JINA_AUTH_HEADERS });

  if (!response.ok) {
    throw await readApiError("Jina failed", response);
  }

  return { url: targetUrl, source: "jina", text: await response.text() };
}

// #3 fix: Include description snippet in compact format
// Format: 1. Title | description_snippet | url type(score)
function formatSearchResponse(result) {
  const lines = result.results.map((item, i) => {
    const score = item.authority_score ?? 0;
    const type = item.source_type || "unknown";
    const tag = score > 0 || type !== "unknown" ? ` ${type}(${score})` : "";
    // Truncate description to ~120 chars for token savings
    const desc = String(item.description || "").slice(0, 120);
    const sep = desc ? ` | ${desc}` : "";
    return `${i + 1}. ${item.title}${sep} | ${item.url}${tag}`;
  });

  return lines.join("\n");
}

// #5 fix: Include minimal metadata (title + url) before text
// Keeps attribution without excessive metadata
function truncateText(text, maxChars) {
  return text.length > maxChars
    ? text.slice(0, maxChars) + `\n[...${text.length - maxChars} chars truncated]`
    : text;
}

function formatContentResponse(result, maxChars) {
  const text = String(result.text || result.excerpt || "");
  const header = [
    result.title ? `# ${result.title}` : null,
    result.url ? result.url : null,
    result.extractor ? `(${result.extractor})` : null,
  ].filter(Boolean).join(" ");

  const excerpt = truncateText(text, maxChars);
  return header ? `${header}\n${excerpt}` : excerpt;
}

// --- MCP Server ---
const server = new Server(
  { name: "search-mcp", version: "1.4.0" },
  { capabilities: { tools: {} } },
);

// #7 fix: Remove duplicate `search` tool — `web_search` covers it
const SEARCH_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query",
    },
    engines: {
      type: "array",
      items: {
        type: "string",
        enum: ALL_ENGINES,
      },
      description: "Engines to query. Default: startpage, duckduckgo, brave, bing, toutiao, mojeek.",
    },
    language: {
      type: "string",
      description: "Language hint (e.g. en, zh-CN)",
    },
    location: {
      type: "string",
      description: "Location hint. 'auto' uses Cloudflare visitor city.",
    },
    time_range: {
      type: "string",
      enum: ["day", "week", "month", "year"],
      description: "Time range filter",
    },
    pageno: {
      type: "integer",
      minimum: 0,
      description: "Page number (0-based)",
    },
    min_authority_score: {
      type: "number",
      description: "Min source authority score. 1 excludes unknown/negative sources.",
    },
    include_source_types: {
      type: "array",
      items: { type: "string" },
      description: "Source types to include (official, paper, media, etc.)",
    },
    exclude_source_types: {
      type: "array",
      items: { type: "string" },
      description: "Source types to exclude (blog, low_credibility, etc.)",
    },
  },
  required: ["query"],
};

const CONTENT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "URL to extract content from",
    },
    max_chars: {
      type: "integer",
      minimum: MAX_CHARS_MIN,
      maximum: MAX_CHARS_MAX,
      description: `Max text chars to return. Default: ${MAX_CHARS_DEFAULT}.`,
    },
  },
  required: ["url"],
};

// #1 fix: Add max_chars to jina_content schema
const JINA_CONTENT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "URL to extract content from via Jina AI reader",
    },
    max_chars: {
      type: "integer",
      minimum: MAX_CHARS_MIN,
      maximum: MAX_CHARS_MAX,
      description: `Max text chars to return. Default: ${MAX_CHARS_DEFAULT}.`,
    },
  },
  required: ["url"],
};

const VALID_TOOL_NAMES = new Set(["web_search", "content", "jina_content"]);

// Pre-build static tool list (#7: removed duplicate `search` tool)
const TOOL_LIST = {
  tools: [
    {
      name: "web_search",
      description: "Search the web for real-time information across multiple engines. Returns deduplicated results with description snippets and source authority scores.",
      inputSchema: SEARCH_INPUT_SCHEMA,
    },
    {
      name: "content",
      description: "Extract readable text from a URL. Returns title, URL, and extracted content.",
      inputSchema: CONTENT_INPUT_SCHEMA,
    },
    {
      name: "jina_content",
      description: "Extract readable text from a URL using Jina AI reader. Per-user rate limit (JINA_API_KEY env var for higher limits).",
      inputSchema: JINA_CONTENT_INPUT_SCHEMA,
    },
  ],
};

server.setRequestHandler(ListToolsRequestSchema, async () => TOOL_LIST);

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  if (!VALID_TOOL_NAMES.has(name)) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const args = request.params.arguments || {};

  // --- jina_content ---
  if (name === "jina_content") {
    const url = requireUrl(args);
    const maxChars = normalizeMaxChars(args.max_chars);
    try {
      const result = await jinaContentAPI(url);
      const text = truncateText(String(result.text || ""), maxChars);
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Jina failed: ${error.message}` }], isError: true };
    }
  }

  // --- content ---
  if (name === "content") {
    const url = requireUrl(args);
    const maxChars = normalizeMaxChars(args.max_chars);
    // #6 fix: Estimate max_bytes from max_chars (roughly 4 bytes per char for HTML)
    const estimatedMaxBytes = maxChars * 4 + 50000;
    try {
      const result = await contentAPI(url, { max_bytes: estimatedMaxBytes });
      return { content: [{ type: "text", text: formatContentResponse(result, maxChars) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Content failed: ${error.message}` }], isError: true };
    }
  }

  // --- web_search ---
  const { query, engines, language, location, time_range, pageno,
    min_authority_score, include_source_types, exclude_source_types } = args;

  if (!query || typeof query !== "string") throw new Error("query required");

  const options = { language, location, time_range, pageno };
  if (Number.isFinite(min_authority_score)) options.min_authority_score = min_authority_score;
  if (Array.isArray(include_source_types)) options.include_source_types = include_source_types;
  if (Array.isArray(exclude_source_types)) options.exclude_source_types = exclude_source_types;

  try {
    const result = await searchAPI(query, engines, options);
    return { content: [{ type: "text", text: formatSearchResponse(result) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Search failed: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Search MCP Server running on stdio");
  console.error(`Connected to: ${SEARCH_MCP_URL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
