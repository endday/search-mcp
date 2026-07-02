#!/usr/bin/env node

import { loadMcpConfig } from "../src/mcp/config.js";
import { searchLocal } from "../src/mcp/local/search.js";
import { handleContent } from "../src/mcp/tools/content.js";

const SEARCH_CASES = [
  {
    id: "en_official",
    query: "cloudflare workers",
    engines: ["bing", "brave", "yahoo", "mojeek"],
  },
  {
    id: "en_model",
    query: "OpenAI GPT-5",
    engines: ["bing", "brave", "yahoo", "mojeek"],
  },
  {
    id: "zh_brand",
    query: "深度求索 V4",
    engines: ["baidu", "bing"],
  },
];

const CONTENT_CASES = [
  {
    id: "content_cf",
    url: "https://www.cloudflare.com/developer-platform/products/workers/",
    max_chars: 2000,
  },
  {
    id: "content_openai",
    url: "https://openai.com/gpt-5",
    max_chars: 2000,
  },
];

function pickConfig() {
  const config = loadMcpConfig();
  return {
    ...config,
    mode: process.env.MCP_SMOKE_MODE || config.mode,
  };
}

function summarizeSearch(result) {
  return result.results.slice(0, 5).map((item, index) => ({
    rank: index + 1,
    title: item.title,
    url: item.url,
    engine: item.engine,
    source_type: item.source_type,
    authority_score: item.authority_score,
  }));
}

async function runSearchCases(config) {
  console.log("\nSearch smoke\n");

  for (const searchCase of SEARCH_CASES) {
    const startedAt = Date.now();
    try {
      const result = await searchLocal(searchCase.query, searchCase.engines, {
        clientId: config.localClientId,
      });
      console.log(
        JSON.stringify(
          {
            id: searchCase.id,
            query: searchCase.query,
            duration_ms: Date.now() - startedAt,
            result_count: result.number_of_results,
            top_results: summarizeSearch(result),
          },
          null,
          2
        )
      );
    } catch (error) {
      console.log(
        JSON.stringify(
          {
            id: searchCase.id,
            query: searchCase.query,
            duration_ms: Date.now() - startedAt,
            error: error.message,
          },
          null,
          2
        )
      );
    }
  }
}

async function runContentCases(config) {
  console.log("\nContent smoke\n");

  for (const contentCase of CONTENT_CASES) {
    const startedAt = Date.now();
    const result = await handleContent(config, contentCase);
    const text = result.content?.[0]?.text || "";
    console.log(
      JSON.stringify(
        {
          id: contentCase.id,
          url: contentCase.url,
          duration_ms: Date.now() - startedAt,
          is_error: !!result.isError,
          preview: text.slice(0, 500),
        },
        null,
        2
      )
    );
  }
}

async function main() {
  const config = pickConfig();
  console.log(
    JSON.stringify(
      {
        mode: config.mode,
        local_client_id: config.localClientId,
      },
      null,
      2
    )
  );

  await runSearchCases(config);
  await runContentCases(config);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
