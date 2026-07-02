---
layout: home

hero:
  name: Search MCP
  text: 首个公开版本文档
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
  - title: 本地优先
    details: 默认通过本地抓取与解析链路提供 `web_search`、`news_search`、`content` 和 `jina_content`。
  - title: 多引擎搜索
    details: 当前支持 `baidu`、`bing`、`startpage`、`duckduckgo`、`brave`、`qwant`、`yahoo`、`mojeek`、`toutiao`。
  - title: 简单接入
    details: 直接通过 `npx -y @endday/search-mcp` 启动，再在 MCP 客户端里配置 `command` 和 `args` 即可。
---

## 这是什么

`@endday/search-mcp` 是一个本地优先的 MCP 包，主要提供：

- `web_search`
- `news_search`
- `content`
- `jina_content`

适合需要在 Claude Code、Claude Desktop、Codex、OpenClaw 这类 MCP 客户端里直接接入本地搜索能力的场景。

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

## 推荐阅读顺序

1. 先看“快速开始”
2. 再看 “MCP 配置”
3. 最后按需要调整环境变量和默认引擎

## 当前文档内容

- `快速开始`：最小启动方式
- `MCP 配置`：客户端配置示例和环境变量说明
