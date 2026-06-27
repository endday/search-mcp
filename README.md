# Search MCP

English | [中文](./README.zh.md)

> An aggregated search API service based on Cloudflare Workers

> Supports **MCP (Model Context Protocol)**, giving AI assistants (OpenClaw, Claude Code, Codex, OpenCode) real-time web search capabilities

## Features

- 🔍 **Multi-Engine Search Gateway** - Query multiple engines in parallel (Startpage, Bing, DuckDuckGo, Brave, Mojeek, Qwant, Yahoo)
- 🤖 **AI Enhanced (MCP)** - Native support for Model Context Protocol, one-click search tool integration for **OpenClaw** / **Claude Code** / **Codex**
- ⚡ **Smart Fallback** - Stop after enough deduplicated results instead of always querying every engine
- 🛡️ **Fault Tolerance** - Timeout, parse, and upstream errors are classified; unhealthy engines are cooled down automatically
- 🧹 **Deduplication & Ranking** - Canonicalize URLs, remove duplicate results, and rank by source authority + query relevance
- 💾 **KV Cache** - Fresh-cache + stale-if-error support with configurable TTL
- 🚦 **Simple Rate Limiting** - Per-token/IP fixed-window rate limit, with optional KV-backed shared state
- ⏱️ **Timeout Control** - Configurable request timeout to avoid long waits
- 🪂 **Parallel + Early Stop** - All requested engines run in parallel; once enough deduplicated results arrive, the rest are aborted
- 🔒 **Token Authentication** - Supports token auth to protect the service from abuse
- 🧾 **Direct Content Reader** - `/content` fetches server-rendered pages and extracts the likely main content without browser rendering
- 📄 **Rendered Markdown API** - Optional `/markdown` endpoint backed by Cloudflare Browser Rendering for SPA pages
- 🌍 **CORS Support** - Configurable cross-origin resource sharing support
- 🎨 **Web Interface** - Provides a clean search UI for easy testing
- ⚡ **Zero-cost Operation** - Cloudflare Workers free tier supports 100,000 requests per day

## Page Preview

![screenshot](./screenshot.png)

## MCP Integration: Use in OpenClaw / Claude Code / AI Agents

With MCP (Model Context Protocol), AI assistants can directly call your search service and get real-time search results.

### Installation and Configuration

#### 1. Deploy the Service

First, follow the guide to [deploy Search MCP](#installation-methods)

#### 2. Add MCP Server Configuration

Edit your config file ([configuration guide](https://modelcontextprotocol.io/quickstart/user)):

- **OpenClaw**: `~/.openclaw/openclaw.json`
- **Claude Code**: `~/.claude/config.json` / `~/.claude.json`
- **Claude Desktop macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
	"mcpServers": {
		"search-mcp": {
			"command": "npx",
			"args": ["-y", "@endday/search-mcp"],
			"env": {
				"SEARCH_MCP_URL": "https://your-worker.workers.dev",
				"SEARCH_MCP_TOKEN": "your-token-here"
			}
		}
	}
}
```

#### Observability Headers

- `X-Search-Request-Id`: request identifier for log correlation
- `X-Search-Cache`: `miss` / `hit` / `revalidated` / `stale-if-error`
- `X-Search-Fallback-Order`: engines queried for this request
- `X-Search-Fallback-Path`: engines actually started for this request
- `X-Search-Duration-Ms`: total gateway duration
- `Server-Timing`: per-engine timing data

**Environment Variables**:

- `SEARCH_MCP_URL`: Worker deployment URL (required)
- `SEARCH_MCP_TOKEN`: Auth token (required if your Worker has `TOKEN` configured)
- `JINA_API_KEY`: Jina AI API key for higher rate limits (optional, free tier available without key)
- `JINA_BASE_URL`: Jina reader base URL (optional, default: `https://r.jina.ai/`)

The The MCP package exposes `web_search`, `content`, and `jina_content` tools: `web_search` returns deduplicated search results with snippets and source authority, `content` extracts readable text from a URL via the Worker's Readability extractor, and `jina_content` extracts text via Jina AI reader (per-user rate limit).

#### 3. Verify Installation

- **OpenClaw**: Run `openclaw gateway restart` + `openclaw mcp list` and check that `search-mcp` appears
- **Claude Code**:
	- Run `/mcp` in Claude Code, and you should see the `search-mcp` tool.
	- Or run `claude mcp list`; seeing `search-mcp: npx -y @endday/search-mcp@latest - ✓ Connected` means setup is successful

## Installation Methods

### Method 1: One-click Deployment

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/endday/search-mcp)

Click the button above and follow the prompts.

### Method 2: Use Wrangler CLI

```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Clone the repository
git clone https://github.com/endday/search-mcp.git
cd search-mcp

# 4. Deploy
wrangler deploy

# Optional: verify a deployed Worker
SMOKE_BASE_URL=https://your-worker-name.your-subdomain.workers.dev \
SMOKE_TOKEN=$YOUR-TOKEN \
npm run smoke
```

### Method 3: Use Cloudflare Dashboard

1. Sign in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Workers & Pages**
3. Click **Create Application** > **Create Worker**
4. Click **Upload** to upload your local code folder
	 - Select the cloned `search-mcp` folder
	 - Or manually copy `worker.js`, `envs.js`, `utils/`, and other files
5. Click **Save and Deploy**

### Get Access URL

After deployment, you will get a Worker URL:

```
https://your-worker-name.your-subdomain.workers.dev
```

> **Important**: The default `*.workers.dev` domain may not be directly accessible in some regions (e.g. China). For stable access, bind your own custom domain via **Cloudflare Dashboard → Workers → your Worker → Triggers → Custom Domains**. All API examples below use `https://$YOUR-DOMAIN` — replace it with your actual domain.

## Usage

### Method 1: Web Interface

Open your Worker URL directly and enter search keywords in the web UI:

```
https://$YOUR-DOMAIN/
```

### Method 2: API Request (GET)

Search using query parameters:

```bash
# Basic search
curl "https://$YOUR-DOMAIN/search?q=cloudflare"

# Specify search engines
curl "https://$YOUR-DOMAIN/search?q=cloudflare&engines=startpage,duckduckgo"

# Use token authentication (recommended: Authorization header)
curl "https://$YOUR-DOMAIN/search?q=cloudflare" \
	-H "Authorization: Bearer $YOUR-TOKEN"
```

### Method 3: API Request (POST)

Submit search by POST form:

```bash
curl -X POST "https://$YOUR-DOMAIN/search" \
	-d "q=cloudflare" \
	-d "engines=startpage,duckduckgo" \
	-H "Authorization: Bearer $YOUR-TOKEN" # if TOKEN env var is configured
```

## API Reference

### `/search` Endpoint

Used to execute search queries and return aggregated results.

#### Request Parameters

| Parameter     | Type     | Required | Description                                                | Example          |
| ------------- | -------- | -------- | ---------------------------------------------------------- | ---------------- |
| `q` / `query` | `string` | yes      | Search keyword                                             | `cloudflare`     |
| `engines`     | `string`/`array` | yes      | Required. Engines to query in parallel, comma-separated or array | `startpage,bing` |
| `language`    | `string` | no       | Language/region hint passed to supported engines          | `en`, `zh-CN`    |
| `location`    | `string` | no       | Location hint. Defaults to `off`; use `auto` to append Cloudflare `request.cf.city` / `region` | `auto`, `Shanghai`, `off` |
| `time_range`  | `string` | no       | Time filter: `day`, `week`, `month`, or `year`            | `month`          |
| `pageno`      | `number` | no       | Zero-based page number                                    | `0`              |
| `min_authority_score` | `number` | no | Minimum deterministic source authority score after ranking | `1` |
| `include_source_types` | `string` | no | Comma-separated source types to include | `official,benchmark,paper,media` |
| `exclude_source_types` | `string` | no | Comma-separated source types to exclude | `community,blog,low_credibility` |
| `token`       | `string` | no/yes   | Access token compatibility parameter; prefer `Authorization: Bearer ...` | `$YOUR-TOKEN`    |

By default, location enrichment is disabled. Only when you pass `location=auto` will the Worker append Cloudflare `request.cf` city or region to the actual upstream query and return both `query` and `effective_query` for transparency. In MCP/proxy scenarios this reflects the caller/proxy IP location; you can also pass an explicit place such as `location=Shanghai`.

**Supported Search Engines**:

- `bing` - Bing Search
- `startpage` - Startpage Search
- `mojeek` - Mojeek Search
- `duckduckgo` - DuckDuckGo Search
- `brave` - Brave Search
- `qwant` - Qwant Lite Search
- `yahoo` - Yahoo Search

#### Response Value

```typescript
{
	query: string;                    // Search keyword
	effective_query: string;          // Actual upstream query after location enrichment
	location: string | null;          // Resolved location, if any
	location_source: string;          // auto / explicit / disabled / unavailable
	number_of_results: number;        // Total number of results
	enabled_engines: string[];        // Enabled search engine list
	skipped_engines: Array<{          // Requested engines skipped before search
		engine: string;
		reason: string;
	}>;
	unresponsive_engines: string[];   // Unresponsive search engine list
	source_filters?: {                // Present when source filters are active
		include_source_types: string[];
		exclude_source_types: string[];
		min_authority_score: number | null;
		active: boolean;
	};
	results: Array<{
		title: string;                  // Result title
		description: string;            // Result description
		url: string;                    // Result link
		engine: string;                 // Source engine
		source_type?: string;           // Source type, such as official / benchmark / media / blog
		authority_score?: number;       // Deterministic source authority boost
	}>;
}
```

#### Request Examples

```bash
# GET request
curl "https://$YOUR-DOMAIN/search?q=cloudflare&engines=startpage,duckduckgo"

# Default location=off does not append visitor city/region
curl "https://$YOUR-DOMAIN/search?q=tomorrow%20weather"

# Override or enable automatic location enrichment
curl "https://$YOUR-DOMAIN/search?q=tomorrow%20weather&location=Hong%20Kong"
curl "https://$YOUR-DOMAIN/search?q=cloudflare&location=auto"

# Require at least a known positively scored source
curl "https://$YOUR-DOMAIN/search?q=deepseek%20model&min_authority_score=1"

# JSON POST request
curl -X POST "https://$YOUR-DOMAIN/search" \
	-H "Content-Type: application/json" \
	-d '{"q":"cloudflare","engines":["startpage","duckduckgo"],"language":"en","location":"off","time_range":"month"}'

# Form POST request
curl -X POST "https://$YOUR-DOMAIN/search" \
	-H "Content-Type: application/x-www-form-urlencoded" \
	-d "q=cloudflare&engines=startpage,duckduckgo"
```

#### Response Example

```json
{
	"query": "cloudflare",
	"effective_query": "cloudflare",
	"location": null,
	"location_source": "disabled",
	"number_of_results": 15,
	"enabled_engines": ["startpage", "duckduckgo", "brave", "mojeek", "bing"],
	"skipped_engines": [],
	"unresponsive_engines": [],
	"results": [
		{
			"title": "Cloudflare - The Web Performance & Security Company",
			"description": "Cloudflare is on a mission to help build a better Internet...",
			"url": "https://www.cloudflare.com/",
			"engine": "startpage",
			"source_type": "official",
			"authority_score": 90
		},
		{
			"title": "Cloudflare Workers",
			"description": "Deploy serverless code instantly across the globe...",
			"url": "https://workers.cloudflare.com/",
			"engine": "startpage"
		}
	]
}
```

### `/markdown` Endpoint

Uses Cloudflare Browser Rendering to load a page and return rendered Markdown. This is useful for SPA pages where plain Worker `fetch()` cannot see the final content.

Requires `CF_BROWSER_RENDERING_ACCOUNT_ID` and `CF_BROWSER_RENDERING_API_TOKEN`. If `TOKEN` is configured, `/markdown` also requires the same access token as `/search`.

#### Request Parameters

| Parameter | Type | Required | Description | Example |
| --------- | ---- | -------- | ----------- | ------- |
| `url` | `string` | yes | Target page URL. Only public `http` and `https` URLs are allowed | `https://example.com/article` |
| `wait_until` | `string` | no | Browser navigation wait mode: `load`, `domcontentloaded`, `networkidle0`, `networkidle2` | `networkidle2` |
| `wait_for_selector` | `string` | no | Optional selector to wait for before extracting Markdown | `main` |
| `timeout_ms` | `number` | no | Browser timeout, clamped to 1,000-60,000 ms | `30000` |
| `user_agent` | `string` | no | Optional user agent override | `Mozilla/5.0 ...` |
| `token` | `string` | no/yes | Access token compatibility parameter; prefer `Authorization: Bearer ...` | `$YOUR-TOKEN` |

#### Request Example

```bash
curl "https://$YOUR-DOMAIN/markdown?url=https%3A%2F%2Fexample.com%2Farticle&wait_until=networkidle2" \
	-H "Authorization: Bearer $YOUR-TOKEN"
```

#### Response Example

```json
{
	"url": "https://example.com/article",
	"source": "cloudflare-browser-rendering",
	"markdown": "# Example\n\nRendered content",
	"metadata": {},
	"browser_ms_used": 4200,
	"duration_ms": 5100
}
```

The response forwards `X-Browser-Ms-Used` when Cloudflare returns it, so you can track Browser Rendering quota usage.

### `/content` Endpoint

Fetches a page through the Worker and extracts the likely main HTML content without Cloudflare Browser Rendering. It does not execute JavaScript, so it works best for server-rendered articles, blogs, docs, and news pages.

If `TOKEN` is configured, `/content` requires the same access token as `/search`. `/html` is kept as a compatibility alias.

The extractor uses a lightweight heuristic inspired by open source article extractors: remove obvious noise nodes, score candidate blocks by text density, paragraph count, positive/negative class names, and link density, then return the best block.

#### Request Parameters

| Parameter | Type | Required | Description | Example |
| --------- | ---- | -------- | ----------- | ------- |
| `url` | `string` | yes | Target page URL. Only public `http` and `https` URLs are allowed | `https://example.com/article` |
| `max_bytes` | `number` | no | Maximum upstream response size, clamped to 50,000-5,000,000 bytes | `1500000` |
| `token` | `string` | no/yes | Access token compatibility parameter; prefer `Authorization: Bearer ...` | `$YOUR-TOKEN` |

#### Request Example

```bash
curl "https://$YOUR-DOMAIN/content?url=https%3A%2F%2Fexample.com%2Farticle" \
	-H "Authorization: Bearer $YOUR-TOKEN"
```

#### Response Example

```json
{
	"url": "https://example.com/article",
	"source": "direct-fetch",
	"title": "Example Article",
	"description": "Short page summary",
	"html": "<article>...</article>",
	"text": "Readable article text...",
	"excerpt": "Readable article text...",
	"stats": {
		"text_length": 1234,
		"html_length": 1800,
		"score": 1600,
		"link_density": 0.08,
		"paragraph_count": 6
	}
}
```

### `/auth/verify` Endpoint

Verifies whether the current request is authenticated. The web UI calls this when you click the "Verify" button to check whether a token is valid.

If `TOKEN` is configured, this endpoint requires the same access token as `/search` (token or session cookie).

#### Request Example

```bash
curl "https://$YOUR-DOMAIN/auth/verify" \
	-H "Authorization: Bearer $YOUR-TOKEN"
```

#### Response Example

```json
{
	"authorized": true,
	"token_required": true,
	"auth_method": "token"
}
```

`auth_method` is one of `token`, `session`, or `none`. When `token_required` is `false`, auth is not enabled and any token is accepted.

### `/geo` Endpoint

Returns the Cloudflare `request.cf` geolocation payload for the current caller. Useful for previewing what `location=auto` would append to the upstream query.

#### Request Example

```bash
curl "https://$YOUR-DOMAIN/geo"
```

#### Response Example

```json
{
	"geo": {
		"city": "Shanghai",
		"region": "Shanghai",
		"country": "CN"
	}
}
```

The returned fields depend on what Cloudflare exposes for the request; they may be empty when no geo data is available.

## Search Engine Notes

### Supported Search Engines

| Engine         | Description                  | Configuration Required          | Default Role |
| -------------- | ---------------------------- | ------------------------------- | ------------ |
| **Startpage**  | Serialized SERP payload       | -                               | Default |
| **Bing**       | HTML / RSS search parser      | -                               | Default |
| **DuckDuckGo** | HTML search endpoint          | -                               | Default |
| **Brave**      | HTML result parser, no `eval` | -                               | Default |
| **Mojeek**     | Simple HTML parser            | -                               | Default |
| **Qwant**      | Qwant Lite HTML parser        | -                               | Optional |
| **Yahoo**      | HTML search parser            | -                               | Optional |

### Basic Working Approach

1. **Parallel Search**: `engines` is required — all requested engines start in parallel (no priority chain)
2. **Early Stop**: Stop when deduplicated results reach `FALLBACK_MIN_RESULTS` and at least `FALLBACK_MIN_CONTRIBUTING_ENGINES` engines have contributed
3. **Normalization**: Normalize titles/descriptions, canonicalize URLs, and remove duplicates
4. **Health Control**: Repeated failures are tracked per engine; bind `SEARCH_STATE_KV` to share state across isolates
5. **Cache**: If `SEARCH_KV` is bound, final `/search` responses are cached by query + parameters, with stale-if-error fallback

## Environment Variable Configuration

### Environment Variables

| Variable Name | Type | Default | Description |
| ------------- | ---- | ------- | ----------- |
| `DEFAULT_ENGINES` | `string`/`array` | `startpage,bing,duckduckgo,brave,mojeek` | Engines checked by default on the demo page (the API requires `engines`) |
| `DEFAULT_TIMEOUT` | `string` | `"4000"` | Timeout per engine request, in milliseconds |
| `HEDGED_FALLBACK_DELAY_MS` | `string` | `"400"` | Deprecated — no longer used in parallel mode |
| `FALLBACK_MIN_RESULTS` | `string` | `"6"` | Stop fallback after this many deduplicated results |
| `FALLBACK_MIN_CONTRIBUTING_ENGINES` | `string` | `"2"` | Minimum result-contributing engines before early stop |
| `CACHE_TTL_SECONDS` | `string` | `"300"` | KV cache TTL; set `0` to disable cache |
| `STALE_CACHE_TTL_SECONDS` | `string` | `"1800"` | Keep expired cache available for stale-if-error responses |
| `RATE_LIMIT_WINDOW_SECONDS` | `string` | `"60"` | Rate-limit window size |
| `RATE_LIMIT_MAX_REQUESTS` | `string` | `"60"` | Requests allowed per token/IP per window; set `0` to disable |
| `HEALTH_FAILURE_THRESHOLD` | `string` | `"2"` | Failures before temporary engine cooldown |
| `HEALTH_COOLDOWN_SECONDS` | `string` | `"180"` | Engine cooldown duration |
| `HEALTH_STATE_TTL_SECONDS` | `string` | `"3600"` | Retention time for engine health state in KV |
| `CORS_ALLOWED_ORIGINS` | `string`/`array` | `*` | Allowed browser origins; set specific origins to restrict CORS |
| `CORS_ALLOWED_HEADERS` | `string`/`array` | `Authorization,Content-Type,x-api-key` | Allowed CORS request headers |
| `AUTH_REQUIRED` | `string` | `"false"` | Set to `"true"` to fail closed when `TOKEN` has not been configured |
| `TOKEN` | `string` | `null` | Access token. Enables auth when configured to prevent abuse |
| `CF_BROWSER_RENDERING_ACCOUNT_ID` | `string` | `null` | Cloudflare account ID used by `/markdown` |
| `CF_BROWSER_RENDERING_API_TOKEN` | `string` | `null` | API token with Browser Rendering - Edit permission used by `/markdown` |

**Notes**:

- For public deployments, keep `AUTH_REQUIRED = "true"` and configure the token with `wrangler secret put TOKEN`
- After `TOKEN` is configured, protected endpoints must provide a valid token
- `/markdown` consumes Cloudflare Browser Rendering quota; keep `TOKEN` enabled on public deployments
- Bind `SEARCH_STATE_KV` to share rate-limit counters and engine health across isolates; KV writes are eventually consistent, not strict atomic counters
- Bind a KV namespace named `SEARCH_KV` to enable response caching; stale cache can still be returned if live upstream search fails

### Configuration Methods

#### Method 1: `wrangler.toml` File

Edit the `[vars]` section in `wrangler.toml`:

```toml
[vars]
DEFAULT_ENGINES = "startpage,bing,duckduckgo,brave,mojeek"
DEFAULT_TIMEOUT = "4000"
FALLBACK_MIN_CONTRIBUTING_ENGINES = "2"
CACHE_TTL_SECONDS = "300"
STALE_CACHE_TTL_SECONDS = "1800"
RATE_LIMIT_MAX_REQUESTS = "60"
HEALTH_STATE_TTL_SECONDS = "3600"
CORS_ALLOWED_ORIGINS = "https://app.example.com"
AUTH_REQUIRED = "true"
CF_BROWSER_RENDERING_ACCOUNT_ID = "your-account-id"
CF_BROWSER_RENDERING_API_TOKEN = "your-browser-rendering-api-token"

[[kv_namespaces]]
binding = "SEARCH_KV"
id = "your-kv-namespace-id"

[[kv_namespaces]]
binding = "SEARCH_STATE_KV"
id = "your-state-kv-namespace-id"
```

Do not put the real access token in `wrangler.toml`. Use:

```bash
wrangler secret put TOKEN
```

#### Method 2: Cloudflare Dashboard

1. Go to the Worker settings page
2. Find the **Environment Variables** section
3. Add variables and save

## Use Cases

### 1. Aggregated Search Service

Build your own aggregated search API and combine results from multiple search engines:

```javascript
const response = await fetch(
	"https://$YOUR-DOMAIN/search?q=javascript&engines=startpage,duckduckgo",
);
const data = await response.json();
console.log(`Found ${data.number_of_results} results`);
```

### 2. Frontend Search Feature

Add search functionality to your website or app:

```javascript
async function search(query) {
	const response = await fetch(
		`https://$YOUR-DOMAIN/search?q=${encodeURIComponent(query)}`,
	);
	const data = await response.json();
	return data.results;
}
```

### 3. Data Collection and Analysis

Collect results from multiple search engines for comparative analysis:

```javascript
const engines = ["startpage", "duckduckgo", "brave"];
const results = await fetch(
	`https://$YOUR-DOMAIN/search?q=AI&engines=${engines.join(",")}`,
);
const data = await results.json();

// Group by engine
const byEngine = data.results.reduce((acc, result) => {
	acc[result.engine] = acc[result.engine] || [];
	acc[result.engine].push(result);
	return acc;
}, {});
```

## Notes and Reminders

### 🚨 Important Notes

1. **Use a Custom Domain**
	 - The default Cloudflare `*.workers.dev` domain may be inaccessible in some regions
	 - It is **strongly recommended** to bind your own domain for a better access experience
	 - In Worker settings, click **Triggers** > **Add Custom Domain** to add a custom domain

2. **Search Engine Limits**
	 - HTML-based engines may change their markup over time, so parser fixture tests matter
	 - Search engines do not publish strict quotas; use them reasonably
	 - Frequent requests may trigger temporary rate limiting

3. **Timeout Settings**
	 - Default timeout per engine is 4 seconds
	 - Can be adjusted with `DEFAULT_TIMEOUT`
	 - Do not set it too high to avoid long overall response times

4. **KV Cache**
	 - Bind `SEARCH_KV` if you want cross-request response caching
	 - Cache keys include query, engine list, language, time range, and page number

### 🔒 Security Configuration

#### Enable Authentication

1. Configure the `TOKEN` secret to protect your service from abuse:

- Prefer `wrangler secret put TOKEN`
- Or configure an encrypted secret in Cloudflare Worker Dashboard
- Keep `AUTH_REQUIRED = "true"` in `wrangler.toml` to avoid an accidental public deployment

2. Pass token in requests:

```bash
# Homepage
# Open the page and paste the token into the built-in input box

# Preferred: Authorization header
curl "https://$YOUR-DOMAIN/search?q=cloudflare" \
	-H "Authorization: Bearer $YOUR-TOKEN"

curl -X POST "https://$YOUR-DOMAIN/search" \
	-d "q=cloudflare" \
	-H "Authorization: Bearer $YOUR-TOKEN"

# Backward-compatible query/body token is still supported
curl "https://$YOUR-DOMAIN/search?q=cloudflare&token=$YOUR-TOKEN"
```

#### Authentication Methods

Protected endpoints (`/search`, `/content`, `/markdown`, `/auth/verify`) accept any of the following:

- `Authorization: Bearer <token>` header (preferred)
- `x-api-key: <token>` header
- `token` query/body parameter (backward compatible)
- Session cookie, issued automatically when you open the web UI

#### Session Cookie

When you open the web UI at `/`, the Worker automatically issues a `search_mcp_sid` cookie (24-hour TTL, sliding expiry) and stores it in `SEARCH_STATE_KV` (or an in-memory fallback when KV is not bound). The demo page can then call the protected endpoints without a token, authenticated via this session. Click "Verify" on the page to confirm the session is active. Programmatic API callers should still use a token.

When `AUTH_REQUIRED = "true"` but `TOKEN` is not configured, protected endpoints return `503 AUTH_TOKEN_NOT_CONFIGURED` instead of `401`, to signal a deployment misconfiguration rather than a client auth failure.

## FAQ

### Q: Why do some search engines return empty results?

A: Possible reasons:

- Search engine API is temporarily unavailable or timed out
- No relevant results for the search keyword
- Search engine has rate-limited access

You can check `skipped_engines` and `unresponsive_engines` in the response to see which engines were filtered out or failed to respond.

### Q: How can I improve search speed?

A: Recommendations:

- Keep the default fallback chain and let the gateway stop early
- Bind `SEARCH_KV` and tune `CACHE_TTL_SECONDS`
- Use `STALE_CACHE_TTL_SECONDS` to improve availability when upstream engines fail
- Bind `SEARCH_STATE_KV` so rate limiting and engine health are shared across isolates
- Adjust `DEFAULT_TIMEOUT`, `FALLBACK_MIN_RESULTS`, and `FALLBACK_MIN_CONTRIBUTING_ENGINES` appropriately

### Q: How does the search work?

A: `engines` is required. All requested engines start in parallel — there is no priority chain and no hedged fallback. Once deduplicated results reach `FALLBACK_MIN_RESULTS` from at least `FALLBACK_MIN_CONTRIBUTING_ENGINES` engines, the remaining in-flight engines are aborted (early stop). Unresponsive engines are reported in `unresponsive_engines` and recorded in health state, but health no longer affects which engines run.

### Q: How can I protect the service from abuse?

A: It is recommended to configure the `TOKEN` secret to enable authentication:

1. Run `wrangler secret put TOKEN`
2. Keep `AUTH_REQUIRED = "true"` in `wrangler.toml`
3. Or add an encrypted secret in Cloudflare Worker Dashboard
4. After configuration, protected endpoints must provide a valid token

Authentication failure returns a 401 error.

### Q: Does rate limiting work globally?

A: If `SEARCH_STATE_KV` is bound, counters are shared across isolates and are suitable for basic abuse protection. Cloudflare KV writes are eventually consistent, so this is not a strict atomic global limiter; use Durable Objects later if you need hard global consistency.

Rate-limit buckets are keyed by auth method: token requests use the token, session-cookie requests use `session:<id>` (so web UI users do not share a bucket with anonymous IPs), and unauthenticated requests fall back to the caller IP.

## Disclaimer

This project is for learning and research purposes only. Users must comply with the following:

1. **Lawful Use** - Only use for legal search purposes. Do not use for illegal or infringing activities
2. **Terms of Service** - Comply with the terms of Cloudflare Workers and each search engine
3. **API Limits** - Follow usage limits and quotas of each search engine API
4. **Use at Your Own Risk** - Any consequences from using this service are the user's responsibility
5. **Commercial Use** - For commercial use, ensure compliance with relevant laws, regulations, and service terms

## Contributing

Issues and Pull Requests are welcome!

## License

[GPL-3 License](LICENSE)

## Related Links

- [Project GitHub](https://github.com/endday/search-mcp)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
