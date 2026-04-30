import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";

import worker from "../worker.js";
import { resetHealthState } from "../utils/health.js";
import { resetRateLimitState } from "../utils/rateLimit.js";
import { resetStartpageRequestState } from "../utils/searchStartpage.js";

const originalFetch = globalThis.fetch;

const fixture = (name) =>
  readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const fixtures = {
  bing: await fixture("bing.html"),
  startpage: await fixture("startpage.html"),
  duckduckgo: await fixture("duckduckgo.html"),
  mojeek: await fixture("mojeek.html"),
  qwant: await fixture("qwant.html"),
  yahoo: await fixture("yahoo.html"),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class MemoryKv {
  constructor() {
    this.store = new Map();
  }

  async get(key, type) {
    const item = this.store.get(key);
    if (!item) {
      return null;
    }

    if (item.expiresAt && item.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return type === "json" ? JSON.parse(item.value) : item.value;
  }

  async put(key, value, options = {}) {
    const expirationTtl = options.expirationTtl || 0;
    this.store.set(key, {
      value,
      expiresAt: expirationTtl > 0 ? Date.now() + expirationTtl * 1000 : 0,
    });
  }
}

function createSearchRequest(path, init = {}, cf) {
  const request = new Request(`https://search.example.test${path}`, init);

  if (cf) {
    Object.defineProperty(request, "cf", {
      value: cf,
    });
  }

  return request;
}

function getEngineName(url) {
  const hostname = new URL(String(url)).hostname;

  if (hostname.includes("bing.com")) {
    return "bing";
  }

  if (hostname.includes("startpage.com")) {
    return "startpage";
  }

  if (hostname.includes("duckduckgo.com")) {
    return "duckduckgo";
  }

  if (hostname.includes("mojeek.com")) {
    return "mojeek";
  }

  if (hostname.includes("qwant.com")) {
    return "qwant";
  }

  if (hostname.includes("search.yahoo.com")) {
    return "yahoo";
  }

  throw new Error(`Unhandled fetch URL: ${url}`);
}

function installFetchStub(responses = {}) {
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    const engineName = getEngineName(url);
    const requestUrl = new URL(String(url));

    if (!(engineName === "startpage" && requestUrl.pathname === "/")) {
      calls.push(engineName);
    }

    const response = responses[engineName] ?? fixtures[engineName];
    if (response instanceof Error) {
      throw response;
    }

    if (typeof response === "function") {
      return response(url, init);
    }

    return new Response(response, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  };

  return calls;
}

function installBrowserRenderingStub(handler) {
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    const requestUrl = new URL(String(url));

    if (
      requestUrl.hostname !== "api.cloudflare.com" ||
      !requestUrl.pathname.endsWith("/browser-rendering/markdown")
    ) {
      return new Response(null, {
        status: 204,
      });
    }

    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({
      url: String(url),
      method: init.method,
      authorization: init.headers?.Authorization,
      body,
    });

    if (handler) {
      return handler(url, init, body);
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: {
          markdown: "# Example\n\nRendered content",
          title: "Example",
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "X-Browser-Ms-Used": "4200",
        },
      }
    );
  };

  return calls;
}

function installHtmlFetchStub(html, options = {}) {
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      headers: init.headers || {},
    });

    return new Response(html, {
      status: options.status || 200,
      headers: {
        "content-type": options.contentType || "text/html; charset=utf-8",
        ...(options.headers || {}),
      },
    });
  };

  return calls;
}

function createEnv(overrides = {}) {
  return {
    DEFAULT_ENGINES: "bing",
    DEFAULT_TIMEOUT: "1000",
    FALLBACK_MIN_RESULTS: "1",
    CACHE_TTL_SECONDS: "0",
    RATE_LIMIT_MAX_REQUESTS: "0",
    ...overrides,
  };
}

beforeEach(() => {
  resetHealthState();
  resetRateLimitState();
  resetStartpageRequestState();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetHealthState();
  resetRateLimitState();
});

test("handles GET /search requests", async () => {
  installFetchStub();

  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare"),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.enabled_engines[0], "bing");
  assert.equal(payload.results[0].engine, "bing");
  assert.equal(response.headers.get("X-Search-Cache"), "miss");
  assert.equal(response.headers.get("X-Search-Fallback-Path"), "bing");
  assert.ok(response.headers.get("X-Search-Request-Id"));
  assert.ok(response.headers.get("Server-Timing")?.includes("bing;dur="));
});

test("uses request.cf city as default auto location", async () => {
  installFetchStub();

  const response = await worker.fetch(
    createSearchRequest(
      "/search?q=%E6%98%8E%E5%A4%A9%E5%A4%A9%E6%B0%94%E5%A6%82%E4%BD%95",
      {},
      {
        city: "上海",
        region: "Shanghai",
        country: "CN",
        timezone: "Asia/Shanghai",
      }
    ),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.query, "明天天气如何");
  assert.equal(payload.effective_query, "明天天气如何 上海");
  assert.equal(payload.location, "上海");
  assert.equal(payload.location_source, "auto");
  assert.deepEqual(payload.location_context.client, {
    city: "上海",
    region: "Shanghai",
    country: "CN",
    timezone: "Asia/Shanghai",
  });
});

test("returns Cloudflare visitor geo metadata", async () => {
  const response = await worker.fetch(
    createSearchRequest(
      "/geo",
      {
        headers: {
          "cf-connecting-ip": "203.0.113.20",
        },
      },
      {
        city: "上海",
        region: "Shanghai",
        regionCode: "SH",
        country: "CN",
        continent: "AS",
        timezone: "Asia/Shanghai",
        latitude: "31.2304",
        longitude: "121.4737",
        colo: "PVG",
        asn: 64512,
        asOrganization: "Example Network",
      }
    ),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.geo.ip, "203.0.113.20");
  assert.equal(payload.geo.city, "上海");
  assert.equal(payload.geo.region_code, "SH");
  assert.equal(payload.geo.country, "CN");
  assert.equal(payload.geo.colo, "PVG");
  assert.equal(payload.geo.as_organization, "Example Network");
});

test("renders a URL to markdown through Cloudflare Browser Rendering", async () => {
  const calls = installBrowserRenderingStub();

  const response = await worker.fetch(
    createSearchRequest(
      "/markdown?url=https%3A%2F%2Fexample.com%2Farticle&wait_until=networkidle2&wait_for_selector=main",
      {
        headers: {
          Authorization: "Bearer secret",
        },
      }
    ),
    createEnv({
      TOKEN: "secret",
      CF_BROWSER_RENDERING_ACCOUNT_ID: "account-id",
      CF_BROWSER_RENDERING_API_TOKEN: "browser-token",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.url, "https://example.com/article");
  assert.equal(payload.source, "cloudflare-browser-rendering");
  assert.equal(payload.markdown, "# Example\n\nRendered content");
  assert.equal(payload.metadata.title, "Example");
  assert.equal(payload.browser_ms_used, 4200);
  assert.equal(response.headers.get("X-Browser-Ms-Used"), "4200");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].authorization, "Bearer browser-token");
  assert.equal(calls[0].body.url, "https://example.com/article");
  assert.equal(calls[0].body.gotoOptions.waitUntil, "networkidle2");
  assert.equal(calls[0].body.waitForSelector.selector, "main");
});

test("requires Browser Rendering configuration for markdown endpoint", async () => {
  const response = await worker.fetch(
    createSearchRequest("/markdown?url=https%3A%2F%2Fexample.com"),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.code, "BROWSER_RENDERING_NOT_CONFIGURED");
});

test("rejects private network markdown targets", async () => {
  const response = await worker.fetch(
    createSearchRequest("/markdown?url=http%3A%2F%2F127.0.0.1%2Fadmin"),
    createEnv({
      CF_BROWSER_RENDERING_ACCOUNT_ID: "account-id",
      CF_BROWSER_RENDERING_API_TOKEN: "browser-token",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, "INVALID_URL");
});

test("rejects markdown targets that redirect to private networks", async () => {
  let browserRenderingCalls = 0;

  globalThis.fetch = async (url) => {
    const requestUrl = new URL(String(url));
    if (requestUrl.hostname === "api.cloudflare.com") {
      browserRenderingCalls += 1;
      return new Response(JSON.stringify({ success: true, result: "" }));
    }

    return new Response(null, {
      status: 302,
      headers: {
        location: "http://127.0.0.1/admin",
      },
    });
  };

  const response = await worker.fetch(
    createSearchRequest("/markdown?url=https%3A%2F%2Fexample.com%2Fstart", {
      headers: {
        Authorization: "Bearer secret",
      },
    }),
    createEnv({
      TOKEN: "secret",
      CF_BROWSER_RENDERING_ACCOUNT_ID: "account-id",
      CF_BROWSER_RENDERING_API_TOKEN: "browser-token",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, "INVALID_URL");
  assert.equal(browserRenderingCalls, 0);
});

test("fetches and extracts readable content without browser rendering", async () => {
  const calls = installHtmlFetchStub(`<!doctype html>
    <html lang="zh-CN">
      <head>
        <title>页面标题</title>
        <meta name="description" content="页面摘要">
        <meta property="article:published_time" content="2026-04-30">
      </head>
      <body>
        <header>站点导航 首页 关于</header>
        <nav><a href="/a">广告链接</a><a href="/b">更多链接</a></nav>
        <main>
          <article class="post-content">
            <h1>真正的正文标题</h1>
            <p>这是第一段正文，包含足够的信息，应该被保留下来，而不是被导航区域干扰。</p>
            <p>这是第二段正文，继续提供页面主要内容，用来测试正文密度评分和段落数量。</p>
            <p>这是第三段正文，带有更多中文标点，说明这个接口适合直接获取服务端返回的 HTML 正文。</p>
          </article>
        </main>
        <footer>页脚 联系方式</footer>
      </body>
    </html>`);

  const response = await worker.fetch(
    createSearchRequest("/content?url=https%3A%2F%2Fexample.com%2Fpost"),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.url, "https://example.com/post");
  assert.equal(payload.source, "direct-fetch");
  assert.ok(["readability", "heuristic"].includes(payload.extractor));
  assert.equal(payload.title, "页面标题");
  assert.equal(payload.description, "页面摘要");
  assert.equal(payload.metadata.published_time, "2026-04-30");
  assert.match(payload.html, /真正的正文标题/);
  assert.match(payload.text, /这是第一段正文/);
  assert.doesNotMatch(payload.text, /站点导航/);
  assert.doesNotMatch(payload.text, /页脚/);
  assert.ok(payload.stats.text_length > 80);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.com/post");
});

test("enforces content fetch response size limits", async () => {
  installHtmlFetchStub("<html></html>", {
    headers: {
      "content-length": "5000001",
    },
  });

  const response = await worker.fetch(
    createSearchRequest("/content?url=https%3A%2F%2Fexample.com%2Flarge&max_bytes=50000"),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 413);
  assert.equal(payload.code, "CONTENT_TOO_LARGE");
});

test("rejects private network content targets", async () => {
  const response = await worker.fetch(
    createSearchRequest("/content?url=http%3A%2F%2F192.168.1.10%2Fadmin"),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, "INVALID_URL");
});

test("rejects IPv6 private and IPv4-mapped content targets", async () => {
  const blockedTargets = [
    "http://[fc00::1]/admin",
    "http://[fe80::1]/admin",
    "http://[::ffff:127.0.0.1]/admin",
  ];

  for (const target of blockedTargets) {
    const response = await worker.fetch(
      createSearchRequest(`/content?url=${encodeURIComponent(target)}`),
      createEnv()
    );
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, "INVALID_URL");
  }
});

test("rejects content targets that redirect to private networks", async () => {
  globalThis.fetch = async () =>
    new Response(null, {
      status: 302,
      headers: {
        location: "http://192.168.1.10/admin",
      },
    });

  const response = await worker.fetch(
    createSearchRequest("/content?url=https%3A%2F%2Fexample.com%2Fstart"),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, "INVALID_URL");
});

test("keeps html endpoint as a content alias", async () => {
  installHtmlFetchStub("<html><body><main><p>Alias content has enough readable text to pass extraction.</p><p>Second paragraph keeps the candidate useful.</p></main></body></html>");

  const response = await worker.fetch(
    createSearchRequest("/html?url=https%3A%2F%2Fexample.com%2Falias"),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.source, "direct-fetch");
  assert.ok(["readability", "heuristic"].includes(payload.extractor));
  assert.match(payload.text, /Alias content/);
});

test("allows explicit location and location opt-out", async () => {
  installFetchStub();

  const explicitResponse = await worker.fetch(
    createSearchRequest("/search?q=weather&location=Hong%20Kong"),
    createEnv()
  );
  const explicitPayload = await explicitResponse.json();

  assert.equal(explicitResponse.status, 200);
  assert.equal(explicitPayload.effective_query, "weather Hong Kong");
  assert.equal(explicitPayload.location_source, "explicit");

  const disabledResponse = await worker.fetch(
    createSearchRequest(
      "/search?q=weather&location=off",
      {},
      {
        city: "上海",
      }
    ),
    createEnv()
  );
  const disabledPayload = await disabledResponse.json();

  assert.equal(disabledResponse.status, 200);
  assert.equal(disabledPayload.effective_query, "weather");
  assert.equal(disabledPayload.location, null);
  assert.equal(disabledPayload.location_source, "disabled");
});

test("returns JSON for unknown routes", async () => {
  const response = await worker.fetch(createSearchRequest("/missing"), createEnv());
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.code, "NOT_FOUND");
  assert.ok(response.headers.get("X-Search-Request-Id"));
});

test("supports configurable CORS preflight responses", async () => {
  const response = await worker.fetch(
    createSearchRequest("/search", {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.example.test",
        "Access-Control-Request-Headers": "authorization,content-type,x-custom-header",
      },
    }),
    createEnv({
      CORS_ALLOWED_ORIGINS: "https://app.example.test",
    })
  );

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://app.example.test"
  );
  assert.equal(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization,content-type,x-custom-header"
  );
  assert.ok(response.headers.get("X-Search-Request-Id"));
});

test("renders token input on homepage when auth is enabled", async () => {
  const response = await worker.fetch(
    createSearchRequest("/"),
    createEnv({
      TOKEN: "secret",
    })
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /id="tokenInput"/);
  assert.match(html, /\/auth\/verify/);
  assert.match(html, /id="geoSummary"/);
  assert.match(html, /\/geo/);
  assert.match(html, /data-tab-target="api"/);
  assert.match(html, /data-tab-panel="mcp"/);
  assert.doesNotMatch(html, /resultsContainer\.innerHTML\s*=\s*data\.results/);
  assert.match(html, /document\.createElement/);
});

test("renders token input on homepage when auth is required by config", async () => {
  const response = await worker.fetch(
    createSearchRequest("/"),
    createEnv({
      AUTH_REQUIRED: "true",
    })
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /id="tokenInput"/);
  assert.match(html, /AUTH_REQUIRED is enabled|需要配置 TOKEN/);
});

test("handles JSON POST /search requests", async () => {
  installFetchStub();

  const response = await worker.fetch(
    createSearchRequest("/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        q: "cloudflare",
        engines: ["startpage"],
      }),
    }),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.enabled_engines, ["startpage"]);
  assert.equal(payload.results[0].engine, "startpage");
});

test("handles form POST /search requests", async () => {
  installFetchStub();

  const response = await worker.fetch(
    createSearchRequest("/search", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "q=cloudflare&engines=duckduckgo",
    }),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.enabled_engines, ["duckduckgo"]);
  assert.equal(payload.results[0].engine, "duckduckgo");
});

test("handles newly added Qwant and Yahoo engines", async () => {
  const calls = installFetchStub();

  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare&engines=qwant,yahoo"),
    createEnv({
      FALLBACK_MIN_RESULTS: "1",
      HEDGED_FALLBACK_DELAY_MS: "1000",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.enabled_engines, ["qwant", "yahoo"]);
  assert.deepEqual(calls, ["qwant", "yahoo"]);
  assert.equal(response.headers.get("X-Search-Fallback-Path"), "qwant,yahoo");
});

test("rejects requests without configured token", async () => {
  installFetchStub();

  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare"),
    createEnv({
      TOKEN: "secret",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.code, "UNAUTHORIZED");
});

test("fails closed when auth is required but token secret is missing", async () => {
  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare"),
    createEnv({
      AUTH_REQUIRED: "true",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.code, "AUTH_TOKEN_NOT_CONFIGURED");
});

test("verifies valid token through auth endpoint", async () => {
  const response = await worker.fetch(
    createSearchRequest("/auth/verify", {
      headers: {
        Authorization: "Bearer secret",
      },
    }),
    createEnv({
      TOKEN: "secret",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.authorized, true);
  assert.equal(payload.token_required, true);
});

test("returns normal auth error when token is missing on verify endpoint", async () => {
  const response = await worker.fetch(
    createSearchRequest("/auth/verify"),
    createEnv({
      TOKEN: "secret",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.code, "UNAUTHORIZED");
  assert.equal(payload.message, "Invalid or missing authentication token");
});

test("rate limits unauthorized requests by IP", async () => {
  installFetchStub();

  const env = createEnv({
    TOKEN: "secret",
    RATE_LIMIT_MAX_REQUESTS: "1",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    SEARCH_STATE_KV: new MemoryKv(),
  });
  const firstResponse = await worker.fetch(
    createSearchRequest("/search?q=cloudflare", {
      headers: {
        Authorization: "Bearer wrong-token-1",
        "cf-connecting-ip": "203.0.113.15",
      },
    }),
    env
  );
  const secondResponse = await worker.fetch(
    createSearchRequest("/search?q=workers", {
      headers: {
        Authorization: "Bearer wrong-token-2",
        "cf-connecting-ip": "203.0.113.15",
      },
    }),
    env
  );
  const firstPayload = await firstResponse.json();
  const secondPayload = await secondResponse.json();

  assert.equal(firstResponse.status, 401);
  assert.equal(firstPayload.code, "UNAUTHORIZED");
  assert.equal(secondResponse.status, 429);
  assert.equal(secondPayload.code, "RATE_LIMITED");
});

test("uses KV-backed response cache", async () => {
  const calls = installFetchStub();
  const searchKv = new MemoryKv();
  const env = createEnv({
    CACHE_TTL_SECONDS: "60",
    SEARCH_KV: searchKv,
  });

  const firstResponse = await worker.fetch(
    createSearchRequest("/search?q=cloudflare"),
    env
  );
  const secondResponse = await worker.fetch(
    createSearchRequest("/search?q=cloudflare"),
    env
  );

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(secondResponse.headers.get("X-Search-Cache"), "hit");
});

test("enforces KV-backed rate limit", async () => {
  installFetchStub();

  const env = createEnv({
    RATE_LIMIT_MAX_REQUESTS: "1",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    SEARCH_STATE_KV: new MemoryKv(),
  });
  const firstResponse = await worker.fetch(
    createSearchRequest("/search?q=cloudflare", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
      },
    }),
    env
  );
  const secondResponse = await worker.fetch(
    createSearchRequest("/search?q=workers", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
      },
    }),
    env
  );
  const payload = await secondResponse.json();

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 429);
  assert.equal(payload.code, "RATE_LIMITED");
  assert.ok(Number(secondResponse.headers.get("Retry-After")) > 0);
  assert.ok(secondResponse.headers.get("X-Search-Request-Id"));
});

test("falls back after an engine parser failure", async () => {
  installFetchStub({
    bing: "<html><body>No organic results</body></html>",
  });

  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare&engines=bing,startpage"),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.unresponsive_engines, ["bing"]);
  assert.equal(payload.results[0].engine, "startpage");
});

test("continues fallback until multiple engines contribute by default", async () => {
  const calls = installFetchStub();

  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare&engines=bing,startpage"),
    createEnv({
      FALLBACK_MIN_RESULTS: "1",
      HEDGED_FALLBACK_DELAY_MS: "1000",
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["bing", "startpage"]);
  assert.equal(
    response.headers.get("X-Search-Fallback-Path"),
    "bing,startpage"
  );
});

test("skips engines that do not support requested time filters", async () => {
  const calls = installFetchStub();

  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare&time_range=month"),
    createEnv({
      DEFAULT_ENGINES: "startpage,bing",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["bing"]);
  assert.deepEqual(payload.enabled_engines, ["bing"]);
  assert.deepEqual(payload.skipped_engines, [
    {
      engine: "startpage",
      reason: "unsupported_time_range",
    },
  ]);
});

test("infers zh-CN for Han queries when language is omitted", async () => {
  let observedUrl = "";
  installFetchStub({
    bing: (url) => {
      observedUrl = String(url);
      return new Response(fixtures.bing, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      });
    },
  });

  const response = await worker.fetch(
    createSearchRequest("/search?q=%E6%98%8E%E6%97%A5%E5%A4%A9%E6%B0%94&engines=bing"),
    createEnv({
      DEFAULT_LANGUAGE: "en",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.results[0].engine, "bing");
  assert.match(observedUrl, /[?&]setlang=zh-Hans(?:&|$)/);
  assert.match(observedUrl, /[?&]mkt=zh-CN(?:&|$)/);
});

test("skips engines that do not support requested pages", async () => {
  const calls = installFetchStub();

  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare&pageno=1"),
    createEnv({
      DEFAULT_ENGINES: "bing,duckduckgo,mojeek",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["mojeek"]);
  assert.deepEqual(payload.enabled_engines, ["mojeek"]);
  assert.deepEqual(payload.skipped_engines, [
    {
      engine: "bing",
      reason: "unsupported_pageno",
    },
    {
      engine: "duckduckgo",
      reason: "unsupported_pageno",
    },
  ]);
});

test("reports unsupported requested engines", async () => {
  const calls = installFetchStub();

  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare&engines=bing,unknown"),
    createEnv()
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["bing"]);
  assert.deepEqual(payload.enabled_engines, ["bing"]);
  assert.deepEqual(payload.skipped_engines, [
    {
      engine: "unknown",
      reason: "unsupported_engine",
    },
  ]);
});

test("moves unhealthy engines behind healthy fallbacks with KV state", async () => {
  const calls = installFetchStub({
    bing: "<html><body>No organic results</body></html>",
  });
  const env = createEnv({
    DEFAULT_ENGINES: "bing,startpage",
    HEALTH_FAILURE_THRESHOLD: "1",
    HEALTH_COOLDOWN_SECONDS: "120",
    SEARCH_STATE_KV: new MemoryKv(),
  });

  await worker.fetch(createSearchRequest("/search?q=cloudflare"), env);
  calls.length = 0;

  const response = await worker.fetch(
    createSearchRequest("/search?q=workers"),
    env
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["startpage"]);
  assert.equal(payload.results[0].engine, "startpage");
});

test("returns stale cache when fresh search fails", async () => {
  const searchKv = new MemoryKv();
  installFetchStub();

  const env = createEnv({
    CACHE_TTL_SECONDS: "60",
    STALE_CACHE_TTL_SECONDS: "300",
    SEARCH_KV: searchKv,
    DEFAULT_ENGINES: "bing",
  });

  const initialResponse = await worker.fetch(
    createSearchRequest("/search?q=cloudflare"),
    env
  );
  assert.equal(initialResponse.status, 200);

  for (const item of searchKv.store.values()) {
    const entry = JSON.parse(item.value);
    entry.freshUntil = Date.now() - 1000;
    entry.staleUntil = Date.now() + 60_000;
    item.value = JSON.stringify(entry);
  }

  installFetchStub({
    bing: "<html><body>No organic results</body></html>",
  });

  const staleResponse = await worker.fetch(
    createSearchRequest("/search?q=cloudflare"),
    env
  );
  const payload = await staleResponse.json();

  assert.equal(staleResponse.status, 200);
  assert.equal(staleResponse.headers.get("X-Search-Cache"), "stale-if-error");
  assert.equal(payload.results[0].engine, "bing");
});

test("starts fallback early when primary is slow", async () => {
  const calls = installFetchStub({
    bing: async () => {
      await sleep(50);
      return new Response(fixtures.bing, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      });
    },
    startpage: async () =>
      new Response(fixtures.startpage, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }),
  });

  const response = await worker.fetch(
    createSearchRequest("/search?q=cloudflare&engines=bing,startpage"),
    createEnv({
      HEDGED_FALLBACK_DELAY_MS: "10",
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["bing", "startpage"]);
  assert.equal(payload.results[0].engine, "startpage");
  assert.equal(
    response.headers.get("X-Search-Fallback-Path"),
    "bing,startpage"
  );
  assert.ok(response.headers.get("Server-Timing")?.includes("startpage;dur="));
});
