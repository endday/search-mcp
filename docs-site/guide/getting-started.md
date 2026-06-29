# 快速开始

Search MCP 现在推荐的使用方式很简单：**直接在本地启动 MCP Server，让客户端通过 stdio 连接它。**

## 环境要求

- Node.js 20+
- 一个支持 MCP 的客户端，例如 Claude Code、Claude Desktop、OpenClaw、Codex

## 最小启动方式

```bash
npx -y @endday/search-mcp
```

这条命令会启动本地 MCP Server，并暴露：

- `web_search`
- `content`
- `jina_content`

## 现在不建议的路径

下面这些路径已经不再是推荐主线：

- 通过远程 Worker 作为 MCP 回退
- 继续把首页搜索 UI 当成主要产品入口
- 在 Worker 中维护大段文档型 HTML

## 为什么切到 VitePress

因为当前项目需要维护的是：

- 使用说明
- 架构说明
- 产品规划

这本质上是文档站，而不是交互型首页。VitePress 对这类内容的维护成本最低。
