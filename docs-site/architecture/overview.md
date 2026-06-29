# 架构概览

当前仓库已经收敛成两条清晰的线：

## 运行时能力

- MCP 层：本地 `stdio` server，对外暴露 `web_search`、`content`、`jina_content`
- 本地搜索与正文提取共享 `src/search`、`src/content`、`src/platform` 的底层能力

## 文档与产品表达

- 旧状态：首页和 Worker 接口同时承担产品入口
- 新状态：仓库只保留本地 MCP 包，详细说明迁到 VitePress

## 当前建议的职责边界

- MCP：保留本地搜索和正文提取
- VitePress：承接 README、架构、路线图、产品草案

## 为什么这样分

这样拆以后：

- 文档协作更顺
- 代码和内容变更不会相互缠绕
- 首页不会再主导后端设计
- 对外信息结构更稳定
