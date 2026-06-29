# MCP 配置

## Claude Code / Claude Desktop / OpenClaw

把下面这段加入你的 MCP 客户端配置文件：

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

## 建议保留的环境变量

- `SEARCH_MCP_CLIENT_ID`
- `JINA_API_KEY`
- `JINA_BASE_URL`

## 已删除的远程变量

下面这些变量已经不应该再作为 MCP 文档主路径继续推广：

- `SEARCH_MCP_URL`
- `SEARCH_MCP_MODE=remote`
- `SEARCH_MCP_MODE=hybrid`

当前仓库不会再消费这些变量。

## 验证方式

1. 重启你的客户端。
2. 在客户端里查看 MCP 工具列表。
3. 确认 `search-mcp` 已连接。
