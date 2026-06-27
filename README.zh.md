# Search MCP

[English](./README.md) | 中文

> 基于 Cloudflare Workers 的聚合搜索 API 服务

> 支持 **MCP (Model Context Protocol)**，让 AI 助手（OpenClaw、Claude Code、Codex、OpenCode）拥有实时联网搜索能力

## 特性

- 🔍 **多引擎并行搜索** - 同时查询多个引擎（Startpage、Bing、DuckDuckGo、Brave、Mojeek、Qwant、Yahoo）
- 🤖 **AI 增强 (MCP)** - 原生支持 Model Context Protocol，一键为 **OpenClaw** / **Claude Code** / **Codex** 添加搜索工具
- ⚡ **并行搜索** - 全部请求的引擎并行启动，无优先级链
- 🛡️ **容错机制** - 分类处理超时、解析失败、上游异常，并对不健康引擎做冷却
- 🧹 **去重与排序** - URL 归一化、跨引擎去重、按来源权威度和相关性排序
- 💾 **KV 缓存** - 支持新鲜缓存和 `stale-if-error` 兜底缓存
- 🚦 **简单限流** - 基于 token / IP 的固定窗口限流，可绑定 KV 跨 isolate 共享状态
- ⏱️ **超时控制** - 可配置请求超时时间，避免长时间等待
- 🪂 **提前停止** - 去重结果达到阈值后中止其余在途引擎
- 🔒 **Token 鉴权** - 支持 Token 认证，保护服务不被滥用
- 🧾 **直连内容读取接口** - `/content` 不使用浏览器渲染，直接抓取服务端 HTML 并抽取疑似正文
- 📄 **渲染 Markdown API** - 可选 `/markdown` 接口，基于 Cloudflare Browser Rendering 读取 SPA 页面
- 🌍 **CORS 支持** - 可配置的跨域资源共享支持
- 🎨 **Web 界面** - 提供简洁的搜索界面，方便测试
- ⚡ **零成本运行** - Cloudflare Workers 免费版每天 10 万次请求

## 页面展示

![screenshot](./screenshot.png)

## MCP 集成：在 OpenClaw / Claude Code / AI Agent 中使用

通过 MCP (Model Context Protocol) 让 AI 助手直接调用你的搜索服务，获取实时搜索结果。

### 安装配置



#### 1. 部署服务

先按照文档 [部署 Search MCP](#安装方式)

#### 2. 添加 MCP 服务器配置

编辑配置文件（[配置指南](https://modelcontextprotocol.io/quickstart/user)）：

- **OpenClaw**: `~/.openclaw/openclaw.json`
- **Claude Code**: `~/.claude/config.json` / `~/.claude.json`
- **Claude Desktop macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "search-mcp": {
      "command": "npx",
      "args": ["-y", "@endday/search-mcp"],
      "env": {
        "SEARCH_MCP_URL": "https://your-worker.workers.dev",
        "SEARCH_MCP_TOKEN": "your-token-here"
      }
    }
  }
}
```

#### 观测响应头

- `X-Search-Request-Id`：请求唯一 ID，方便日志排查
- `X-Search-Cache`：`miss` / `hit` / `revalidated` / `stale-if-error`
- `X-Search-Fallback-Order`：本次请求查询的引擎
- `X-Search-Fallback-Path`：本次实际触发过的引擎路径
- `X-Search-Duration-Ms`：网关总耗时
- `Server-Timing`：各引擎耗时

**环境变量说明**：

- `SEARCH_MCP_URL`: Worker 部署地址（必填）
- `SEARCH_MCP_TOKEN`: 鉴权 Token（如果 Worker 配置了 TOKEN 则必填）
- `JINA_API_KEY`: Jina AI API 密钥，用于更高速率限制（可选，免费版无需密钥）
- `JINA_BASE_URL`: Jina 阅读器基础 URL（可选，默认 `https://r.jina.ai/`）

MCP 包会暴露 `web_search` / `content` / `jina_content` 三个工具：`web_search` 返回带摘要和来源权威分的去重搜索结果，`content` 通过 Worker 的 Readability 提取器抽取指定 URL 正文，`jina_content` 通过 Jina AI 阅读器提取正文（每用户独立速率限制）。

#### 3. 验证安装

- **OpenClaw**: `openclaw gateway restart` + `openclaw mcp list` 能看到 `search-mcp`
- **Claude Code**:
  - 在 Claude Code 中运行 `/mcp` 命令，应该能看到 `search-mcp` 工具。
  - 或 使用 `claude mcp list`, 看到 `search-mcp: npx -y @endday/search-mcp@latest - ✓ Connected` 说明配置成功

## 安装方式

### 方式一：一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/endday/search-mcp)

点击上方按钮，按照提示完成部署。

### 方式二：使用 Wrangler CLI

```bash
# 1. 安装 Wrangler
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 克隆仓库
git clone https://github.com/endday/search-mcp.git
cd search-mcp

# 4. 部署
wrangler deploy

# 可选：验证线上 Worker
SMOKE_BASE_URL=https://your-worker-name.your-subdomain.workers.dev \
SMOKE_TOKEN=$YOUR-TOKEN \
npm run smoke
```

### 方式三：使用 Cloudflare Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 点击 **Create Application** > **Create Worker**
4. 点击 **Upload** 上传本地代码文件夹
   - 选择克隆的 `search-mcp` 文件夹
   - 或者手动复制 `worker.js`、`envs.js`、`utils/` 等文件
5. 点击 **Save and Deploy**

### 获取访问地址

部署成功后，你会获得一个 Worker URL：

```
https://your-worker-name.your-subdomain.workers.dev
```

> **重要提示**：Cloudflare 默认的 `*.workers.dev` 域名在中国大陆等地区可能无法直接访问。如需稳定访问，请绑定自己的域名：**Cloudflare Dashboard → Workers → 你的 Worker → Triggers → Custom Domains**。下方所有 API 示例中的 `https://$YOUR-DOMAIN` 请替换为你的实际域名。

## 使用方式

### 方式 1: Web 界面

直接访问你的 Worker URL，在网页界面输入搜索关键词：

```
https://$YOUR-DOMAIN/
```

### 方式 2: API 请求（GET）

使用查询参数进行搜索：

```bash
# 基本搜索
curl "https://$YOUR-DOMAIN/search?q=cloudflare"

# 指定搜索引擎
curl "https://$YOUR-DOMAIN/search?q=cloudflare&engines=startpage,duckduckgo"

# 使用 token 鉴权（推荐使用 Authorization 头）
curl "https://$YOUR-DOMAIN/search?q=cloudflare" \
  -H "Authorization: Bearer $YOUR-TOKEN"
```

### 方式 3: API 请求（POST）

通过 POST 表单提交搜索：

```bash
curl -X POST "https://$YOUR-DOMAIN/search" \
  -d "q=cloudflare" \
  -d "engines=startpage,duckduckgo" \
  -H "Authorization: Bearer $YOUR-TOKEN" # 如果配置了 TOKEN 环境变量
```

## API 接口说明

### `/search` 接口

用于执行搜索查询并返回聚合结果。

#### 请求参数

| 参数          | 类型     | 必填   | 说明                                      | 示例           |
| ------------- | -------- | ------ | ----------------------------------------- | -------------- |
| `q` / `query` | `string` | yes    | 搜索关键词                                | `cloudflare`   |
| `engines`     | `string`/`array` | yes     | 必填。并行查询的引擎，逗号分隔或数组 | `startpage,bing` |
| `language`    | `string` | no     | 语言/地区提示，传给支持的搜索引擎         | `en`、`zh-CN` |
| `location`    | `string` | no     | 位置提示，默认 `off`；传 `auto` 才使用 Cloudflare `request.cf.city` / `region` | `auto`、`上海`、`off` |
| `time_range`  | `string` | no     | 时间范围：`day`、`week`、`month`、`year` | `month` |
| `pageno`      | `number` | no     | 从 0 开始的页码                           | `0` |
| `min_authority_score` | `number` | no | 排名后保留的最低确定性来源权威分 | `1` |
| `include_source_types` | `string` | no | 只保留这些来源类型，多个用逗号分隔 | `official,benchmark,paper,media` |
| `exclude_source_types` | `string` | no | 排除这些来源类型，多个用逗号分隔 | `community,blog,low_credibility` |
| `token`       | `string` | no/yes | 兼容参数形式的访问令牌；更推荐使用 `Authorization: Bearer ...` | `$YOUR-TOKEN`  |

默认不会追加位置。只有传 `location=auto` 时，Worker 才会在 Cloudflare `request.cf` 提供城市或地区时把它追加到实际上游搜索词里，并在响应中同时返回原始 `query` 和实际使用的 `effective_query`。如果是 MCP / 代理调用，这个位置代表调用方或代理出口 IP；也可以传具体位置，如 `location=上海`。

**支持的搜索引擎**：

- `bing` - Bing 搜索
- `startpage` - Startpage 搜索
- `mojeek` - Mojeek 搜索
- `duckduckgo` - DuckDuckGo 搜索
- `brave` - Brave 搜索
- `qwant` - Qwant Lite 搜索
- `yahoo` - Yahoo 搜索

#### 返回值

```typescript
{
  query: string;                    // 搜索关键词
  effective_query: string;          // 追加位置后的实际上游搜索词
  location: string | null;          // 解析到的位置
  location_source: string;          // auto / explicit / disabled / unavailable
  number_of_results: number;        // 结果总数
  enabled_engines: string[];        // 启用的搜索引擎列表
  skipped_engines: Array<{          // 搜索前被跳过的请求引擎
    engine: string;
    reason: string;
  }>;
  unresponsive_engines: string[];   // 无响应的搜索引擎列表
  source_filters?: {                // 启用来源过滤时返回
    include_source_types: string[];
    exclude_source_types: string[];
    min_authority_score: number | null;
    active: boolean;
  };
  results: Array<{
    title: string;                  // 结果标题
    description: string;            // 结果描述
    url: string;                    // 结果链接
    engine: string;                 // 来源引擎
    source_type?: string;           // 来源类型，如 official / benchmark / media / blog
    authority_score?: number;       // 确定性来源权威加权分
  }>;
}
```

#### 请求示例

```bash
# GET 请求
curl "https://$YOUR-DOMAIN/search?q=cloudflare&engines=startpage,duckduckgo"

# 默认 location=off，不会追加访问者城市/地区
curl "https://$YOUR-DOMAIN/search?q=%E6%98%8E%E5%A4%A9%E5%A4%A9%E6%B0%94"

# 手动指定或开启自动位置增强
curl "https://$YOUR-DOMAIN/search?q=%E6%98%8E%E5%A4%A9%E5%A4%A9%E6%B0%94&location=%E4%B8%8A%E6%B5%B7"
curl "https://$YOUR-DOMAIN/search?q=cloudflare&location=auto"

# 只保留已知正向权威分来源
curl "https://$YOUR-DOMAIN/search?q=deepseek%20model&min_authority_score=1"

# JSON POST 请求
curl -X POST "https://$YOUR-DOMAIN/search" \
  -H "Content-Type: application/json" \
  -d '{"q":"cloudflare","engines":["startpage","duckduckgo"],"language":"zh-CN","location":"off","time_range":"month"}'

# 表单 POST 请求
curl -X POST "https://$YOUR-DOMAIN/search" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "q=cloudflare&engines=startpage,duckduckgo"
```

#### 响应示例

```json
{
  "query": "cloudflare",
  "effective_query": "cloudflare",
  "location": null,
  "location_source": "disabled",
  "number_of_results": 15,
  "enabled_engines": ["startpage", "duckduckgo", "brave", "mojeek", "bing"],
  "skipped_engines": [],
  "unresponsive_engines": [],
  "results": [
    {
      "title": "Cloudflare - The Web Performance & Security Company",
      "description": "Cloudflare is on a mission to help build a better Internet...",
      "url": "https://www.cloudflare.com/",
      "engine": "startpage"
    },
    {
      "title": "Cloudflare Workers",
      "description": "Deploy serverless code instantly across the globe...",
      "url": "https://workers.cloudflare.com/",
      "engine": "startpage"
    }
  ]
}
```

### `/markdown` 接口

使用 Cloudflare Browser Rendering 加载页面并返回渲染后的 Markdown。它适合普通 Worker `fetch()` 看不到最终内容的 SPA 页面。

需要配置 `CF_BROWSER_RENDERING_ACCOUNT_ID` 和 `CF_BROWSER_RENDERING_API_TOKEN`。如果配置了 `TOKEN`，`/markdown` 也需要和 `/search` 相同的访问令牌。

#### 请求参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| ---- | ---- | ---- | ---- | ---- |
| `url` | `string` | yes | 目标页面 URL，仅允许公开的 `http` 和 `https` 地址 | `https://example.com/article` |
| `wait_until` | `string` | no | 浏览器导航等待模式：`load`、`domcontentloaded`、`networkidle0`、`networkidle2` | `networkidle2` |
| `wait_for_selector` | `string` | no | 抽取 Markdown 前等待的选择器 | `main` |
| `timeout_ms` | `number` | no | 浏览器超时，限制在 1,000-60,000 ms | `30000` |
| `user_agent` | `string` | no | 可选 User-Agent 覆盖 | `Mozilla/5.0 ...` |
| `token` | `string` | no/yes | 兼容参数形式的访问令牌；更推荐使用 `Authorization: Bearer ...` | `$YOUR-TOKEN` |

#### 请求示例

```bash
curl "https://$YOUR-DOMAIN/markdown?url=https%3A%2F%2Fexample.com%2Farticle&wait_until=networkidle2" \
  -H "Authorization: Bearer $YOUR-TOKEN"
```

#### 响应示例

```json
{
  "url": "https://example.com/article",
  "source": "cloudflare-browser-rendering",
  "markdown": "# Example\n\nRendered content",
  "metadata": {},
  "browser_ms_used": 4200,
  "duration_ms": 5100
}
```

响应会在 Cloudflare 返回时透传 `X-Browser-Ms-Used`，方便统计 Browser Rendering 配额消耗。

### `/content` 接口

通过 Worker 直接抓取页面，并在不使用 Cloudflare Browser Rendering 的情况下抽取疑似正文 HTML。它不会执行 JavaScript，因此更适合服务端渲染的文章、博客、文档和新闻页面。

如果配置了 `TOKEN`，`/content` 也需要和 `/search` 相同的访问令牌。`/html` 会保留为兼容别名。

抽取器使用轻量启发式策略：移除明显噪音节点，按文本密度、段落数量、正负 class/id 线索、链接密度给候选块打分，然后返回最像正文的块。

#### 请求参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| ---- | ---- | ---- | ---- | ---- |
| `url` | `string` | yes | 目标页面 URL，仅允许公开的 `http` 和 `https` 地址 | `https://example.com/article` |
| `max_bytes` | `number` | no | 允许读取的最大上游响应大小，限制在 50,000-5,000,000 字节 | `1500000` |
| `token` | `string` | no/yes | 兼容参数形式的访问令牌；更推荐使用 `Authorization: Bearer ...` | `$YOUR-TOKEN` |

#### 请求示例

```bash
curl "https://$YOUR-DOMAIN/content?url=https%3A%2F%2Fexample.com%2Farticle" \
  -H "Authorization: Bearer $YOUR-TOKEN"
```

#### 响应示例

```json
{
  "url": "https://example.com/article",
  "source": "direct-fetch",
  "title": "Example Article",
  "description": "Short page summary",
  "html": "<article>...</article>",
  "text": "Readable article text...",
  "excerpt": "Readable article text...",
  "stats": {
    "text_length": 1234,
    "html_length": 1800,
    "score": 1600,
    "link_density": 0.08,
    "paragraph_count": 6
  }
}
```

### `/auth/verify` 接口

校验当前请求是否已通过鉴权。Web 界面点击"验证"按钮时会调用此接口，确认 token 是否有效。

如果配置了 `TOKEN`，`/auth/verify` 也需要和 `/search` 相同的访问令牌（token 或 session cookie）。

#### 请求示例

```bash
curl "https://$YOUR-DOMAIN/auth/verify" \
  -H "Authorization: Bearer $YOUR-TOKEN"
```

#### 响应示例

```json
{
  "authorized": true,
  "token_required": true,
  "auth_method": "token"
}
```

`auth_method` 取值为 `token`、`session` 或 `none`。当 `token_required` 为 `false` 时表示服务未开启鉴权，任意 token 都会被接受。

### `/geo` 接口

返回当前调用方的 Cloudflare `request.cf` 地理位置信息，便于预览 `location=auto` 会追加到上游搜索词的内容。

#### 请求示例

```bash
curl "https://$YOUR-DOMAIN/geo"
```

#### 响应示例

```json
{
  "geo": {
    "city": "上海",
    "region": "上海",
    "country": "CN"
  }
}
```

返回字段取决于 Cloudflare 对该请求暴露的数据，没有地理信息时可能为空。

## 搜索引擎说明

### 支持的搜索引擎

| 引擎           | 说明                           | 是否需要配置                  | 默认角色 |
| -------------- | ------------------------------ | ----------------------------- | -------- |
| **Startpage**  | 序列化 SERP 结果               | -                             | 默认 |
| **DuckDuckGo** | HTML 搜索接口                  | -                             | 默认 |
| **Brave**      | HTML 结果解析（已去掉 `eval`） | -                             | 默认 |
| **Mojeek**     | 简单 HTML 解析                 | -                             | 默认 |
| **Bing**       | HTML / RSS 搜索解析            | -                             | 默认 |
| **Qwant**      | Qwant Lite HTML 解析           | -                             | 可选 |
| **Yahoo**      | HTML 搜索解析                  | -                             | 可选 |

### 基本工作方案

1. **并行搜索**：`engines` 为必填，全部请求的引擎并行启动（无优先级链）
2. **提前停止**：当去重后的结果达到 `FALLBACK_MIN_RESULTS` 且至少 `FALLBACK_MIN_CONTRIBUTING_ENGINES` 个引擎贡献结果后停止继续请求
3. **结果归一化**：统一标题、描述、URL，并做去重与简单排序
4. **健康度追踪**：连续失败的引擎会被记录；绑定 `SEARCH_STATE_KV` 后可跨 isolate 共享
5. **KV 缓存**：若绑定 `SEARCH_KV`，会缓存最终 `/search` 响应，并支持 stale-if-error 回退

## 环境变量配置

### 环境变量说明

| 变量名            | 类型     | 默认值   | 说明                                              |
| ----------------- | -------- | -------- | ------------------------------------------------- |
| `DEFAULT_ENGINES` | `string`/`array` | `startpage,bing,duckduckgo,brave,mojeek` | 首页 demo 默认勾选的引擎（API 必传 `engines`） |
| `DEFAULT_TIMEOUT` | `string` | `"4000"` | 单个搜索引擎的超时时间（毫秒）                    |
| `HEDGED_FALLBACK_DELAY_MS` | `string` | `"400"` | 已废弃 — 并行模式下不再使用 |
| `FALLBACK_MIN_RESULTS` | `string` | `"6"` | 达到该去重结果数后停止 fallback                   |
| `FALLBACK_MIN_CONTRIBUTING_ENGINES` | `string` | `"2"` | 提前停止前至少需要贡献结果的引擎数 |
| `CACHE_TTL_SECONDS` | `string` | `"300"` | KV 缓存 TTL；设为 `0` 可关闭缓存                  |
| `STALE_CACHE_TTL_SECONDS` | `string` | `"1800"` | 过期缓存可在错误时兜底返回的保留时间（秒）     |
| `RATE_LIMIT_WINDOW_SECONDS` | `string` | `"60"` | 限流窗口大小（秒）                            |
| `RATE_LIMIT_MAX_REQUESTS` | `string` | `"60"` | 每个 token / IP 在窗口内允许的请求数            |
| `HEALTH_FAILURE_THRESHOLD` | `string` | `"2"` | 引擎进入冷却前允许的连续失败次数                |
| `HEALTH_COOLDOWN_SECONDS` | `string` | `"180"` | 引擎冷却时间（秒）                            |
| `HEALTH_STATE_TTL_SECONDS` | `string` | `"3600"` | 引擎健康状态在 KV 中的保留时间（秒）          |
| `CORS_ALLOWED_ORIGINS` | `string`/`array` | `*` | 允许发起浏览器请求的来源；设置具体域名可收紧 CORS |
| `CORS_ALLOWED_HEADERS` | `string`/`array` | `Authorization,Content-Type,x-api-key` | 允许的 CORS 请求头 |
| `AUTH_REQUIRED` | `string` | `"false"` | 设置为 `"true"` 后，如果没有配置 `TOKEN`，受保护接口会 fail closed |
| `TOKEN`           | `string` | `null`   | 访问令牌，配置后启用鉴权，保护服务不被滥用        |
| `CF_BROWSER_RENDERING_ACCOUNT_ID` | `string` | `null` | `/markdown` 使用的 Cloudflare account ID |
| `CF_BROWSER_RENDERING_API_TOKEN` | `string` | `null` | `/markdown` 使用的 Browser Rendering - Edit 权限 API token |

**注意**：

- 公开部署建议设置 `AUTH_REQUIRED = "true"`，并用 `wrangler secret put TOKEN` 配置访问令牌
- `TOKEN` 配置后，受保护接口需要提供有效的 token
- `/markdown` 会消耗 Cloudflare Browser Rendering 配额；公开部署时建议开启 `TOKEN`
- 绑定 `SEARCH_STATE_KV` 后，限流计数和引擎健康度会跨 isolate 共享；KV 写入是最终一致，不是强原子限流
- 绑定 `SEARCH_KV` 后即可启用跨请求缓存；若实时请求失败且 stale 缓存仍在有效期，会返回 stale 结果

### 配置方式

#### 方式 1: wrangler.toml 文件

编辑 `wrangler.toml` 文件中的 `[vars]` 部分：

```toml
[vars]
DEFAULT_ENGINES = "startpage,bing,duckduckgo,brave,mojeek"
DEFAULT_TIMEOUT = "4000"
FALLBACK_MIN_CONTRIBUTING_ENGINES = "2"
CACHE_TTL_SECONDS = "300"
STALE_CACHE_TTL_SECONDS = "1800"
RATE_LIMIT_MAX_REQUESTS = "60"
HEALTH_STATE_TTL_SECONDS = "3600"
CORS_ALLOWED_ORIGINS = "https://app.example.com"
AUTH_REQUIRED = "true"
CF_BROWSER_RENDERING_ACCOUNT_ID = "your-account-id"
CF_BROWSER_RENDERING_API_TOKEN = "your-browser-rendering-api-token"

[[kv_namespaces]]
binding = "SEARCH_KV"
id = "your-kv-namespace-id"

[[kv_namespaces]]
binding = "SEARCH_STATE_KV"
id = "your-state-kv-namespace-id"
```

真实访问令牌不要写入 `wrangler.toml`。请使用：

```bash
wrangler secret put TOKEN
```

#### 方式 2: Cloudflare Dashboard

1. 进入 Worker 设置页面
2. 找到 **Environment Variables** 部分
3. 添加变量并保存

## 使用场景

### 1. 聚合搜索服务

构建自己的搜索聚合 API，整合多个搜索引擎结果：

```javascript
const response = await fetch(
  "https://$YOUR-DOMAIN/search?q=javascript&engines=startpage,duckduckgo",
);
const data = await response.json();
console.log(`找到 ${data.number_of_results} 个结果`);
```

### 2. 前端搜索功能

为网站或应用添加搜索功能：

```javascript
async function search(query) {
  const response = await fetch(
    `https://$YOUR-DOMAIN/search?q=${encodeURIComponent(query)}`,
  );
  const data = await response.json();
  return data.results;
}
```

### 3. 数据采集与分析

收集多个搜索引擎的结果进行对比分析：

```javascript
const engines = ["startpage", "duckduckgo", "brave"];
const results = await fetch(
  `https://$YOUR-DOMAIN/search?q=AI&engines=${engines.join(",")}`,
);
const data = await results.json();

// 按引擎分组
const byEngine = data.results.reduce((acc, result) => {
  acc[result.engine] = acc[result.engine] || [];
  acc[result.engine].push(result);
  return acc;
}, {});
```

## 注意与提醒

### 🚨 重要提示

1. **使用自定义域名**
   - Cloudflare 默认的 `*.workers.dev` 域名在某些地区可能无法访问
   - **强烈建议**绑定自己的域名以获得更好的访问体验
   - 在 Worker 设置中点击 **Triggers** > **Add Custom Domain** 添加自定义域名

2. **搜索引擎限制**
   - HTML 抓取引擎页面结构可能变化，建议保留 parser fixture 测试
   - 搜索引擎一般没有严格公开配额，但请合理使用
   - 频繁请求可能导致被临时限制访问

3. **超时设置**
   - 默认单个引擎超时 4 秒
   - 可通过环境变量 `DEFAULT_TIMEOUT` 调整
   - 建议不要设置过长，避免整体响应时间过长

### 🔒 安全配置

#### 启用鉴权

1. 配置 `TOKEN` secret 来保护你的服务不被滥用：

- 推荐使用 `wrangler secret put TOKEN`
- 或通过 Cloudflare Worker Dashboard 配置加密 secret
- `wrangler.toml` 中保留 `AUTH_REQUIRED = "true"`，避免忘记配置 token 时公开服务

2. 在请求时传入 token：

```bash
# 首页
# 打开页面后，在内置 token 输入框中填写

# 推荐：Authorization 头
curl "https://$YOUR-DOMAIN/search?q=cloudflare" \
  -H "Authorization: Bearer $YOUR-TOKEN"

curl -X POST "https://$YOUR-DOMAIN/search" \
  -d "q=cloudflare" \
  -H "Authorization: Bearer $YOUR-TOKEN"

# 兼容旧用法：仍支持 query/body 里的 token 参数
curl "https://$YOUR-DOMAIN/search?q=cloudflare&token=$YOUR-TOKEN"
```

#### 鉴权方式

受保护接口（`/search`、`/content`、`/markdown`、`/auth/verify`）接受以下任意一种方式：

- `Authorization: Bearer <token>` 请求头（推荐）
- `x-api-key: <token>` 请求头
- `token` 查询/表单参数（兼容旧用法）
- Session cookie，打开 Web 界面时自动签发

#### Session Cookie

打开 Web 界面 `/` 时，Worker 会自动签发一个 `search_mcp_sid` cookie（24 小时 TTL，滑动续期），并写入 `SEARCH_STATE_KV`（未绑定 KV 时回退到内存）。这样 demo 页面在不带 token 的情况下也能调用受保护接口，靠这个 session 完成鉴权。在页面上点击"验证"可确认 session 是否有效。程序化 API 调用方仍应使用 token。

当 `AUTH_REQUIRED = "true"` 但未配置 `TOKEN` 时，受保护接口会返回 `503 AUTH_TOKEN_NOT_CONFIGURED` 而不是 `401`，用于提示这是部署配置错误，而非客户端鉴权失败。

## 常见问题

### Q: 为什么有些搜索引擎返回结果为空？

A: 可能原因：

- 搜索引擎 API 临时不可用或响应超时
- 搜索关键词没有相关结果
- 搜索引擎限制了访问频率

可以查看返回的 `skipped_engines` 和 `unresponsive_engines` 字段，了解哪些引擎在搜索前被过滤或在搜索时无响应。

### Q: 如何提高搜索速度？

A: 建议：

- 保持默认 fallback 链路，让网关在拿到足够结果后提前停止
- 绑定 `SEARCH_KV` 并合理设置 `CACHE_TTL_SECONDS`
- 配合 `STALE_CACHE_TTL_SECONDS` 提升上游失败时的可用性
- 绑定 `SEARCH_STATE_KV`，让限流和引擎健康度跨 isolate 共享
- 结合 `DEFAULT_TIMEOUT`、`FALLBACK_MIN_RESULTS` 和 `FALLBACK_MIN_CONTRIBUTING_ENGINES` 做调优

### Q: 搜索是怎么工作的？

A: `engines` 为必填。全部请求的引擎并行启动 —— 没有优先级链，也没有 hedged fallback。当去重结果数达到 `FALLBACK_MIN_RESULTS` 且至少 `FALLBACK_MIN_CONTRIBUTING_ENGINES` 个引擎贡献结果后，其余在途引擎会被中止（提前停止）。无响应的引擎会写入 `unresponsive_engines` 并记录到健康状态，但健康状态不再影响哪些引擎会运行。

### Q: 如何保护服务不被滥用？

A: 建议配置 `TOKEN` secret 启用鉴权：

1. 运行 `wrangler secret put TOKEN`
2. 保留 `wrangler.toml` 中的 `AUTH_REQUIRED = "true"`
3. 或在 Cloudflare Dashboard 的 Environment Variables 中添加加密 secret
4. 配置后受保护接口都需要提供有效的 token

鉴权失败会返回 401 错误

### Q: 限流是不是全局强一致？

A: 绑定 `SEARCH_STATE_KV` 后，限流计数会跨 isolate 共享，适合基础防滥用。但 Cloudflare KV 写入是最终一致，不是严格原子计数；如果你需要强一致全局限流，建议后续接入 Durable Objects。

限流桶按鉴权方式区分：token 请求以 token 为 key，session cookie 请求以 `session:<id>` 为 key（Web 界面用户不会和匿名 IP 共享桶），未鉴权请求回退到调用方 IP。

## 免责声明

本项目仅供学习和研究使用，使用者需遵守以下规定：

1. **合法使用** - 仅用于合法搜索需求，不得用于违法或侵权用途
2. **服务条款** - 使用时需遵守 Cloudflare Workers 和各搜索引擎的服务条款
3. **API 限制** - 遵守各搜索引擎 API 的使用限制和配额
4. **责任自负** - 使用本服务产生的任何后果由使用者自行承担
5. **商业用途** - 如需商业使用，请确保符合相关法律法规和服务条款

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

[GPL-3 License](LICENSE)

## 相关链接

- [项目 GitHub](https://github.com/endday/search-mcp)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
