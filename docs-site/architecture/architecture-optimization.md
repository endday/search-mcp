# 代码架构优化建议

原文位于仓库中的 `docs/architecture-optimization.zh.md`。

这份文档讨论代码结构，而不是产品路线。原文里不少内容来自早期 Worker 形态；现在远程入口已经删掉，剩下仍然有效的结论主要是：

- Worker 和 MCP 的能力定义应该尽量统一
- 配置不该依赖全局可变状态
- 搜索编排逻辑已经值得被视为独立服务层

## 迁入文档站的意义

把这类文档搬进 VitePress 后，有两个直接收益：

1. 维护者能更快找到架构讨论，不再混在 README 和 UI 页面里。
2. 后续可以继续拆成多篇短文，而不是长期维护一篇超长 markdown。

## 下一步建议

后续可以把原文继续拆成：

- Route 层职责
- Search service 层
- Platform / Infra 层
- 测试结构与演进

完整原文请回看仓库中的 `docs/architecture-optimization.zh.md`。
