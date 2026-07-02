---
layout: home

hero:
  name: Search MCP
  text: 本地 MCP 搜索服务
  tagline: 一个面向 MCP 客户端的本地搜索聚合与正文提取服务。
  image:
    src: /mark.svg
    alt: Search MCP
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: MCP 配置
      link: /guide/mcp-config
    - theme: alt
      text: GitHub
      link: https://github.com/endday/search-mcp

features:
  - title: 只走本地 MCP
    details: 默认通过本地抓取与解析链路提供 `web_search`、`news_search`、`content` 和 `jina_content`。
  - title: 简单接入
    details: 直接通过 `npx -y @endday/search-mcp` 启动，再在 MCP 客户端里配置 `command` 和 `args` 即可。
  - title: 本地过滤
    details: 命中本地生成的黑名单域名会直接过滤，普通域名默认大致同权，只保留少量高价值来源正向加分。
---

## 这是什么

`@endday/search-mcp` 是一个本地优先的 MCP 包，主要提供：

- `web_search`
- `news_search`
- `content`
- `jina_content`

适合需要在 Claude Code、Claude Desktop、Codex、OpenClaw 这类 MCP 客户端里直接接入本地搜索能力的场景。

## 推荐阅读顺序

1. 先看“快速开始”
2. 再看 “MCP 配置”
3. 最后按需要调整环境变量和默认引擎

## 当前文档内容

- `快速开始`：最小启动方式
- `MCP 配置`：客户端配置示例和环境变量说明
