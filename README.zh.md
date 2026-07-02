# Search MCP

[English](./README.md) | 中文

> 一个只做本地 MCP 的聚合搜索与正文提取包

## 现在是什么

`@endday/search-mcp` 现在是一个**纯本地** MCP 包。

仓库已经不再提供远程 Worker 服务，主线只保留：

- 本地 `web_search`
- 本地 `news_search`
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
- `news_search`：显式新闻搜索，走支持 news vertical 的引擎
- `content`：本地抓取网页并提取正文
- `jina_content`：通过 Jina AI 阅读器读取网页

## 排序与过滤

- 命中本地生成的黑名单域名会直接过滤
- 普通域名默认大致同权
- 只有少量已知高价值来源会拿到确定性的正向加分

## 当前支持的引擎

- `baidu`
- `bing`
- `startpage`
- `duckduckgo`
- `brave`
- `qwant`
- `yahoo`
- `mojeek`
- `toutiao`

当前本地环境下推荐的默认组合：

- 中文查询：`baidu`、`bing`
- 非中文查询：`bing`、`brave`、`yahoo`、`mojeek`

## 开发命令

```bash
npm test
npm run smoke
npm run update:blocklist
npm run docs:dev
```

## 文档

长文档已经迁到 [docs-site](./docs-site) 里的 VitePress 站点。
文档站建议直接发布到 GitHub Pages，不再需要单独保留 Cloudflare Worker 首页。

GitHub Pages 配置方式：

1. 在仓库设置里启用 `GitHub Pages`
2. Source 选择 `GitHub Actions`
3. 使用 `.github/workflows/docs-pages.yml` 自动构建并发布 VitePress 站点

## 许可证

GPL-3.0
