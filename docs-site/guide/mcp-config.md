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

## 常用环境变量

- `SEARCH_MCP_CLIENT_ID`
- `SEARCH_MCP_UPSTREAM_CLIENT`（`auto`、`impit`、`fetch`）
- `SEARCH_MCP_PROXY_URL`
- `SEARCH_MCP_IGNORE_TLS_ERRORS`
- `SUPPORTED_ENGINES`
- `DEFAULT_ENGINES`
- `DEFAULT_ENGINES_ZH`
- `DEFAULT_ENGINES_NON_ZH`
- `JINA_API_KEY`
- `JINA_BASE_URL`

## 搜索引擎选择

当前支持：

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

## 验证方式

1. 重启你的客户端。
2. 在客户端里查看 MCP 工具列表。
3. 确认 `search-mcp` 已连接。
