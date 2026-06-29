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
- `content`: fetches a URL and extracts readable text locally
- `jina_content`: reads a URL through Jina AI reader

## Supported Engines

- `bing`
- `startpage`
- `duckduckgo`
- `brave`
- `qwant`
- `yahoo`
- `mojeek`
- `toutiao`

## Dev

Useful commands:

```bash
npm test
npm run smoke
npm run docs:dev
```

## Docs

Long-form docs now live in the VitePress site under [docs-site](./docs-site).

## License

GPL-3.0
