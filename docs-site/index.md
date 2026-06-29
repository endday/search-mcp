---
layout: home

hero:
  name: Search MCP
  text: 本地搜索，不再兜远程
  tagline: 一个面向 MCP 客户端的本地搜索聚合与正文提取服务。首页现在收敛成文档入口，后续内容建议统一迁到 VitePress。
  image:
    src: /mark.svg
    alt: Search MCP
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看架构
      link: /architecture/overview
    - theme: alt
      text: GitHub
      link: https://github.com/endday/search-mcp

features:
  - title: 只走本地 MCP
    details: MCP 工具现在默认只走本地抓取与解析链路，不再依赖远程 Worker 作为回退路径。
  - title: 文档优先
    details: 首页不再承担搜索台职责，文档站负责接入说明、架构原则和产品路线，维护成本更低。
  - title: Vite 生态最省事
    details: 这类项目最合适的方案就是 VitePress。Markdown 驱动、导航和搜索能力成熟，比继续手写 Worker HTML 更稳。
---

## 为什么现在切文档站

现在这个项目的 Web 首页已经不是核心产品能力。真正的主线是：

- MCP 客户端如何接入
- 本地搜索与正文提取如何工作
- 后续架构和版本如何演进

这三类内容都更适合放到文档站，而不是继续塞在 Worker 返回的内联 HTML 里。

## 推荐迁移顺序

1. 先用 VitePress 接住首页、快速开始和核心设计说明。
2. 再把根目录 `README`、`README.zh` 以及 `docs/` 下的文章逐步迁到分层目录。
3. 最后让 Worker 首页只保留一个很轻的文档入口或跳转。

## 当前站点结构

- `Guide`：给用户看，讲怎么接入本地 MCP、怎么配置客户端。
- `Architecture`：给维护者看，讲代码结构、职责边界和搜索网关设计。
- `Product`：给产品和策略讨论用，放策略引擎、路线图、产品草案。

