# Search MCP

[English](./README.md) | 中文

> 一个只做本地 MCP 的聚合搜索与正文提取包

## 现在是什么

`@endday/search-mcp` 现在是一个**纯本地** MCP 包。

仓库已经不再提供远程 Worker 服务，主线只保留：

- 本地 `web_search`
- 本地 `content`
- 可选的 `jina_content`

## 安装

要求：

- Node.js 20+
- 一个支持 MCP 的客户端，例如 Claude Code、Claude Desktop、OpenClaw、Codex

直接运行：

```bash
npx -y @endday/search-mcp
```

## MCP 配置

把下面配置加入你的 MCP 客户端：

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

可选环境变量：

- `SEARCH_MCP_CLIENT_ID`
- `SEARCH_MCP_UPSTREAM_CLIENT`（`auto`、`impit`、`fetch`）
- `SEARCH_MCP_PROXY_URL`
- `SEARCH_MCP_IGNORE_TLS_ERRORS`
- `JINA_API_KEY`
- `JINA_BASE_URL`
- `SUPPORTED_ENGINES`
- `DEFAULT_ENGINES`
- `DEFAULT_ENGINES_ZH`
- `DEFAULT_ENGINES_NON_ZH`

默认是 `SEARCH_MCP_UPSTREAM_CLIENT=auto`。在本地 Node 模式下，上游请求会优先使用 `impit`，必要时再回退到内置 `fetch`。设为 `impit` 表示强制启用，设为 `fetch` 表示禁用。

## 暴露的工具

- `web_search`：本地抓取搜索结果并返回排序后的结果
- `content`：本地抓取网页并提取正文
- `jina_content`：通过 Jina AI 阅读器读取网页

## 当前支持的引擎

- `bing`
- `startpage`
- `duckduckgo`
- `brave`
- `qwant`
- `yahoo`
- `mojeek`
- `toutiao`

## 开发命令

```bash
npm test
npm run smoke
npm run docs:dev
```

## 文档

长文档已经迁到 [docs-site](./docs-site) 里的 VitePress 站点。

## 许可证

GPL-3.0
