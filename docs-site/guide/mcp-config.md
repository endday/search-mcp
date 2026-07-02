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

## 大多数用户其实不用配环境变量

默认情况下，直接用这份配置就可以启动。

对普通用户来说，真正常用的通常只有下面两个：

- `JINA_API_KEY`
- `JINA_BASE_URL`

它们只影响 `jina_content`。

## 可选高级变量

只有在你明确需要改默认行为时，才需要关心下面这些变量：

- `SUPPORTED_ENGINES`
  用来限制可用引擎范围。
- `DEFAULT_ENGINES`
  用来改默认引擎组合。
- `DEFAULT_ENGINES_ZH`
  用来改中文查询默认引擎组合。
- `DEFAULT_ENGINES_NON_ZH`
  用来改非中文查询默认引擎组合。
- `SEARCH_MCP_PROXY_URL`
  只有你本地请求必须经过代理时才需要。
- `SEARCH_MCP_UPSTREAM_CLIENT`
  默认 `auto` 即可；只有调试上游请求行为时才需要改成 `impit` 或 `fetch`。
- `SEARCH_MCP_IGNORE_TLS_ERRORS`
  只用于调试异常 TLS 环境，不建议普通使用。
- `SEARCH_MCP_CLIENT_ID`
  默认会自动生成，本地一般不需要手动设置。

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
