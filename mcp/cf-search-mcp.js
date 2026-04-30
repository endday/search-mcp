#!/usr/bin/env node

/**
 * Cloudflare Search MCP Server
 *
 * This MCP server provides access to the Cloudflare Search API,
 * allowing AI assistants to search across multiple search engines.
 *
 * Environment Variables:
 * - CF_SEARCH_URL: The URL of your Cloudflare Search Worker (required)
 * - CF_SEARCH_TOKEN: Authentication token for the search API (optional)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Get configuration from environment variables
const CF_SEARCH_URL = process.env.CF_SEARCH_URL;
const CF_SEARCH_TOKEN = process.env.CF_SEARCH_TOKEN;

if (!CF_SEARCH_URL) {
  console.error("Error: CF_SEARCH_URL environment variable is required");
  console.error(
    "Example: export CF_SEARCH_URL=https://your-worker.workers.dev",
  );
  process.exit(1);
}

function getApiEndpoint(path) {
  const baseUrl = CF_SEARCH_URL.endsWith("/")
    ? CF_SEARCH_URL
    : `${CF_SEARCH_URL}/`;

  return new URL(path, baseUrl);
}

function appendCommonSearchParams(params, engines, options) {
  if (engines && engines.length > 0) {
    params.append("engines", engines.join(","));
  }

  if (options.language) {
    params.append("language", options.language);
  }

  if (options.location) {
    params.append("location", options.location);
  }

  if (options.time_range) {
    params.append("time_range", options.time_range);
  }

  if (Number.isInteger(options.pageno)) {
    params.append("pageno", String(options.pageno));
  }

  if (Number.isInteger(options.limit)) {
    params.append("limit", String(options.limit));
  }

  if (Number.isInteger(options.excerpt_chars)) {
    params.append("excerpt_chars", String(options.excerpt_chars));
  }

  if (Number.isInteger(options.max_bytes)) {
    params.append("max_bytes", String(options.max_bytes));
  }

  if (Number.isFinite(options.min_authority_score)) {
    params.append("min_authority_score", String(options.min_authority_score));
  }

  if (options.include_source_types?.length > 0) {
    params.append("include_source_types", options.include_source_types.join(","));
  }

  if (options.exclude_source_types?.length > 0) {
    params.append("exclude_source_types", options.exclude_source_types.join(","));
  }
}

async function callWorkerAPI(path, query, engines = null, options = {}) {
  try {
    const params = new URLSearchParams({ q: query });

    appendCommonSearchParams(params, engines, options);

    const headers = {};
    if (CF_SEARCH_TOKEN) {
      headers.Authorization = `Bearer ${CF_SEARCH_TOKEN}`;
    }

    const url = getApiEndpoint(path);
    url.search = params.toString();
    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to call ${path}: ${error.message}`);
  }
}

async function callWorkerContentAPI(targetUrl, options = {}) {
  try {
    const params = new URLSearchParams({ url: targetUrl });

    if (Number.isInteger(options.max_bytes)) {
      params.append("max_bytes", String(options.max_bytes));
    }

    const headers = {};
    if (CF_SEARCH_TOKEN) {
      headers.Authorization = `Bearer ${CF_SEARCH_TOKEN}`;
    }

    const url = getApiEndpoint("content");
    url.search = params.toString();
    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to call content: ${error.message}`);
  }
}

/**
 * Call the Cloudflare Search API
 */
async function searchAPI(query, engines = null, options = {}) {
  return callWorkerAPI("search", query, engines, options);
}

async function researchAPI(query, engines = null, options = {}) {
  return callWorkerAPI("research", query, engines, options);
}

async function contentAPI(targetUrl, options = {}) {
  return callWorkerContentAPI(targetUrl, options);
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: "cloudflare-search",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const SEARCH_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "The search query string",
    },
    engines: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "bing",
          "startpage",
          "mojeek",
          "duckduckgo",
          "brave",
          "qwant",
          "yahoo",
        ],
      },
      description:
        "Optional: Array of search engines to use. If not specified, uses default engines. " +
        "Available engines: bing, startpage, mojeek, duckduckgo, brave, qwant, yahoo",
    },
    language: {
      type: "string",
      description: "Optional language/region hint, for example en or zh-CN",
    },
    location: {
      type: "string",
      description:
        "Optional location hint. Defaults to off on the Worker. Use auto to append the Cloudflare visitor city/region, or pass an explicit place.",
    },
    time_range: {
      type: "string",
      enum: ["day", "week", "month", "year"],
      description: "Optional time range filter",
    },
    pageno: {
      type: "integer",
      minimum: 0,
      description: "Optional zero-based page number",
    },
    min_authority_score: {
      type: "number",
      description:
        "Optional minimum deterministic source authority score. For example, 1 excludes unknown or negatively scored sources.",
    },
    include_source_types: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Optional source types to include, such as official, benchmark, paper, media, model_repo.",
    },
    exclude_source_types: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Optional source types to exclude, such as community, blog, low_credibility, disinformation.",
    },
  },
  required: ["query"],
};

const RESEARCH_INPUT_SCHEMA = {
  ...SEARCH_INPUT_SCHEMA,
  properties: {
    ...SEARCH_INPUT_SCHEMA.properties,
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 5,
      description:
        "Optional number of top search results to fetch and extract. Defaults to 3.",
    },
    excerpt_chars: {
      type: "integer",
      minimum: 200,
      maximum: 4000,
      description:
        "Optional maximum characters returned per extracted source excerpt. Defaults to 1200.",
    },
    max_bytes: {
      type: "integer",
      minimum: 50000,
      maximum: 5000000,
      description:
        "Optional maximum bytes to read from each source page. Defaults to 1500000.",
    },
  },
};

const CONTENT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "The page URL to fetch and extract readable content from",
    },
    max_bytes: {
      type: "integer",
      minimum: 50000,
      maximum: 5000000,
      description:
        "Optional maximum bytes to read from the source page. Defaults to 1500000.",
    },
    max_chars: {
      type: "integer",
      minimum: 500,
      maximum: 20000,
      description:
        "Optional maximum extracted text characters to return in the MCP response. Defaults to 4000.",
    },
  },
  required: ["url"],
};

function formatSearchResponse(result) {
  const formattedResults = result.results
    .map((item, index) => {
      return `${index + 1}. [${item.engine.toUpperCase()}] ${item.title}\n   ${item.description}\n   ${item.url}\n   Source: ${item.source_type || "unknown"} (${item.authority_score ?? 0})`;
    })
    .join("\n\n");

  return [
    `Search Query: "${result.query}"`,
    result.effective_query && result.effective_query !== result.query
      ? `Effective Query: "${result.effective_query}"`
      : null,
    result.location
      ? `Location: ${result.location} (${result.location_source})`
      : null,
    `Total Results: ${result.number_of_results}`,
    `Engines Used: ${result.enabled_engines.join(", ")}`,
    result.unresponsive_engines.length > 0
      ? `Unresponsive Engines: ${result.unresponsive_engines.join(", ")}`
      : null,
    result.source_filters
      ? `Source Filters: ${JSON.stringify(result.source_filters)}`
      : null,
    "",
    "Results:",
    formattedResults,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatResearchSource(source) {
  if (source.status === "error") {
    return [
      `${source.index}. [${source.engine.toUpperCase()}] ${source.title}`,
      `   ${source.url}`,
      `   Source: ${source.source_type || "unknown"} (${source.authority_score ?? 0})`,
      `   Read failed: ${source.error?.code || "ERROR"} - ${source.error?.message || "Unknown error"}`,
    ].join("\n");
  }

  if (source.status === "skipped") {
    return [
      `${source.index}. [${source.engine.toUpperCase()}] ${source.title}`,
      `   ${source.url}`,
      `   Source: ${source.source_type || "unknown"} (${source.authority_score ?? 0})`,
      `   Skipped: ${source.reason?.code || "SKIPPED"} - ${source.reason?.message || "Source did not pass quality checks"}`,
    ].join("\n");
  }

  return [
    `${source.index}. [${source.engine.toUpperCase()}] ${source.title}`,
    `   ${source.url}`,
    `   Source: ${source.source_type || "unknown"} (${source.authority_score ?? 0})`,
    source.source_description
      ? `   Description: ${source.source_description}`
      : null,
    `   Extractor: ${source.extractor || "unknown"}`,
    "",
    source.excerpt,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatResearchResponse(result) {
  const formattedSources = result.sources.map(formatResearchSource).join("\n\n");

  return [
    `Research Query: "${result.query}"`,
    result.effective_query && result.effective_query !== result.query
      ? `Effective Query: "${result.effective_query}"`
      : null,
    result.location
      ? `Location: ${result.location} (${result.location_source})`
      : null,
    `Search Results: ${result.number_of_results}`,
    `Sources Read: ${result.read_count}`,
    result.failed_count > 0 ? `Sources Failed: ${result.failed_count}` : null,
    result.skipped_count > 0 ? `Sources Skipped: ${result.skipped_count}` : null,
    result.source_filters
      ? `Source Filters: ${JSON.stringify(result.source_filters)}`
      : null,
    `Engines Used: ${result.enabled_engines.join(", ")}`,
    "",
    "Extracted Sources:",
    formattedSources,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeMcpMaxChars(value) {
  if (!Number.isInteger(value)) {
    return 4000;
  }

  return Math.min(Math.max(value, 500), 20000);
}

function formatContentResponse(result, maxChars) {
  const text = String(result.text || result.excerpt || "");
  const excerpt =
    text.length > maxChars
      ? `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} characters]`
      : text;

  return [
    `URL: ${result.url || result.requested_url}`,
    result.requested_url && result.requested_url !== result.url
      ? `Requested URL: ${result.requested_url}`
      : null,
    result.title ? `Title: ${result.title}` : null,
    result.description ? `Description: ${result.description}` : null,
    `Extractor: ${result.extractor || "unknown"}`,
    result.stats?.text_length
      ? `Text Length: ${result.stats.text_length}`
      : null,
    "",
    "Text:",
    excerpt,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Handler for listing available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "web_search",
        description:
          "Search the web for current information, news, or any topic. " +
          "Uses the configured fallback order across Startpage, DuckDuckGo, Brave, Mojeek, Bing, Qwant, and Yahoo " +
          "when results are insufficient. Returns deduplicated source URLs. " +
          "Use this when you need real-time information not in your training data. ",
        inputSchema: SEARCH_INPUT_SCHEMA,
      },
      {
        name: "search",
        description:
          "Search through the Cloudflare Workers search gateway and return deduplicated results. " +
          "The gateway uses prioritized fallback with source attribution for each result.",
        inputSchema: SEARCH_INPUT_SCHEMA,
      },
      {
        name: "research",
        description:
          "Search the web and fetch readable excerpts from the top results. " +
          "Use this when you need source-grounded context, citations, or article snippets rather than links only.",
        inputSchema: RESEARCH_INPUT_SCHEMA,
      },
      {
        name: "content",
        description:
          "Fetch a specific URL through the Cloudflare Search Worker and extract readable page text. " +
          "Use this after search/research when you need to inspect one source in more detail.",
        inputSchema: CONTENT_INPUT_SCHEMA,
      },
    ],
  };
});

/**
 * Handler for tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (
    request.params.name !== "search" &&
    request.params.name !== "web_search" &&
    request.params.name !== "research" &&
    request.params.name !== "content"
  ) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  if (!request.params.arguments) {
    throw new Error("Missing arguments");
  }

  const {
    query,
    engines,
    language,
    location,
    time_range,
    pageno,
    limit,
    excerpt_chars,
    max_bytes,
    min_authority_score,
    include_source_types,
    exclude_source_types,
    url,
    max_chars,
  } =
    request.params.arguments;

  if (request.params.name === "content") {
    if (!url || typeof url !== "string") {
      throw new Error("URL must be a non-empty string");
    }

    try {
      const options = {};

      if (Number.isInteger(max_bytes)) {
        options.max_bytes = max_bytes;
      }

      const result = await contentAPI(url, options);
      return {
        content: [
          {
            type: "text",
            text: formatContentResponse(result, normalizeMcpMaxChars(max_chars)),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Content extraction failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (!query || typeof query !== "string") {
    throw new Error("Query must be a non-empty string");
  }

  try {
    const options = {
      language,
      location,
      time_range,
      pageno,
    };
    const isResearch = request.params.name === "research";

    if (Number.isInteger(limit)) {
      options.limit = limit;
    }

    if (Number.isInteger(excerpt_chars)) {
      options.excerpt_chars = excerpt_chars;
    }

    if (Number.isInteger(max_bytes)) {
      options.max_bytes = max_bytes;
    }

    if (Number.isFinite(min_authority_score)) {
      options.min_authority_score = min_authority_score;
    }

    if (Array.isArray(include_source_types)) {
      options.include_source_types = include_source_types;
    }

    if (Array.isArray(exclude_source_types)) {
      options.exclude_source_types = exclude_source_types;
    }

    const result = isResearch
      ? await researchAPI(query, engines, options)
      : await searchAPI(query, engines, options);
    const summary = isResearch
      ? formatResearchResponse(result)
      : formatSearchResponse(result);

    return {
      content: [
        {
          type: "text",
          text: summary,
        },
      ],
    };
  } catch (error) {
    const action = request.params.name === "research" ? "Research" : "Search";

    return {
      content: [
        {
          type: "text",
          text: `${action} failed: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Cloudflare Search MCP Server running on stdio");
  console.error(`Connected to: ${CF_SEARCH_URL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
