import assert from "node:assert/strict";
import { test } from "node:test";

import { loadMcpConfig } from "../src/mcp/config.js";
import { createServer } from "../src/mcp/server.js";
import { handleNewsSearch } from "../src/mcp/tools/newsSearch.js";
import { handleWebSearch } from "../src/mcp/tools/webSearch.js";
import { handleContent } from "../src/mcp/tools/content.js";
import { handleJinaContent } from "../src/mcp/tools/jinaContent.js";
import { fetchSearchText } from "../src/search/engineRequest.js";
import { resetUpstreamSessionState } from "../src/search/upstreamSession.js";

function createSearchFixture() {
  return `
    <html>
      <body>
        <main id="b_results">
          <li class="b_algo">
            <h2><a href="https://example.com/workers">Cloudflare Workers Guide</a></h2>
            <div class="b_caption"><p>Deploy JavaScript globally.</p></div>
          </li>
          <li class="b_algo">
            <h2><a href="https://example.com/kv">Workers KV</a></h2>
            <div class="b_caption"><p>Store data close to users.</p></div>
          </li>
        </main>
      </body>
    </html>
  `;
}

function withFetchStub(handler, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      globalThis.fetch = originalFetch;
    });
}

test("loadMcpConfig defaults to local mode", () => {
  const previous = process.env.SEARCH_MCP_MODE;
  const previousSupported = process.env.SUPPORTED_ENGINES;
  const previousClientId = process.env.SEARCH_MCP_CLIENT_ID;
  const previousUpstreamClient = process.env.SEARCH_MCP_UPSTREAM_CLIENT;
  delete process.env.SEARCH_MCP_MODE;
  process.env.SUPPORTED_ENGINES = "bing,toutiao";
  process.env.SEARCH_MCP_CLIENT_ID = "mcp-test-client";
  process.env.SEARCH_MCP_UPSTREAM_CLIENT = "impit";

  try {
    const config = loadMcpConfig();
    assert.equal(config.mode, "local");
    assert.deepEqual(config.allEngines, ["bing", "toutiao"]);
    assert.equal(config.localClientId, "mcp-test-client");
    assert.equal(config.upstreamClient, "impit");
  } finally {
    if (previous === undefined) {
      delete process.env.SEARCH_MCP_MODE;
    } else {
      process.env.SEARCH_MCP_MODE = previous;
    }

    if (previousSupported === undefined) {
      delete process.env.SUPPORTED_ENGINES;
    } else {
      process.env.SUPPORTED_ENGINES = previousSupported;
    }

    if (previousClientId === undefined) {
      delete process.env.SEARCH_MCP_CLIENT_ID;
    } else {
      process.env.SEARCH_MCP_CLIENT_ID = previousClientId;
    }

    if (previousUpstreamClient === undefined) {
      delete process.env.SEARCH_MCP_UPSTREAM_CLIENT;
    } else {
      process.env.SEARCH_MCP_UPSTREAM_CLIENT = previousUpstreamClient;
    }
  }
});

test("handleWebSearch uses local search path", async () => {
  const config = {
    mode: "local",
    jinaApiKey: "",
    jinaBaseUrl: "https://r.jina.ai/",
    localClientId: "mcp-local:test-search",
    allEngines: ["bing", "toutiao"],
  };

  await withFetchStub(async (url) => {
    const hostname = new URL(String(url)).hostname;
    if (hostname.includes("bing.com")) {
      return new Response(createSearchFixture(), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    throw new Error(`unexpected fetch ${url}`);
  }, async () => {
    const result = await handleWebSearch(config, {
      query: "cloudflare workers",
      engines: ["bing"],
    });

    assert.equal(result.isError, undefined);
    assert.match(result.content[0].text, /Cloudflare Workers Guide/);
    assert.match(result.content[0].text, /https:\/\/example.com\/workers/);
  });
});

test("handleNewsSearch uses explicit news search path", async () => {
  const config = {
    mode: "local",
    jinaApiKey: "",
    jinaBaseUrl: "https://r.jina.ai/",
    localClientId: "mcp-local:test-news",
    allEngines: ["bing", "yahoo", "brave"],
  };

  await withFetchStub(async (url) => {
    const value = String(url);
    if (value.includes("/news/search?") && value.includes("bing.com")) {
      return new Response(
        `<?xml version="1.0" encoding="utf-8" ?>
        <rss version="2.0">
          <channel>
            <item>
              <title>DeepSeek headline</title>
              <link>http://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.com%2Fdeepseek-news</link>
              <description>DeepSeek article summary.</description>
              <pubDate>Mon, 30 Jun 2026 10:00:00 GMT</pubDate>
              <News:Source>Example News</News:Source>
            </item>
          </channel>
        </rss>`,
        {
          status: 200,
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        }
      );
    }

    if (value.includes("search.yahoo.com")) {
      return new Response("<html><body></body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (value.includes("search.brave.com")) {
      return new Response("<html><body></body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    throw new Error(`unexpected fetch ${url}`);
  }, async () => {
    const result = await handleNewsSearch(config, {
      query: "DeepSeek",
      engines: ["bing"],
      count: 1,
      search_lang: "en-US",
    });

    assert.equal(result.isError, undefined);
    assert.match(result.content[0].text, /DeepSeek headline/);
    assert.match(result.content[0].text, /source: Example News/);
  });
});

test("handleWebSearch isolates local upstream session by client id", async () => {
  const observedCookies = [];

  await withFetchStub(async (url, init = {}) => {
    observedCookies.push(
      init.headers?.get?.("cookie") ||
        init.headers?.cookie ||
        init.headers?.["cookie"] ||
        ""
    );
    return new Response("<html><body>ok</body></html>", {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "set-cookie": "sessionpref=1; Path=/; HttpOnly",
      },
    });
  }, async () => {
    resetUpstreamSessionState();

    await fetchSearchText("https://search.brave.com/search?q=workers", {
      engine: "brave",
      engineLabel: "Brave",
      clientId: "mcp-local:b",
    });
    await fetchSearchText("https://search.brave.com/search?q=workers", {
      engine: "brave",
      engineLabel: "Brave",
      clientId: "mcp-local:a",
    });
    await fetchSearchText("https://search.brave.com/search?q=workers", {
      engine: "brave",
      engineLabel: "Brave",
      clientId: "mcp-local:b",
    });

    assert.equal(observedCookies.length, 3);
    assert.doesNotMatch(observedCookies[0], /sessionpref=1/);
    assert.doesNotMatch(observedCookies[1], /sessionpref=1/);
    assert.match(observedCookies[2], /sessionpref=1/);
  });
});

test("handleContent uses local content extraction path", async () => {
  const config = {
    mode: "local",
    jinaApiKey: "",
    jinaBaseUrl: "https://r.jina.ai/",
    allEngines: ["bing"],
  };

  const articleHtml = `
    <html>
      <head><title>Example Article</title></head>
      <body>
        <article>
          <h1>Example Article</h1>
          <p>This is a readable article body with enough text to pass extraction.</p>
          <p>It includes multiple paragraphs so the content extractor has enough signal.</p>
        </article>
      </body>
    </html>
  `;

  await withFetchStub(async () => {
    return new Response(articleHtml, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }, async () => {
    const result = await handleContent(config, {
      url: "https://example.com/article",
      max_chars: 2000,
    });

    assert.equal(result.isError, undefined);
    assert.match(result.content[0].text, /Example Article/);
    assert.match(result.content[0].text, /readable article body/i);
  });
});

test("handleContent allows realistic page sizes for local extraction", async () => {
  const config = {
    mode: "local",
    jinaApiKey: "",
    jinaBaseUrl: "https://r.jina.ai/",
    allEngines: ["bing"],
  };

  const largeArticleHtml = `
    <html>
      <head><title>Large Article</title></head>
      <body>
        <article>
          <h1>Large Article</h1>
          ${"<p>Cloudflare Workers local content extraction should tolerate normal large HTML pages with repeated layout and article text.</p>".repeat(800)}
        </article>
      </body>
    </html>
  `;

  await withFetchStub(async () => {
    return new Response(largeArticleHtml, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }, async () => {
    const result = await handleContent(config, {
      url: "https://example.com/large-article",
      max_chars: 2000,
    });

    assert.equal(result.isError, undefined);
    assert.match(result.content[0].text, /Large Article/);
  });
});

test("handleJinaContent truncates response text", async () => {
  const config = {
    mode: "local",
    jinaApiKey: "",
    jinaBaseUrl: "https://r.jina.ai/",
    allEngines: ["bing"],
  };

  await withFetchStub(async () => {
    return new Response("x".repeat(6000), {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }, async () => {
    const result = await handleJinaContent(config, {
      url: "https://example.com/page",
      max_chars: 500,
    });

    assert.equal(result.isError, undefined);
    assert.match(result.content[0].text, /\[\.\.\./);
  });
});

test("createServer registers expected MCP tools", async () => {
  const config = {
    mode: "local",
    jinaApiKey: "",
    jinaBaseUrl: "https://r.jina.ai/",
    allEngines: ["bing", "toutiao"],
  };

  const server = createServer(config);
  assert.ok(server);
});

test("package root exports library entrypoints without starting the CLI", async () => {
  const pkg = await import("../index.js");

  assert.equal(typeof pkg.main, "function");
  assert.equal(typeof pkg.searchLocal, "function");
  assert.equal(typeof pkg.searchAll, "function");
  assert.equal(typeof pkg.searchAllWithMeta, "function");
  assert.equal(typeof pkg.createServer, "function");
  assert.equal(typeof pkg.startServer, "function");
  assert.equal(typeof pkg.loadMcpConfig, "function");
  assert.equal(typeof pkg.setEnv, "function");
  assert.ok(pkg.env);
});
