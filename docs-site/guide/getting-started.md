# 快速开始

Search MCP 的最小使用方式很简单：**直接在本地启动 MCP Server，让客户端通过 stdio 连接它。**

## 环境要求

- Node.js 20+
- 一个支持 MCP 的客户端，例如 Claude Code、Claude Desktop、OpenClaw、Codex

## 最小启动方式

```bash
npx -y @endday/search-mcp
```

这条命令会启动本地 MCP Server，并暴露：

- `web_search`
- `news_search`
- `content`
- `jina_content`

## 当前支持的搜索引擎

- `baidu`
- `bing`
- `startpage`
- `duckduckgo`
- `brave`
- `qwant`
- `yahoo`
- `mojeek`
- `toutiao`

推荐默认组合：

- 中文查询：`baidu`、`bing`
- 非中文查询：`bing`、`brave`、`yahoo`、`mojeek`

## 默认能力说明

- `web_search`：通用网页搜索
- `news_search`：显式新闻搜索
- `content`：正文抓取与提取
- `jina_content`：通过 Jina Reader 读取网页

## 下一步

1. 先确认客户端能看到 `search-mcp`
2. 再继续看 “MCP 配置”
3. 按需要补环境变量和默认引擎设置
