# Search MCP

English | [中文](./README.zh.md)

> A local MCP server for aggregated web search and readable content extraction

## What It Is

`@endday/search-mcp` is now a **local-only** MCP package.

It does not ship a remote Worker service anymore. The project is focused on:

- local `web_search`
- local `content`
- `jina_content` as an optional reader fallback

## Install

Requirements:

- Node.js 20+
- an MCP client such as Claude Code, Claude Desktop, OpenClaw, or Codex

Run directly with:

```bash
npx -y @endday/search-mcp
```

## MCP Config

Add this to your MCP client config:

```json
{
  "mcpServers": {
    "search-mcp": {
      "command": "npx",
      "args": ["-y", "@endday/search-mcp"],
      "env": {
        "SEARCH_MCP_CLIENT_ID": "search-mcp-local"
      }
    }
  }
}
```

Optional environment variables:

- `SEARCH_MCP_CLIENT_ID`
- `SEARCH_MCP_UPSTREAM_CLIENT` (`auto`, `impit`, `fetch`)
- `SEARCH_MCP_PROXY_URL`
- `SEARCH_MCP_IGNORE_TLS_ERRORS`
- `JINA_API_KEY`
- `JINA_BASE_URL`
- `SUPPORTED_ENGINES`
- `DEFAULT_ENGINES`
- `DEFAULT_ENGINES_ZH`
- `DEFAULT_ENGINES_NON_ZH`

`SEARCH_MCP_UPSTREAM_CLIENT=auto` is the default. In local Node mode it prefers `impit` for upstream requests and falls back to built-in `fetch` if needed. Set it to `impit` to force the impersonated client, or `fetch` to disable it.

## Exposed Tools

- `web_search`: runs local engine fetch + parse and returns ranked results
- `news_search`: runs explicit news search across supported news-capable engines
- `content`: fetches a URL and extracts readable text locally
- `jina_content`: reads a URL through Jina AI reader

## Ranking And Filtering

- blocked domains are filtered locally from generated denylist subscriptions
- ordinary domains are treated roughly equally by default
- only a small set of known high-value sources gets deterministic positive boosts

## Supported Engines

- `baidu`
- `bing`
- `startpage`
- `duckduckgo`
- `brave`
- `qwant`
- `yahoo`
- `mojeek`
- `toutiao`

Recommended defaults in the current local setup:

- Chinese queries: `baidu`, `bing`
- Non-Chinese queries: `bing`, `brave`, `yahoo`, `mojeek`

## Dev

Useful commands:

```bash
npm test
npm run smoke
npm run update:blocklist
npm run docs:dev
```

## Docs

Long-form docs now live in the VitePress site under [docs-site](./docs-site).
The docs site is intended to be published with GitHub Pages, so a Cloudflare Worker homepage is no longer needed.

For GitHub Pages:

1. Enable `GitHub Pages` in the repository settings.
2. Set the source to `GitHub Actions`.
3. The workflow at `.github/workflows/docs-pages.yml` will build and deploy the VitePress site.

## License

GPL-3.0
