import { env } from "../envs.js";

// ============================================
// HTML 界面 - HTML UI
// ============================================

export function getSearchHtml() {
  const AUTH_REQUIRED = ["1", "true", "yes", "on", "required"].includes(
    String(env.AUTH_REQUIRED || "").trim().toLowerCase()
  );
  const TOKEN_CONFIGURED = !!env.TOKEN;
  const TOKEN_ENABLED = TOKEN_CONFIGURED || AUTH_REQUIRED;
  const DEFAULT_ENGINES = env.DEFAULT_ENGINES || [];
  const handlerEngineDefaultChecked = (engine) =>
    DEFAULT_ENGINES.includes(engine) ? "checked" : "";
  return `<!DOCTYPE html>
<html lang="zh-CN" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloudflare Search - 多引擎聚合搜索服务</title>
  <meta name="description" content="基于 Cloudflare Workers 的多引擎搜索聚合服务,兼容 SearXNG API">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔍</text></svg>">

  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            zinc: {
              50: '#fafafa',
              100: '#f4f4f5',
              200: '#e4e4e7',
              300: '#d4d4d8',
              400: '#a1a1aa',
              500: '#71717a',
              600: '#52525b',
              700: '#3f3f46',
              800: '#27272a',
              900: '#18181b',
            },
            blue: {
              400: '#60a5fa',
              500: '#3b82f6',
              600: '#2563eb',
            }
          }
        }
      }
    }
  </script>

  <style>
    :root {
      --page-bg: #f6f1e8;
      --surface: #fffdf8;
      --surface-muted: #f1eadf;
      --ink: #20231f;
      --ink-muted: #6f756b;
      --line: #ded5c8;
      --accent: #0f766e;
      --accent-strong: #115e59;
      --warning: #b45309;
      --danger: #b91c1c;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --page-bg: #121411;
        --surface: #1b1f1b;
        --surface-muted: #252a25;
        --ink: #f3f1e8;
        --ink-muted: #a9afa4;
        --line: #343a33;
        --accent: #5eead4;
        --accent-strong: #99f6e4;
        --warning: #fbbf24;
        --danger: #f87171;
      }
    }

    body {
      background:
        linear-gradient(90deg, rgba(15, 118, 110, 0.08) 1px, transparent 1px),
        linear-gradient(0deg, rgba(15, 118, 110, 0.05) 1px, transparent 1px),
        var(--page-bg);
      background-size: 28px 28px;
      color: var(--ink);
      font-family: Aptos, "Microsoft YaHei UI", "PingFang SC", sans-serif;
      letter-spacing: 0;
    }

    .panel {
      background: color-mix(in srgb, var(--surface) 94%, transparent);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 18px 50px rgba(32, 35, 31, 0.08);
    }

    .muted-panel {
      background: var(--surface-muted);
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    .field {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      color: var(--ink);
      padding: 0.72rem 0.85rem;
      font-size: 0.92rem;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .field:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
    }

    .action-btn {
      border-radius: 8px;
      background: var(--ink);
      color: var(--surface);
      padding: 0.75rem 1rem;
      font-size: 0.92rem;
      font-weight: 700;
      transition: transform 160ms ease, opacity 160ms ease;
    }

    .action-btn:hover {
      transform: translateY(-1px);
      opacity: 0.92;
    }

    .tab-button {
      border: 1px solid transparent;
      border-radius: 8px;
      color: var(--ink-muted);
      padding: 0.6rem 0.85rem;
      font-size: 0.86rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .tab-button.is-active {
      background: var(--surface);
      border-color: var(--line);
      color: var(--ink);
      box-shadow: 0 8px 22px rgba(32, 35, 31, 0.08);
    }

    .tab-panel[hidden] {
      display: none;
    }

    .api-test-panel[hidden] {
      display: none;
    }

    .engine-check {
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      gap: 0.55rem;
      min-height: 42px;
      padding: 0.6rem 0.7rem;
    }

    .code-block {
      background: #16211f;
      border-radius: 8px;
      color: #d7fff6;
      overflow-x: auto;
      padding: 1rem;
    }

    .json-output {
      background: #101817;
      border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
      border-radius: 8px;
      color: #d7fff6;
      max-height: 360px;
      overflow: auto;
      padding: 1rem;
      white-space: pre-wrap;
      word-break: break-word;
    }

    @media (prefers-color-scheme: dark) {
      .code-block {
        background: #0d1110;
      }

      .json-output {
        background: #0b1110;
      }
    }
  </style>
</head>
<body class="min-h-full">
  <div class="min-h-screen">
    <!-- 主内容区域 -->
    <div class="min-h-screen">
      <main class="flex-auto">
        <div class="px-4 py-6 sm:px-6 lg:px-8">
          <div class="mx-auto w-full max-w-7xl lg:px-8">
            <div class="relative">
              <div class="mx-auto flex max-w-6xl flex-col">

                <!-- 标题区域 -->
                <div class="order-1 flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                  <div class="max-w-2xl">
                  <div class="mb-3 inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">Search Gateway</div>
                  <h1 class="text-3xl font-black tracking-tight text-[var(--ink)] sm:text-4xl">
                    Cloudflare Search
                  </h1>
                  <div class="mt-3 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
                    <p class="">
                      基于 Cloudflare Workers 的生产级搜索网关。优先使用 Startpage，结果不足或失败时按 DuckDuckGo、Brave、Mojeek、Bing 顺序兜底。
                    </p>
                    <p class="mt-1">
                      如果这个项目对你有帮助，可以 
                      <a
                        href="https://yrobot.top/donate_wx.jpeg"
                        target="_blank"
                        title="如果这个项目对你有帮助，可以请我喝杯咖啡 ☕"
                        class="font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        请作者喝杯咖啡 ☕️
                      </a>
                    </p>
                  </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-xs text-[var(--ink-muted)] sm:grid-cols-4 lg:grid-cols-2">
                    <div class="muted-panel px-3 py-2"><span class="block font-bold text-[var(--ink)]">7</span> 搜索引擎</div>
                    <div class="muted-panel px-3 py-2"><span class="block font-bold text-[var(--ink)]">KV</span> 限流状态</div>
                    <div class="muted-panel px-3 py-2"><span class="block font-bold text-[var(--ink)]">API</span> GET/POST</div>
                    <div class="muted-panel px-3 py-2"><span class="block font-bold text-[var(--ink)]">MCP</span> AI 工具</div>
                  </div>
                </div>

                <!-- 服务状态 -->
                <div class="order-5 panel mt-5 border-l-4 ${
                  TOKEN_CONFIGURED
                    ? "border-l-teal-600"
                    : AUTH_REQUIRED
                      ? "border-l-red-600"
                      : "border-l-amber-600"
                } p-5">
                  <h2 class="mb-3 text-sm font-bold text-[var(--ink)]">
                    服务配置状态
                  </h2>
                  <div class="space-y-2 text-sm">
                    <div class="flex items-center justify-between">
                      <span class="text-[var(--ink-muted)]">访问鉴权</span>
                      <span class="${
                        TOKEN_CONFIGURED
                          ? "text-green-600 dark:text-green-400"
                          : AUTH_REQUIRED
                            ? "text-red-600 dark:text-red-400"
                            : "text-zinc-500 dark:text-zinc-500"
                      }">
                        ${
                          TOKEN_CONFIGURED
                            ? "✓ 已启用"
                            : AUTH_REQUIRED
                              ? "⚠ 需要配置 TOKEN"
                              : "○ 未启用 (公开访问)"
                        }
                      </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-[var(--ink-muted)]">无 Key 引擎</span>
                      <span class="text-[var(--accent-strong)]">Bing / Startpage / Mojeek / DuckDuckGo / Brave</span>
                    </div>
                  </div>
                  ${
                    AUTH_REQUIRED && !TOKEN_CONFIGURED
                      ? `
                  <div class="mt-4 pt-4 border-t border-red-200 dark:border-red-800/40">
                    <p class="text-xs text-red-700 dark:text-red-400">
                      当前配置要求鉴权，但还没有配置 <code class="px-1 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">TOKEN</code> secret。请先运行 <code class="px-1 py-0.5 bg-red-100 dark:bg-red-900/30 rounded">wrangler secret put TOKEN</code>。
                    </p>
                  </div>
                  `
                      : !TOKEN_ENABLED
                      ? `
                  <div class="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800/40">
                    <p class="text-xs text-amber-700 dark:text-amber-400">
                      💡 建议:为防止服务被滥用,建议配置 <code class="px-1 py-0.5 ${
                        "bg-amber-100 dark:bg-amber-900/30"
                      } rounded">TOKEN</code> secret 启用访问鉴权。
                    </p>
                  </div>
                  `
                      : ""
                  }
                </div>

                <!-- Cloudflare 访问者区域 -->
                <div class="order-6 panel mt-4 p-5">
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Cloudflare 识别的访问者区域
                      </h2>
                      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        由 <code>request.cf</code> 返回，用于解释 <code>location=auto</code>。
                      </p>
                    </div>
                    <span id="geoStatusBadge" class="inline-flex w-fit items-center rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      加载中
                    </span>
                  </div>
                  <div id="geoSummary" class="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
                    正在读取访问者区域...
                  </div>
                  <dl id="geoDetails" class="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2"></dl>
                </div>

                <!-- 搜索表单 -->
                <div class="order-2 panel mt-4 p-5">
                  <h2 class="mb-4 text-sm font-bold text-[var(--ink)]">
                    开始搜索
                  </h2>
                  <form id="searchForm" class="space-y-4">
                    ${
                      TOKEN_ENABLED
                        ? `
                    <div class="muted-panel p-4">
                      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <label for="tokenInput" class="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            访问 Token
                          </label>
                          <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                            仅用于当前页面调试，会保存在本地浏览器，搜索和验证都会走 Authorization 头。
                          </p>
                        </div>
                        <span id="tokenStatusBadge" class="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          未验证
                        </span>
                      </div>
                      <div class="mt-3 flex flex-col gap-3 sm:flex-row">
                        <input
                          type="password"
                          id="tokenInput"
                          placeholder="输入 Bearer Token"
                          autocomplete="off"
                          class="field flex-1"
                        >
                        <button
                          type="button"
                          id="verifyTokenBtn"
                          class="action-btn"
                        >
                          验证 Token
                        </button>
                      </div>
                      <p id="tokenStatusText" class="mt-3 hidden rounded-md px-3 py-2 text-xs"></p>
                    </div>
                    `
                        : ""
                    }
                    <div>
                      <label for="searchQuery" class="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                        搜索关键词
                      </label>
                      <input
                        type="text"
                        id="searchQuery"
                        placeholder="输入您要搜索的内容..."
                        required
                        class="field"
                      >
                    </div>

                    <div>
                      <label for="locationInput" class="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                        位置增强
                      </label>
                      <input
                        type="text"
                        id="locationInput"
                        value="off"
                        placeholder="auto / 上海 / off"
                        class="field"
                      >
                      <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        默认 <code>off</code>，不会追加城市；传 <code>auto</code> 才使用 Cloudflare 提供的访问者城市/地区。
                      </p>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                        选择搜索引擎 (可多选)
                      </label>
                      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <label class="engine-check">
                          <input type="checkbox" name="engine" value="startpage" ${handlerEngineDefaultChecked(
                            "startpage"
                          )} class="rounded text-blue-500 focus:ring-blue-500">
                          <span class="text-sm text-zinc-700 dark:text-zinc-300">Startpage</span>
                        </label>
                        <label class="engine-check">
                          <input type="checkbox" name="engine" value="duckduckgo" ${handlerEngineDefaultChecked(
                            "duckduckgo"
                          )} class="rounded text-blue-500 focus:ring-blue-500">
                          <span class="text-sm text-zinc-700 dark:text-zinc-300">DuckDuckGo</span>
                        </label>
                        <label class="engine-check">
                          <input type="checkbox" name="engine" value="brave" ${handlerEngineDefaultChecked(
                            "brave"
                          )} class="rounded text-blue-500 focus:ring-blue-500">
                          <span class="text-sm text-zinc-700 dark:text-zinc-300">Brave</span>
                        </label>
                        <label class="engine-check">
                          <input type="checkbox" name="engine" value="qwant" ${handlerEngineDefaultChecked(
                            "qwant"
                          )} class="rounded text-blue-500 focus:ring-blue-500">
                          <span class="text-sm text-zinc-700 dark:text-zinc-300">Qwant</span>
                        </label>
                        <label class="engine-check">
                          <input type="checkbox" name="engine" value="yahoo" ${handlerEngineDefaultChecked(
                            "yahoo"
                          )} class="rounded text-blue-500 focus:ring-blue-500">
                          <span class="text-sm text-zinc-700 dark:text-zinc-300">Yahoo</span>
                        </label>
                        <label class="engine-check">
                          <input type="checkbox" name="engine" value="mojeek" ${handlerEngineDefaultChecked(
                            "mojeek"
                          )} class="rounded text-blue-500 focus:ring-blue-500">
                          <span class="text-sm text-zinc-700 dark:text-zinc-300">Mojeek</span>
                        </label>
                        <label class="engine-check">
                          <input type="checkbox" name="engine" value="bing" ${handlerEngineDefaultChecked(
                            "bing"
                          )} class="rounded text-blue-500 focus:ring-blue-500">
                          <span class="text-sm text-zinc-700 dark:text-zinc-300">Bing</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="searchBtn"
                      class="action-btn w-full"
                    >
                      开始搜索
                    </button>
                    <p id="searchStatus" class="hidden rounded-md px-3 py-2 text-sm"></p>
                  </form>
                </div>

                <!-- 接口测试台 -->
                <div class="order-3 panel mt-4 p-5">
                  <div class="flex flex-col gap-3 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 class="text-sm font-bold text-[var(--ink)]">
                        接口测试台
                      </h2>
                      <p class="mt-1 text-xs text-[var(--ink-muted)]">
                        直接调用 Worker API，响应会以 JSON 形式显示。
                      </p>
                    </div>
                    <div class="flex gap-2 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-1" role="tablist" aria-label="API endpoint tests">
                      <button type="button" class="tab-button is-active" data-api-test-target="search" role="tab" aria-selected="true">/search</button>
                      <button type="button" class="tab-button" data-api-test-target="research" role="tab" aria-selected="false">/research</button>
                      <button type="button" class="tab-button" data-api-test-target="content" role="tab" aria-selected="false">/content</button>
                    </div>
                  </div>

                  <section class="api-test-panel mt-4" data-api-test-panel="search" role="tabpanel">
                    <form id="searchApiForm" class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_180px_180px_auto]">
                      <div>
                        <label for="searchApiQuery" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          搜索关键词
                        </label>
                        <input id="searchApiQuery" class="field" type="text" value="cloudflare workers" required>
                      </div>
                      <div>
                        <label for="searchApiMinAuthority" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          最低权威分
                        </label>
                        <input id="searchApiMinAuthority" class="field" type="number" step="1" placeholder="可选">
                      </div>
                      <div>
                        <label for="searchApiIncludeTypes" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          包含来源
                        </label>
                        <input id="searchApiIncludeTypes" class="field" type="text" placeholder="official,media">
                      </div>
                      <div>
                        <label for="searchApiExcludeTypes" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          排除来源
                        </label>
                        <input id="searchApiExcludeTypes" class="field" type="text" placeholder="community,blog">
                      </div>
                      <div class="flex items-end">
                        <button id="searchApiBtn" type="submit" class="action-btn w-full lg:w-auto">测试 /search</button>
                      </div>
                    </form>
                    <p id="searchApiStatus" class="hidden rounded-md px-3 py-2 text-sm"></p>
                    <pre id="searchApiOutput" class="json-output mt-4 text-xs">等待请求...</pre>
                  </section>

                  <section class="api-test-panel mt-4" data-api-test-panel="research" role="tabpanel" hidden>
                    <form id="researchApiForm" class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_100px_120px_120px_180px_180px_auto]">
                      <div>
                        <label for="researchApiQuery" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          研究关键词
                        </label>
                        <input id="researchApiQuery" class="field" type="text" value="cloudflare workers" required>
                      </div>
                      <div>
                        <label for="researchApiLimit" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          来源数
                        </label>
                        <input id="researchApiLimit" class="field" type="number" min="1" max="5" value="3">
                      </div>
                      <div>
                        <label for="researchApiExcerpt" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          摘录字符
                        </label>
                        <input id="researchApiExcerpt" class="field" type="number" min="200" max="4000" value="1200">
                      </div>
                      <div>
                        <label for="researchApiMinAuthority" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          最低权威分
                        </label>
                        <input id="researchApiMinAuthority" class="field" type="number" step="1" placeholder="可选">
                      </div>
                      <div>
                        <label for="researchApiIncludeTypes" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          包含来源
                        </label>
                        <input id="researchApiIncludeTypes" class="field" type="text" placeholder="official,media">
                      </div>
                      <div>
                        <label for="researchApiExcludeTypes" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          排除来源
                        </label>
                        <input id="researchApiExcludeTypes" class="field" type="text" placeholder="community,blog">
                      </div>
                      <div class="flex items-end">
                        <button id="researchApiBtn" type="submit" class="action-btn w-full lg:w-auto">测试 /research</button>
                      </div>
                    </form>
                    <p id="researchApiStatus" class="hidden rounded-md px-3 py-2 text-sm"></p>
                    <pre id="researchApiOutput" class="json-output mt-4 text-xs">等待请求...</pre>
                  </section>

                  <section class="api-test-panel mt-4" data-api-test-panel="content" role="tabpanel" hidden>
                    <form id="contentApiForm" class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_auto]">
                      <div>
                        <label for="contentApiUrl" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          页面 URL
                        </label>
                        <input id="contentApiUrl" class="field" type="url" value="https://example.com/" required>
                      </div>
                      <div>
                        <label for="contentApiMaxBytes" class="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          最大字节
                        </label>
                        <input id="contentApiMaxBytes" class="field" type="number" min="50000" max="5000000" value="1500000">
                      </div>
                      <div class="flex items-end">
                        <button id="contentApiBtn" type="submit" class="action-btn w-full lg:w-auto">测试 /content</button>
                      </div>
                    </form>
                    <p id="contentApiStatus" class="hidden rounded-md px-3 py-2 text-sm"></p>
                    <pre id="contentApiOutput" class="json-output mt-4 text-xs">等待请求...</pre>
                  </section>
                </div>

                <!-- 搜索结果区域 -->
                <div id="resultsSection" class="order-3 mt-5 hidden">
                  <div class="panel p-5">
                    <div class="flex items-center justify-between mb-4">
                      <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        搜索结果 <span id="resultCount" class="text-sm font-normal text-zinc-500"></span>
                      </h2>
                      <button id="clearBtn" class="text-sm font-semibold text-[var(--accent-strong)] hover:underline">
                        清除结果
                      </button>
                    </div>
                    <div id="results" class="space-y-4"></div>
                  </div>
                </div>

                <div class="order-4 mt-5">
                  <div class="flex gap-2 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-1" role="tablist" aria-label="Cloudflare Search details">
                    <button type="button" class="tab-button is-active" data-tab-target="api" role="tab" aria-selected="true">API</button>
                    <button type="button" class="tab-button" data-tab-target="engines" role="tab" aria-selected="false">引擎</button>
                    <button type="button" class="tab-button" data-tab-target="deploy" role="tab" aria-selected="false">部署</button>
                    <button type="button" class="tab-button" data-tab-target="mcp" role="tab" aria-selected="false">MCP</button>
                  </div>

                  <!-- API 使用说明 -->
                  <section class="tab-panel panel mt-3 p-5" data-tab-panel="api" role="tabpanel">
                  <h2 class="mb-4 text-lg font-bold text-[var(--ink)]">
                    如何使用 API
                  </h2>
                  <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    除了网页界面,您还可以通过 HTTP 请求直接调用搜索 API。支持 GET 和 POST 两种方式。
                  </p>
                  <div class="grid gap-4 text-sm lg:grid-cols-2">
                    <div class="muted-panel p-4">
                      <div class="flex items-center justify-between mb-2">
                        <div class="font-medium text-zinc-900 dark:text-zinc-100">GET 请求示例</div>
                        <span class="text-xs text-zinc-500 dark:text-zinc-400">适合快速测试</span>
                      </div>
                      <code class="block break-all text-xs text-[var(--accent-strong)]" id="apiExample1"></code>
                    </div>
                    <div class="muted-panel p-4">
                      <div class="flex items-center justify-between mb-2">
                        <div class="font-medium text-zinc-900 dark:text-zinc-100">POST 请求示例</div>
                        <span class="text-xs text-zinc-500 dark:text-zinc-400">适合程序调用</span>
                      </div>
                      <code class="block whitespace-pre-wrap break-all text-xs text-[var(--accent-strong)]" id="apiExample2"></code>
                    </div>
                    ${
                      TOKEN_ENABLED
                        ? `
                    <div class="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                      <div class="font-medium text-amber-900 dark:text-amber-100 mb-2">🔒 鉴权已启用</div>
                      <p class="text-xs text-amber-700 dark:text-amber-400">
                        当前服务已启用访问鉴权,请在请求时添加 token 参数或 Authorization 头。<br/>
                        示例: <code class="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">?token=YOUR_TOKEN</code> 或 <code class="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">Authorization: Bearer YOUR_TOKEN</code>
                      </p>
                    </div>
                    `
                        : ""
                    }
                  </div>
                  <div class="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700/40">
                    <div class="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                      <p><strong>参数说明:</strong></p>
                      <ul class="list-disc list-inside space-y-0.5 ml-2">
                        <li><code class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-900 dark:text-zinc-100">q</code> / <code class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-900 dark:text-zinc-100">query</code> - 搜索关键词 (必填)</li>
                        <li><code class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-900 dark:text-zinc-100">engines</code> - 指定搜索引擎,多个用逗号分隔 (可选)</li>
                        <li><code class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-900 dark:text-zinc-100">language</code> - 语言/区域，如 <code>en</code>、<code>zh-CN</code> (可选)</li>
                        <li><code class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-900 dark:text-zinc-100">location</code> - 位置增强，默认 <code>off</code>；传 <code>auto</code> 可使用 Cloudflare 城市/地区 (可选)</li>
                        <li><code class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-900 dark:text-zinc-100">time_range</code> - <code>day</code>、<code>week</code>、<code>month</code>、<code>year</code> (可选)</li>
                        <li><code class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-900 dark:text-zinc-100">pageno</code> - 从 0 开始的页码 (可选)</li>
                        ${
                          TOKEN_ENABLED
                            ? '<li><code class="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-900 dark:text-zinc-100">token</code> - 访问令牌 (必填)</li>'
                            : ""
                        }
                      </ul>
                    </div>
                  </div>
                  <div class="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700/40">
                    <div class="text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
                      <p><strong>返回结果说明:</strong></p>
                      <div class="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
                        <pre class="text-xs overflow-x-auto"><code>{
  "query": "cloudflare",              // 搜索关键词
  "effective_query": "cloudflare 上海", // 实际发给上游的搜索词
  "location": "上海",                 // 生效的位置
  "location_source": "auto",         // auto / explicit / disabled / unavailable
  "number_of_results": 15,            // 结果总数
  "enabled_engines": ["startpage", ...], // 启用的搜索引擎列表
  "unresponsive_engines": [],         // 无响应的搜索引擎列表
  "results": [
    {
      "title": "...",                 // 结果标题
      "description": "...",           // 结果描述
      "url": "...",                   // 结果链接
      "engine": "startpage"           // 来源引擎
    }
  ]
}</code></pre>
                      </div>
                    </div>
                  </div>
                  </section>

                <!-- 支持的搜索引擎 -->
                  <section class="tab-panel panel mt-3 p-5" data-tab-panel="engines" role="tabpanel" hidden>
                  <h2 class="mb-4 text-lg font-bold text-[var(--ink)]">
                    支持的搜索引擎
                  </h2>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="muted-panel p-4">
                      <div class="flex items-center justify-between mb-2">
                        <div class="font-medium text-zinc-900 dark:text-zinc-100">Bing</div>
                        <span class="text-xs text-green-600 dark:text-green-400">兜底</span>
                      </div>
                      <p class="text-xs text-zinc-600 dark:text-zinc-400">作为最后一层补充来源，避免单一引擎结果质量波动</p>
                    </div>
                    <div class="muted-panel p-4">
                      <div class="flex items-center justify-between mb-2">
                        <div class="font-medium text-zinc-900 dark:text-zinc-100">Startpage</div>
                        <span class="text-xs text-green-600 dark:text-green-400">默认优先</span>
                      </div>
                      <p class="text-xs text-zinc-600 dark:text-zinc-400">当前默认首选来源，结果质量更稳定，适合作为主入口</p>
                    </div>
                    <div class="muted-panel p-4">
                      <div class="flex items-center justify-between mb-2">
                        <div class="font-medium text-zinc-900 dark:text-zinc-100">Mojeek</div>
                        <span class="text-xs text-green-600 dark:text-green-400">补充来源</span>
                      </div>
                      <p class="text-xs text-zinc-600 dark:text-zinc-400">页面结构简单，作为独立索引补充来源</p>
                    </div>
                    <div class="muted-panel p-4">
                      <div class="flex items-center justify-between mb-2">
                        <div class="font-medium text-zinc-900 dark:text-zinc-100">DuckDuckGo</div>
                        <span class="text-xs text-green-600 dark:text-green-400">高优先级</span>
                      </div>
                      <p class="text-xs text-zinc-600 dark:text-zinc-400">注重隐私保护的搜索引擎,无需配置</p>
                    </div>
                    <div class="muted-panel p-4">
                      <div class="flex items-center justify-between mb-2">
                        <div class="font-medium text-zinc-900 dark:text-zinc-100">Brave Search</div>
                        <span class="text-xs text-green-600 dark:text-green-400">高优先级</span>
                      </div>
                      <p class="text-xs text-zinc-600 dark:text-zinc-400">独立的搜索引擎，直接解析 HTML，已移除 eval</p>
                    </div>
                  </div>
                  </section>

                <!-- 快速开始指南 -->
                  <section class="tab-panel panel mt-3 p-5" data-tab-panel="deploy" role="tabpanel" hidden>
                  <h2 class="mb-4 text-lg font-bold text-[var(--ink)]">
                    快速开始
                  </h2>
                  <div class="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                    <div class="flex items-start">
                      <span class="flex-shrink-0 w-6 h-6 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded-full flex items-center justify-center text-xs font-semibold mr-3">1</span>
                      <div class="flex-1">
                        <p class="font-medium mb-1">部署服务</p>
                        <p class="text-xs text-blue-700 dark:text-blue-300">已部署完成 ✓ 您现在看到的就是部署后的服务</p>
                      </div>
                    </div>
                    <div class="flex items-start">
                      <span class="flex-shrink-0 w-6 h-6 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded-full flex items-center justify-center text-xs font-semibold mr-3">2</span>
                      <div class="flex-1">
                        <p class="font-medium mb-1">配置环境变量 (可选)</p>
                        <p class="text-xs text-blue-700 dark:text-blue-300">
                          在 Cloudflare Dashboard → Workers & Pages → 您的 Worker → 设置 → 变量 中添加:
                        </p>
                        <ul class="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-4 list-disc">
                          ${
                            !TOKEN_ENABLED
                              ? '<li><code class="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">TOKEN</code> - 启用访问鉴权 (建议)</li>'
                              : ""
                          }
                        </ul>
                      </div>
                    </div>
                    <div class="flex items-start">
                      <span class="flex-shrink-0 w-6 h-6 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 rounded-full flex items-center justify-center text-xs font-semibold mr-3">3</span>
                      <div class="flex-1">
                        <p class="font-medium mb-1">开始使用</p>
                        <p class="text-xs text-blue-700 dark:text-blue-300">直接在上方搜索框输入关键词开始搜索,或通过 API 集成到您的应用</p>
                      </div>
                    </div>
                  </div>
                  <div class="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800/40">
                    <p class="text-xs text-blue-700 dark:text-blue-300">
                      📚 更多配置说明请查看 <a href="https://github.com/Yrobot/cloudflare-search#readme" target="_blank" class="underline hover:text-blue-900 dark:hover:text-blue-100">GitHub README</a>
                    </p>
                  </div>
                  </section>

                <!-- MCP 集成 -->
                  <section class="tab-panel panel mt-3 p-5" data-tab-panel="mcp" role="tabpanel" hidden>
                  <h2 class="mb-4 text-lg font-bold text-[var(--ink)]">
                    MCP 集成
                  </h2>
                  <p class="text-sm text-purple-800 dark:text-purple-200 mb-4">
                    通过 MCP (Model Context Protocol) 让 AI 助手 (如 Claude) 直接调用你的搜索服务,获取实时搜索结果。
                  </p>

                  <div class="space-y-4">
                    <!-- 步骤 1 -->
                    <div class="muted-panel p-4">
                      <div class="flex items-start">
                        <span class="flex-shrink-0 w-6 h-6 bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 rounded-full flex items-center justify-center text-xs font-semibold mr-3">1</span>
                        <div class="flex-1">
                          <p class="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">添加 MCP 服务器配置</p>
                          <p class="text-xs text-purple-700 dark:text-purple-300 mb-3">
                            编辑配置文件 (<a href="https://modelcontextprotocol.io/quickstart/user" target="_blank" class="underline hover:text-purple-900 dark:hover:text-purple-100">配置指南</a>):
                          </p>
                          <div class="space-y-1 text-xs text-purple-700 dark:text-purple-300 mb-3">
                            <p><strong>Claude Code:</strong> <code class="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded">~/.claude/config.json</code> 或 <code class="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded">~/.claude.json</code></p>
                            <p><strong>Claude Desktop (macOS):</strong> <code class="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code></p>
                            <p><strong>Claude Desktop (Windows):</strong> <code class="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded">%APPDATA%\\Claude\\claude_desktop_config.json</code></p>
                          </div>
                          <div class="code-block">
                            <pre class="text-xs"><code id="mcp-config-json"></code></pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 步骤 2 -->
                    <div class="muted-panel p-4">
                      <div class="flex items-start">
                        <span class="flex-shrink-0 w-6 h-6 bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 rounded-full flex items-center justify-center text-xs font-semibold mr-3">2</span>
                        <div class="flex-1">
                          <p class="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">重启应用</p>
                          <p class="text-xs text-purple-700 dark:text-purple-300">
                            保存配置后重启 Claude Code 或 Claude Desktop。
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- 步骤 3 -->
                    <div class="muted-panel p-4">
                      <div class="flex items-start">
                        <span class="flex-shrink-0 w-6 h-6 bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 rounded-full flex items-center justify-center text-xs font-semibold mr-3">3</span>
                        <div class="flex-1">
                          <p class="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">验证安装</p>
                          <div class="text-xs text-purple-700 dark:text-purple-300 space-y-1">
                            <p>• 在 Claude Code 中运行 <code class="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded">/mcp</code> 命令,应该能看到 <code class="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded">cloudflare-search</code> 工具</p>
                            <p>• 或 使用 <code class="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded">claude mcp list</code>, 看到 <code class="px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded">cloudflare-search: ... - ✓ Connected</code> 说明配置成功</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 使用示例 -->
                    <div class="muted-panel p-4">
                      <p class="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">💬 使用示例</p>
                      <div class="space-y-2 text-xs text-purple-700 dark:text-purple-300">
                        <div class="rounded bg-purple-100 dark:bg-purple-900/30 p-2">
                          <code>用 cloudflare-search 搜索 "Cloudflare Workers 最佳实践"</code>
                        </div>
                        <div class="rounded bg-purple-100 dark:bg-purple-900/30 p-2">
                          <code>用 cloudflare-search 搜索 "Next.js 14 新特性"</code>
                        </div>
                        <p class="pt-2">AI 会返回来自多个搜索引擎的聚合结果,包括标题、描述和链接。</p>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800/40">
                    <p class="text-xs text-purple-700 dark:text-purple-300">
                      📦 NPM 包: <a href="https://www.npmjs.com/package/@yrobot/cf-search-mcp" target="_blank" class="underline hover:text-purple-900 dark:hover:text-purple-100">@yrobot/cf-search-mcp</a> |
                      📚 MCP 文档: <a href="https://modelcontextprotocol.io" target="_blank" class="underline hover:text-purple-900 dark:hover:text-purple-100">modelcontextprotocol.io</a>
                    </p>
                  </div>
                  </section>
                </div>

                <!-- 功能特性 -->
                <div class="order-7 mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div class="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <svg class="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    多引擎聚合
                  </div>
                  <div class="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <svg class="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    容错机制
                  </div>
                  <div class="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <svg class="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    SearXNG 兼容
                  </div>
                  <div class="flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                    <svg class="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    全球加速
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- 页脚 -->
      <footer class="mt-32">
        <div class="sm:px-8">
          <div class="mx-auto w-full max-w-7xl lg:px-8">
            <div class="border-t border-zinc-100 pt-10 pb-16 dark:border-zinc-700/40">
              <div class="relative px-4 sm:px-8 lg:px-12">
                <div class="mx-auto max-w-2xl lg:max-w-5xl">
                  <div class="flex flex-col items-center justify-between gap-6 sm:flex-row">
                    <p class="text-sm text-zinc-400 dark:text-zinc-500">
                      Powered by Cloudflare Workers
                    </p>
                    <a
                      href="https://github.com/Yrobot/cloudflare-search"
                      target="_blank"
                      class="group flex items-center text-sm font-medium text-zinc-800 transition hover:text-blue-500 dark:text-zinc-200 dark:hover:text-blue-400"
                    >
                      <svg class="w-5 h-5 mr-2 fill-zinc-500 transition group-hover:fill-blue-500 dark:fill-zinc-400 dark:group-hover:fill-blue-400" viewBox="0 0 24 24">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.475 2 2 6.588 2 12.253c0 4.537 2.862 8.369 6.838 9.727.5.09.687-.218.687-.487 0-.243-.013-1.05-.013-1.91C7 20.059 6.35 18.957 6.15 18.38c-.113-.295-.6-1.205-1.025-1.448-.35-.192-.85-.667-.013-.68.788-.012 1.35.744 1.538 1.051.9 1.551 2.338 1.116 2.912.846.088-.666.35-1.115.638-1.371-2.225-.256-4.55-1.14-4.55-5.062 0-1.115.387-2.038 1.025-2.756-.1-.256-.45-1.307.1-2.717 0 0 .837-.269 2.75 1.051.8-.23 1.65-.346 2.5-.346.85 0 1.7.115 2.5.346 1.912-1.333 2.75-1.05 2.75-1.05.55 1.409.2 2.46.1 2.716.637.718 1.025 1.628 1.025 2.756 0 3.934-2.337 4.806-4.562 5.062.362.32.675.936.675 1.897 0 1.371-.013 2.473-.013 2.82 0 .268.188.589.688.486a10.039 10.039 0 0 0 4.932-3.74A10.447 10.447 0 0 0 22 12.253C22 6.588 17.525 2 12 2Z"/>
                      </svg>
                      在 GitHub 上给我们点赞
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>

  <script>
    const currentOrigin = window.location.origin;
    const TOKEN_ENABLED = ${TOKEN_ENABLED};
    const tokenStorageKey = 'cloudflare-search-token';
    const tabButtons = Array.from(document.querySelectorAll('[data-tab-target]'));
    const tabPanels = Array.from(document.querySelectorAll('[data-tab-panel]'));
    const apiTestButtons = Array.from(document.querySelectorAll('[data-api-test-target]'));
    const apiTestPanels = Array.from(document.querySelectorAll('[data-api-test-panel]'));
    const urlParams = new URLSearchParams(window.location.search);
    const tokenInput = document.getElementById('tokenInput');
    const locationInput = document.getElementById('locationInput');
    const verifyTokenBtn = document.getElementById('verifyTokenBtn');
    const tokenStatusBadge = document.getElementById('tokenStatusBadge');
    const tokenStatusText = document.getElementById('tokenStatusText');
    const searchStatus = document.getElementById('searchStatus');
    const geoStatusBadge = document.getElementById('geoStatusBadge');
    const geoSummary = document.getElementById('geoSummary');
    const geoDetails = document.getElementById('geoDetails');
    const initialToken = urlParams.get('token') || (TOKEN_ENABLED ? localStorage.getItem(tokenStorageKey) || '' : '');

    if (tokenInput) {
      tokenInput.value = initialToken;
    }

    if (locationInput) {
      locationInput.value = urlParams.get('location') || 'off';
    }

    function activateTab(tabName) {
      tabButtons.forEach((button) => {
        const active = button.dataset.tabTarget === tabName;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      tabPanels.forEach((panel) => {
        panel.hidden = panel.dataset.tabPanel !== tabName;
      });
    }

    tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activateTab(button.dataset.tabTarget);
      });
    });

    function activateApiTest(tabName) {
      apiTestButtons.forEach((button) => {
        const active = button.dataset.apiTestTarget === tabName;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      apiTestPanels.forEach((panel) => {
        panel.hidden = panel.dataset.apiTestPanel !== tabName;
      });
    }

    apiTestButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activateApiTest(button.dataset.apiTestTarget);
      });
    });

    function getCurrentToken() {
      return tokenInput ? tokenInput.value.trim() : '';
    }

    function getAuthHeaders() {
      const token = getCurrentToken();
      return token ? { Authorization: \`Bearer \${token}\` } : {};
    }

    function setMessage(element, kind, text, size = 'text-sm') {
      if (!element) {
        return;
      }

      if (!text) {
        element.className = 'hidden';
        element.textContent = '';
        return;
      }

      const styles = {
        info: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        loading: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
        success: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
        error: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
      };

      element.className = \`mt-3 rounded-md px-3 py-2 \${size} \${styles[kind] || styles.info}\`;
      element.textContent = text;
    }

    function setTokenBadge(kind, text) {
      if (!tokenStatusBadge) {
        return;
      }

      const styles = {
        idle: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        loading: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };

      tokenStatusBadge.className = \`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium \${styles[kind] || styles.idle}\`;
      tokenStatusBadge.textContent = text;
    }

    function setGeoBadge(kind, text) {
      if (!geoStatusBadge) {
        return;
      }

      const styles = {
        loading: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      };

      geoStatusBadge.className = \`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium \${styles[kind] || styles.loading}\`;
      geoStatusBadge.textContent = text;
    }

    function formatGeoValue(value) {
      return value === undefined || value === null || value === '' ? '未知' : String(value);
    }

    function clearChildren(element) {
      if (!element) {
        return;
      }

      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }

    function createElement(tagName, className, text) {
      const element = document.createElement(tagName);

      if (className) {
        element.className = className;
      }

      if (text !== undefined) {
        element.textContent = text;
      }

      return element;
    }

    function normalizeExternalUrl(value) {
      try {
        const url = new URL(String(value || ''), window.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
      } catch (_) {
        return '';
      }
    }

    function renderGeoDetails(geo) {
      if (!geoDetails) {
        return;
      }

      const items = [
        ['IP', geo.ip],
        ['城市', geo.city],
        ['地区', geo.region],
        ['地区代码', geo.region_code],
        ['国家/地区', geo.country],
        ['大洲', geo.continent],
        ['时区', geo.timezone],
        ['经纬度', geo.latitude && geo.longitude ? \`\${geo.latitude}, \${geo.longitude}\` : ''],
        ['Cloudflare 机房', geo.colo],
        ['ASN', geo.asn],
        ['网络组织', geo.as_organization],
      ];

      clearChildren(geoDetails);
      items.forEach(([label, value]) => {
        const item = createElement('div', 'rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50');
        const term = createElement('dt', 'text-zinc-500 dark:text-zinc-400', label);
        const description = createElement(
          'dd',
          'mt-1 break-all font-medium text-zinc-800 dark:text-zinc-100',
          formatGeoValue(value)
        );

        item.append(term, description);
        geoDetails.appendChild(item);
      });
    }

    async function loadGeoInfo() {
      if (!geoSummary || !geoDetails) {
        return;
      }

      setGeoBadge('loading', '加载中');

      try {
        const response = await fetch(\`\${currentOrigin}/geo\`, {
          headers: getAuthHeaders(),
        });
        const data = await parseJsonResponse(response);
        const geo = data.geo || {};
        const primaryLocation = [geo.city, geo.region, geo.country]
          .filter(Boolean)
          .join(' / ');

        geoSummary.textContent = primaryLocation
          ? \`Cloudflare 当前识别为：\${primaryLocation}\`
          : 'Cloudflare 没有返回明确的城市/地区信息。';
        renderGeoDetails(geo);
        setGeoBadge('success', '已读取');
      } catch (error) {
        geoSummary.textContent = \`读取失败：\${error.message}\`;
        clearChildren(geoDetails);
        setGeoBadge('error', '读取失败');
      }
    }

    function updateExamples() {
      const token = getCurrentToken();
      const exampleToken = token || 'YOUR_TOKEN';
      const location = locationInput ? locationInput.value.trim() : '';
      const locationSuffix = location ? '&location=' + encodeURIComponent(location) : '';
      const postLocation = location ? '&location=' + location : '';
      const getExample = TOKEN_ENABLED
        ? \`curl -H "Authorization: Bearer \${exampleToken}" "\${currentOrigin}/search?q=cloudflare\${locationSuffix}"\`
        : currentOrigin + \`/search?q=cloudflare\${locationSuffix}\`;
      const postExample = TOKEN_ENABLED
        ? \`curl -X POST "\${currentOrigin}/search" \\\\\n  -H "Authorization: Bearer \${exampleToken}" \\\\\n  -d "q=cloudflare&engines=startpage,duckduckgo\${postLocation}"\`
        : \`curl -X POST "\${currentOrigin}/search" -d "q=cloudflare&engines=startpage,duckduckgo\${postLocation}"\`;
      const mcpEnv = [
        \`        "CF_SEARCH_URL": "\${currentOrigin}"\`,
        ...(TOKEN_ENABLED ? [\`        "CF_SEARCH_TOKEN": "\${exampleToken}"\`] : []),
      ].join(',\\n');

      document.getElementById('apiExample1').textContent = getExample;
      document.getElementById('apiExample2').textContent = postExample;
      document.getElementById('mcp-config-json').textContent = \`{
  "mcpServers": {
    "cloudflare-search": {
      "command": "npx",
      "args": ["-y", "@yrobot/cf-search-mcp"],
      "env": {
\${mcpEnv}
      }
    }
  }
}\`;
    }

    async function parseJsonResponse(response) {
      let data = null;

      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }

      if (!response.ok) {
        const error = new Error(data?.message || '请求失败 (' + response.status + ')');
        error.status = response.status;
        error.code = data?.code || '';
        error.details = data?.details || null;
        throw error;
      }

      return data;
    }

    function buildApiUrl(path, params) {
      const url = new URL(path, currentOrigin);

      Object.entries(params).forEach(([key, value]) => {
        const normalizedValue = value === undefined || value === null ? '' : String(value).trim();
        if (normalizedValue) {
          url.searchParams.set(key, normalizedValue);
        }
      });

      return url.toString();
    }

    async function requestApiJson(path, params) {
      const response = await fetch(buildApiUrl(path, params), {
        headers: getAuthHeaders(),
      });

      return parseJsonResponse(response);
    }

    function setButtonBusy(button, busy, label, busyLabel) {
      if (!button) {
        return;
      }

      button.disabled = busy;
      button.textContent = busy ? busyLabel : label;
    }

    function renderJsonOutput(element, payload) {
      if (!element) {
        return;
      }

      element.textContent = JSON.stringify(payload, null, 2);
    }

    function setupApiTestForm({
      formId,
      buttonId,
      statusId,
      outputId,
      buttonLabel,
      busyLabel,
      path,
      getParams,
      successMessage,
    }) {
      const form = document.getElementById(formId);
      const button = document.getElementById(buttonId);
      const status = document.getElementById(statusId);
      const output = document.getElementById(outputId);

      if (!form) {
        return;
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setButtonBusy(button, true, buttonLabel, busyLabel);
        setMessage(status, 'loading', '正在请求接口...');

        try {
          const payload = await requestApiJson(path, getParams());
          renderJsonOutput(output, payload);
          setMessage(status, 'success', successMessage(payload));
        } catch (error) {
          renderJsonOutput(output, {
            code: error.code || 'REQUEST_FAILED',
            message: error.message,
            details: error.details || null,
          });
          setMessage(status, 'error', error.message);
        } finally {
          setButtonBusy(button, false, buttonLabel, busyLabel);
        }
      });
    }

    function isAuthError(error) {
      return (
        error?.status === 401 ||
        error?.status === 403 ||
        error?.code === 'UNAUTHORIZED' ||
        error?.code === 'FORBIDDEN'
      );
    }

    function getApiSourceFilterParams(prefix) {
      return {
        min_authority_score: document.getElementById(prefix + 'MinAuthority')?.value,
        include_source_types: document.getElementById(prefix + 'IncludeTypes')?.value,
        exclude_source_types: document.getElementById(prefix + 'ExcludeTypes')?.value,
      };
    }

    setupApiTestForm({
      formId: 'searchApiForm',
      buttonId: 'searchApiBtn',
      statusId: 'searchApiStatus',
      outputId: 'searchApiOutput',
      buttonLabel: '测试 /search',
      busyLabel: '请求中...',
      path: '/search',
      getParams: () => ({
        q: document.getElementById('searchApiQuery').value,
        location: locationInput ? locationInput.value : 'off',
        ...getApiSourceFilterParams('searchApi'),
      }),
      successMessage: (payload) => \`/search 完成，共 \${payload.number_of_results || 0} 条结果。\`,
    });

    setupApiTestForm({
      formId: 'researchApiForm',
      buttonId: 'researchApiBtn',
      statusId: 'researchApiStatus',
      outputId: 'researchApiOutput',
      buttonLabel: '测试 /research',
      busyLabel: '读取中...',
      path: '/research',
      getParams: () => ({
        q: document.getElementById('researchApiQuery').value,
        limit: document.getElementById('researchApiLimit').value,
        excerpt_chars: document.getElementById('researchApiExcerpt').value,
        location: locationInput ? locationInput.value : 'off',
        ...getApiSourceFilterParams('researchApi'),
      }),
      successMessage: (payload) =>
        \`/research 完成，读取 \${payload.read_count || 0} 个来源，失败 \${payload.failed_count || 0} 个，跳过 \${payload.skipped_count || 0} 个。\`,
    });

    setupApiTestForm({
      formId: 'contentApiForm',
      buttonId: 'contentApiBtn',
      statusId: 'contentApiStatus',
      outputId: 'contentApiOutput',
      buttonLabel: '测试 /content',
      busyLabel: '抽取中...',
      path: '/content',
      getParams: () => ({
        url: document.getElementById('contentApiUrl').value,
        max_bytes: document.getElementById('contentApiMaxBytes').value,
      }),
      successMessage: (payload) =>
        \`/content 完成，正文长度 \${payload.stats?.text_length || 0} 字符。\`,
    });

    updateExamples();
    loadGeoInfo();

    if (locationInput) {
      locationInput.addEventListener('input', updateExamples);
    }

    if (TOKEN_ENABLED && tokenInput) {
      setTokenBadge('idle', '未验证');
      setMessage(
        tokenStatusText,
        initialToken ? 'info' : 'error',
        initialToken ? '已填入 token，点击“验证 Token”测试是否有效。' : '当前服务已开启鉴权，请先输入 token。',
        'text-xs'
      );

      tokenInput.addEventListener('input', () => {
        setTokenBadge('idle', '未验证');
        setMessage(
          tokenStatusText,
          getCurrentToken() ? 'info' : 'error',
          getCurrentToken() ? 'Token 已修改，请重新验证。' : '当前服务已开启鉴权，请先输入 token。',
          'text-xs'
        );
        updateExamples();
      });
    }

    if (verifyTokenBtn) {
      verifyTokenBtn.addEventListener('click', async () => {
        setTokenBadge('loading', '验证中');
        setMessage(tokenStatusText, 'loading', '正在验证 token...', 'text-xs');
        verifyTokenBtn.disabled = true;

        try {
          const response = await fetch(\`\${currentOrigin}/auth/verify\`, {
            headers: getAuthHeaders(),
          });
          const data = await parseJsonResponse(response);

          localStorage.setItem(tokenStorageKey, getCurrentToken());
          setTokenBadge('success', '已通过');
          setMessage(
            tokenStatusText,
            'success',
            data.token_required
              ? 'Token 有效，首页搜索会自动带上 Authorization 头。'
              : '当前服务未开启鉴权，token 不是必需的。',
            'text-xs'
          );
        } catch (error) {
          setTokenBadge(isAuthError(error) ? 'error' : 'idle', isAuthError(error) ? '未通过' : '待重试');
          setMessage(tokenStatusText, 'error', error.message, 'text-xs');
        } finally {
          verifyTokenBtn.disabled = false;
          updateExamples();
        }
      });
    }

    document.getElementById('searchForm').addEventListener('submit', async function(event) {
      event.preventDefault();

      const query = document.getElementById('searchQuery').value.trim();
      if (!query) return;

      // 获取选中的搜索引擎 (非必填)
      const engines = Array.from(document.querySelectorAll('input[name="engine"]:checked:not(:disabled)'))
        .map(cb => cb.value)
        .join(',');
      const location = locationInput ? locationInput.value.trim() : '';

      // 显示加载状态
      const searchBtn = document.getElementById('searchBtn');
      const originalText = searchBtn.textContent;
      setMessage(searchStatus, 'loading', '正在请求搜索服务...');
      searchBtn.textContent = '搜索中...';
      searchBtn.disabled = true;

      try {
        let url = \`\${currentOrigin}/search?q=\${encodeURIComponent(query)}\`;
        if (engines) url += \`&engines=\${engines}\`;
        if (location) url += \`&location=\${encodeURIComponent(location)}\`;

        const response = await fetch(url, {
          headers: getAuthHeaders(),
        });
        const data = await parseJsonResponse(response);

        if (TOKEN_ENABLED && getCurrentToken()) {
          localStorage.setItem(tokenStorageKey, getCurrentToken());
          setTokenBadge('success', '已通过');
          setMessage(tokenStatusText, 'success', 'Token 校验通过，已用于本次搜索。', 'text-xs');
        }

        displayResults(data);
        setMessage(searchStatus, 'success', \`搜索完成，共返回 \${data.number_of_results} 条结果。\`);
      } catch (error) {
        if (TOKEN_ENABLED && isAuthError(error)) {
          setTokenBadge('error', '未通过');
          setMessage(tokenStatusText, 'error', error.message, 'text-xs');
        }

        setMessage(searchStatus, 'error', error.message);
      } finally {
        searchBtn.textContent = originalText;
        searchBtn.disabled = false;
      }
    });

    // 显示搜索结果
    function displayResults(data) {
      const resultsSection = document.getElementById('resultsSection');
      const resultsContainer = document.getElementById('results');
      const resultCount = document.getElementById('resultCount');

      resultsSection.classList.remove('hidden');
      resultCount.textContent = \`(共 \${data.number_of_results} 条)\`;
      clearChildren(resultsContainer);

      if (data.results && data.results.length > 0) {
        data.results.forEach((result) => {
          const safeUrl = normalizeExternalUrl(result.url);
          const item = createElement(
            'div',
            'rounded-lg bg-zinc-50 p-4 overflow-scroll dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition'
          );
          const row = createElement('div', 'flex items-start justify-between');
          const body = createElement('div', 'flex-1 overflow-hidden');
          const title = createElement(
            'a',
            'text-base font-medium text-blue-600 dark:text-blue-400 hover:underline',
            result.title || '无标题'
          );
          const urlText = createElement(
            'p',
            'text-xs text-zinc-500 dark:text-zinc-500 mt-1',
            safeUrl || String(result.url || '')
          );
          const description = createElement(
            'p',
            'text-sm text-zinc-700 dark:text-zinc-300 mt-2',
            result.description || '暂无描述'
          );
          const engine = createElement(
            'span',
            'ml-4 text-xs text-zinc-500 dark:text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded',
            result.engine || 'unknown'
          );

          if (safeUrl) {
            title.href = safeUrl;
            title.target = '_blank';
            title.rel = 'noopener noreferrer';
          } else {
            title.href = '#';
            title.setAttribute('aria-disabled', 'true');
          }

          body.append(title, urlText, description);
          row.append(body, engine);
          item.appendChild(row);
          resultsContainer.appendChild(item);
        });
      } else {
        resultsContainer.appendChild(
          createElement('p', 'text-center text-zinc-500 dark:text-zinc-400', '没有找到相关结果')
        );
      }

      // 滚动到结果区域
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 清除结果
    document.getElementById('clearBtn').addEventListener('click', function() {
      document.getElementById('resultsSection').classList.add('hidden');
      clearChildren(document.getElementById('results'));
      setMessage(searchStatus, 'info', '');
    });
  </script>
</body>
</html>`;
}
