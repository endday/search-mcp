import { env } from "../envs.js";
import { isAuthRequired } from "./auth.js";

export async function getSearchHtml() {
  const TOKEN_ENABLED = isAuthRequired();
  const DEFAULT_ENGINES = env.DEFAULT_ENGINES || [];
  const handlerEngineDefaultChecked = (engine) =>
    DEFAULT_ENGINES.includes(engine) ? "checked" : "";

  const engines = env.SUPPORTED_ENGINES;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search MCP - 多引擎聚合搜索</title>
  <meta name="description" content="基于 Cloudflare Workers 的多引擎聚合搜索服务，为 AI Agent 提供实时 web 搜索能力">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔍</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'media',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"IBM Plex Sans"', '"Microsoft YaHei UI"', '"PingFang SC"', 'system-ui', 'sans-serif'],
            serif: ['Newsreader', '"Source Han Serif SC"', 'Georgia', 'serif'],
            mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
          },
        }
      }
    }
  </script>
  <style>
    :root {
      --page-bg: #f1eee6;
      --surface: #fbfaf6;
      --surface-muted: #e9e5db;
      --ink: #16140f;
      --ink-muted: #6a655b;
      --line: #d6d1c4;
      --accent: #1a3f8f;
      --accent-strong: #122a63;
      --accent-bg: #e7e9f0;
      --url: #2e6b3e;
      --signal: #a52a2a;
      --mark: #f0e9c8;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --page-bg: #100f0c;
        --surface: #1a1814;
        --surface-muted: #232017;
        --ink: #ece8de;
        --ink-muted: #9c9588;
        --line: #2e2a20;
        --accent: #93b4f5;
        --accent-strong: #b9caf9;
        --accent-bg: #1b2230;
        --url: #7fb98a;
        --signal: #e07070;
        --mark: #3a3417;
      }
    }
    body {
      background: var(--page-bg);
      color: var(--ink);
      font-feature-settings: "ss01", "cv01";
    }
    h1, h2, h3, .font-serif {
      font-family: 'Newsreader', 'Source Han Serif SC', Georgia, serif;
      font-feature-settings: "kern", "liga";
      letter-spacing: -0.01em;
    }
    code, pre, .font-mono, .code-block, .json-output {
      font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .search-input {
      background: var(--surface);
      border: 1px solid var(--line);
      color: var(--ink);
      transition: border-color 160ms, box-shadow 160ms;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
    }
    .btn-primary {
      background: var(--ink);
      color: var(--page-bg);
      font-weight: 600;
      border: 1px solid var(--ink);
      border-radius: 4px;
      transition: background 160ms, color 160ms, border-color 160ms;
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    .chip {
      background: var(--surface-muted);
      border: 1px solid var(--line);
      color: var(--ink-muted);
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 160ms;
      user-select: none;
    }
    .chip:hover {
      border-color: var(--accent);
      color: var(--ink);
    }
    .chip.active {
      background: var(--accent-bg);
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 500;
    }
    .result-item {
      background: var(--surface);
      border: 1px solid var(--line);
      border-left: 3px solid transparent;
      border-radius: 4px;
      padding: 0.9rem 1.05rem;
      transition: border-color 160ms, box-shadow 160ms;
    }
    .result-item:hover {
      border-left-color: var(--signal);
      box-shadow: 0 1px 0 var(--line);
    }
    details > summary {
      cursor: pointer;
      list-style: none;
    }
    details > summary::-webkit-details-marker { display: none; }

    /* Reader modal */
    .reader-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
      opacity: 0;
      pointer-events: none;
      transition: opacity 200ms;
    }
    .reader-modal.active {
      opacity: 1;
      pointer-events: auto;
    }
    .reader-modal-content {
      background: var(--surface);
      border-radius: 12px;
      max-width: 800px;
      width: 90%;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .reader-modal-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .reader-modal-title {
      font-weight: 600;
      font-size: 1rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .reader-modal-close {
      background: var(--surface-muted);
      border: none;
      border-radius: 6px;
      padding: 0.4rem 0.8rem;
      cursor: pointer;
      font-size: 0.85rem;
      color: var(--ink-muted);
      transition: all 160ms;
    }
    .reader-modal-close:hover {
      background: var(--line);
      color: var(--ink);
    }
    .reader-modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
      font-size: 0.9rem;
      line-height: 1.7;
    }
    .reader-modal-body p {
      margin-bottom: 1rem;
    }
    .reader-modal-meta {
      font-size: 0.75rem;
      color: var(--ink-muted);
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--line);
    }
    .read-btn {
      background: var(--accent-bg);
      color: var(--accent);
      border: 1px solid var(--accent);
      border-radius: 6px;
      padding: 0.3rem 0.7rem;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 160ms;
      white-space: nowrap;
    }
    .read-btn:hover {
      background: var(--accent);
      color: white;
    }
    .read-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Route animation */
    .query-cursor {
      display: inline-block;
      width: 7px;
      height: 1.05em;
      background: var(--signal);
      vertical-align: text-bottom;
      animation: cf-blink 1.1s steps(2, start) infinite;
    }
    @keyframes cf-blink { to { opacity: 0; } }
    .route-dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      border-radius: 999px;
      background: var(--line);
      margin-right: 0.2rem;
      transition: background 160ms;
    }
    .route-dot.is-lit { background: var(--signal); }

    /* Centered masthead */
    .masthead-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .search-box-center {
      width: 100%;
      max-width: 640px;
    }

    @media (prefers-reduced-motion: reduce) {
      .query-cursor { animation: none; opacity: 1; }
      * { scroll-behavior: auto !important; }
    }
  </style>
</head>
<body class="min-h-screen flex flex-col">
  <div class="flex-grow mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">

    <!-- Top nav: sticky -->
    <nav class="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b mb-6" style="background: var(--page-bg); border-color: var(--line)">
      <a href="/" class="flex items-baseline gap-2 hover:underline" style="color: var(--ink)">
        <span class="font-serif font-semibold text-lg">Search MCP</span>
      </a>
      <div class="flex gap-4 text-sm font-medium">
        <a href="/" class="hover:underline" style="color: var(--accent)">首页</a>
        <a href="/docs" class="hover:underline" style="color: var(--ink-muted)">文档</a>
      </div>
    </nav>

    <!-- Masthead: centered -->
    <header class="masthead-center mb-10" id="masthead">
      <h1 class="text-4xl sm:text-5xl font-semibold font-serif leading-none" style="color: var(--ink)">Search MCP</h1>
      <p class="mt-3 text-sm sm:text-base" style="color: var(--ink-muted); max-width: 420px;">
        多引擎聚合搜索，为 AI Agent 提供实时 web 搜索与正文抽取能力。
      </p>

      <!-- Signature line -->
      <div class="mt-4 font-mono text-xs sm:text-[13px] rounded-md px-3 py-2.5 flex items-center gap-2 flex-wrap" style="background: var(--surface); border: 1px solid var(--line); color: var(--ink-muted)">
        <span style="color: var(--signal)">$</span>
        <span style="color: var(--ink)">get</span>
        <span>/search?q=</span>
        <span style="color: var(--accent)">realtime web</span>
        <span class="query-cursor" aria-hidden="true"></span>
        <span class="mx-1" style="color: var(--line)">│</span>
        <span class="flex items-center gap-2">
          <span class="flex items-center"><span class="route-dot"></span>startpage</span>
          <span class="flex items-center"><span class="route-dot"></span>duckduckgo</span>
          <span class="flex items-center"><span class="route-dot"></span>brave</span>
          <span class="flex items-center"><span class="route-dot"></span>mojeek</span>
          <span class="flex items-center"><span class="route-dot"></span>bing</span>
        </span>
      </div>
    </header>

    <!-- Search box: centered -->
    <form id="searchForm" class="search-box-center card p-4 sm:p-5 mb-6 mx-auto">
      <div class="flex gap-2">
        <input
          type="text"
          id="searchQuery"
          placeholder="输入搜索关键词..."
          autocomplete="off"
          required
          class="search-input flex-1 rounded-lg px-4 py-3 text-base"
        >
        <button type="submit" id="searchBtn" class="btn-primary rounded-lg px-6 py-3 text-base whitespace-nowrap">
          搜索
        </button>
      </div>

      <!-- Advanced options -->
      <details class="mt-3">
        <summary class="flex items-center gap-1.5 text-sm py-1" style="color: var(--ink-muted)">
          <svg class="w-4 h-4 transition-transform" style="transition: transform 160ms" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          高级选项
        </summary>
        <div class="mt-3 space-y-4 pt-3 border-t" style="border-color: var(--line)">
          <!-- Engines -->
          <div>
            <label class="block text-sm font-medium mb-2" style="color: var(--ink-muted)">搜索引擎</label>
            <div id="engineChips" class="flex flex-wrap gap-2">
              ${engines.map((engine) => `
                <label class="chip${DEFAULT_ENGINES.includes(engine) ? ' active' : ''}" data-engine="${engine}">
                  <input type="checkbox" name="engine" value="${engine}" ${handlerEngineDefaultChecked(engine)} class="hidden">
                  ${engine.charAt(0).toUpperCase() + engine.slice(1)}
                </label>
              `).join("")}
            </div>
          </div>
          <!-- Location -->
          <div>
            <label for="locationInput" class="block text-sm font-medium mb-1.5" style="color: var(--ink-muted)">位置增强</label>
            <input type="text" id="locationInput" value="off" placeholder="auto / 上海 / off" class="search-input rounded-lg px-3 py-2 text-sm w-full sm:w-64">
            <p class="mt-1 text-xs" style="color: var(--ink-muted)">默认 <code>off</code>；传 <code>auto</code> 使用 Cloudflare 访问者城市</p>
          </div>
          ${TOKEN_ENABLED ? `
          <!-- Token -->
          <div>
            <label for="tokenInput" class="block text-sm font-medium mb-1.5" style="color: var(--ink-muted)">访问 Token</label>
            <div class="flex gap-2 items-center">
              <input type="password" id="tokenInput" placeholder="Bearer Token" autocomplete="off" class="search-input rounded-lg px-3 py-2 text-sm flex-1 sm:w-80">
              <button type="button" id="verifyTokenBtn" class="btn-primary rounded-lg px-4 py-2 text-sm">验证</button>
              <span id="tokenStatusBadge" class="text-xs px-2 py-1 rounded-full" style="background: var(--surface-muted); color: var(--ink-muted)">未验证</span>
            </div>
            <p id="tokenStatusText" class="mt-1.5 hidden rounded-md px-3 py-2 text-xs"></p>
          </div>
          ` : ""}
        </div>
      </details>
      <p id="searchStatus" class="hidden rounded-md px-3 py-2 text-sm mt-3"></p>
    </form>

    <!-- Results -->
    <div id="resultsSection" class="mb-12 hidden">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold">
          搜索结果 <span id="resultCount" class="text-sm font-normal" style="color: var(--ink-muted)"></span>
        </h2>
        <button id="clearBtn" class="text-sm font-medium hover:underline" style="color: var(--accent)">清除</button>
      </div>
      <div id="results" class="space-y-3"></div>
    </div>

    <!-- Reader Modal -->
    <div id="readerModal" class="reader-modal">
      <div class="reader-modal-content">
        <div class="reader-modal-header">
          <div class="reader-modal-title" id="readerModalTitle">加载中...</div>
          <button type="button" class="reader-modal-close" id="readerModalClose">关闭</button>
        </div>
        <div class="reader-modal-body" id="readerModalBody">
          <p style="color: var(--ink-muted)">正在读取正文...</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="mx-auto max-w-4xl px-4 pt-6 pb-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style="border-color: var(--line); color: var(--ink-muted)">
    <p>Powered by Cloudflare Workers · <a href="https://github.com/endday/search-mcp" target="_blank" class="hover:underline" style="color: var(--accent)">GitHub</a></p>
    <div class="flex gap-4">
      <a href="/docs" class="font-medium hover:underline" style="color: var(--ink)">文档</a>
      <a href="https://github.com/endday/search-mcp" target="_blank" class="flex items-center gap-1.5 font-medium hover:underline" style="color: var(--ink)">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.475 2 2 6.588 2 12.253c0 4.537 2.862 8.369 6.838 9.727.5.09.687-.218.687-.487 0-.243-.013-1.05-.013-1.91C7 20.059 6.35 18.957 6.15 18.38c-.113-.295-.6-1.205-1.025-1.448-.35-.192-.85-.667-.013-.68.788-.012 1.35.744 1.538 1.051.9 1.551 2.338 1.116 2.912.846.088-.666.35-1.115.638-1.371-2.225-.256-4.55-1.14-4.55-5.062 0-1.115.387-2.038 1.025-2.756-.1-.256-.45-1.307.1-2.717 0 0 .837-.269 2.75 1.051.8-.23 1.65-.346 2.5-.346.85 0 1.7.115 2.5.346 1.912-1.333 2.75-1.05 2.75-1.05.55 1.409.2 2.46.1 2.716.637.718 1.025 1.628 1.025 2.756 0 3.934-2.337 4.806-4.562 5.062.362.32.675.936.675 1.897 0 1.371-.013 2.473-.013 2.82 0 .268.188.589.688.486a10.039 10.039 0 004.932-3.74A10.447 10.447 0 0022 12.253C22 6.588 17.525 2 12 2Z"/></svg>
        GitHub
      </a>
    </div>
  </footer>

  <script>
    const currentOrigin = window.location.origin;
    const TOKEN_ENABLED = ${TOKEN_ENABLED};
    const tokenStorageKey = 'search-mcp-token';
    const urlParams = new URLSearchParams(window.location.search);

    const tokenInput = document.getElementById('tokenInput');
    const locationInput = document.getElementById('locationInput');
    const verifyTokenBtn = document.getElementById('verifyTokenBtn');
    const tokenStatusBadge = document.getElementById('tokenStatusBadge');
    const tokenStatusText = document.getElementById('tokenStatusText');
    const searchStatus = document.getElementById('searchStatus');
    const masthead = document.getElementById('masthead');

    // Init token from storage / URL
    const initialToken = urlParams.get('token') || (TOKEN_ENABLED ? localStorage.getItem(tokenStorageKey) || '' : '');
    if (tokenInput) tokenInput.value = initialToken;
    if (locationInput) locationInput.value = urlParams.get('location') || 'off';

    // Engine chips
    document.querySelectorAll('#engineChips .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const input = chip.querySelector('input');
        input.checked = !input.checked;
        chip.classList.toggle('active', input.checked);
      });
    });

    // Details arrow rotation
    document.querySelectorAll('details').forEach((details) => {
      const arrow = details.querySelector('summary svg');
      if (arrow) {
        details.addEventListener('toggle', () => {
          arrow.style.transform = details.open ? 'rotate(180deg)' : '';
        });
      }
    });

    // Helpers
    function getCurrentToken() {
      return tokenInput ? tokenInput.value.trim() : '';
    }
    function getAuthHeaders() {
      const token = getCurrentToken();
      return token ? { Authorization: \`Bearer \${token}\` } : {};
    }
    function setMessage(element, kind, text) {
      if (!element) return;
      if (!text) { element.className = 'hidden'; element.textContent = ''; return; }
      const styles = {
        info: 'background: var(--surface-muted); color: var(--ink-muted)',
        loading: 'background: var(--accent-bg); color: var(--accent)',
        success: 'background: var(--accent-bg); color: var(--accent)',
        error: 'background: #fef2f2; color: #991b1b',
      };
      element.className = \`rounded-md px-3 py-2 text-sm mt-3\`;
      element.style.cssText = styles[kind] || styles.info;
      element.textContent = text;
    }
    function setTokenBadge(kind, text) {
      if (!tokenStatusBadge) return;
      const styles = {
        idle: 'background: var(--surface-muted); color: var(--ink-muted)',
        loading: 'background: var(--accent-bg); color: var(--accent)',
        success: 'background: var(--accent-bg); color: var(--accent)',
        error: 'background: #fef2f2; color: #991b1b',
      };
      tokenStatusBadge.style.cssText = styles[kind] || styles.idle;
      tokenStatusBadge.textContent = text;
    }
    function clearChildren(el) {
      if (!el) return;
      while (el.firstChild) el.removeChild(el.firstChild);
    }
    function createElement(tag, className, text) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    function normalizeExternalUrl(value) {
      try {
        const url = new URL(String(value || ''), window.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
      } catch (_) { return ''; }
    }
    async function parseJsonResponse(response) {
      let data = null;
      try { data = await response.json(); } catch (_) { data = null; }
      if (!response.ok) {
        const error = new Error(data?.message || '请求失败 (' + response.status + ')');
        error.status = response.status;
        error.code = data?.code || '';
        throw error;
      }
      return data;
    }
    function isAuthError(error) {
      return error?.status === 401 || error?.status === 403 ||
        error?.code === 'UNAUTHORIZED' || error?.code === 'FORBIDDEN';
    }

    // Collapse masthead after search (Google-style)
    function collapseMasthead() {
      masthead.classList.remove('masthead-center');
      masthead.style.display = 'flex';
      masthead.style.flexDirection = 'row';
      masthead.style.alignItems = 'baseline';
      masthead.style.justifyContent = 'space-between';
      masthead.style.gap = '1rem';
      masthead.style.textAlign = 'left';
      masthead.style.marginBottom = '1.5rem';
      masthead.querySelector('h1').style.fontSize = '1.5rem';
      masthead.querySelector('p').style.display = 'none';
      // Also widen search box
      const searchBox = document.getElementById('searchForm');
      searchBox.classList.remove('search-box-center');
      searchBox.style.maxWidth = '100%';
    }
    function expandMasthead() {
      masthead.classList.add('masthead-center');
      masthead.style.display = '';
      masthead.style.flexDirection = '';
      masthead.style.alignItems = '';
      masthead.style.justifyContent = '';
      masthead.style.gap = '';
      masthead.style.textAlign = '';
      masthead.style.marginBottom = '';
      masthead.querySelector('h1').style.fontSize = '';
      masthead.querySelector('p').style.display = '';
      const searchBox = document.getElementById('searchForm');
      searchBox.classList.add('search-box-center');
      searchBox.style.maxWidth = '';
    }

    // Token verify
    if (verifyTokenBtn) {
      setTokenBadge('idle', '未验证');
      setMessage(tokenStatusText, initialToken ? 'info' : 'error',
        initialToken ? '已填入 token，点击"验证"测试是否有效。' : '当前服务已开启鉴权，请先输入 token。');

      tokenInput.addEventListener('input', () => {
        setTokenBadge('idle', '未验证');
        setMessage(tokenStatusText, getCurrentToken() ? 'info' : 'error',
          getCurrentToken() ? 'Token 已修改，请重新验证。' : '当前服务已开启鉴权，请先输入 token。');
      });

      verifyTokenBtn.addEventListener('click', async () => {
        setTokenBadge('loading', '验证中');
        setMessage(tokenStatusText, 'loading', '正在验证...');
        verifyTokenBtn.disabled = true;
        try {
          const response = await fetch(\`\${currentOrigin}/auth/verify\`, { headers: getAuthHeaders() });
          const data = await parseJsonResponse(response);
          localStorage.setItem(tokenStorageKey, getCurrentToken());
          setTokenBadge('success', '已通过');
          setMessage(tokenStatusText, 'success',
            data.token_required ? 'Token 有效，搜索会自动带上 Authorization 头。' : '当前服务未开启鉴权，token 不是必需的。');
        } catch (error) {
          setTokenBadge(isAuthError(error) ? 'error' : 'idle', isAuthError(error) ? '未通过' : '待重试');
          setMessage(tokenStatusText, 'error', error.message);
        } finally {
          verifyTokenBtn.disabled = false;
        }
      });
    }

    // Main search
    const routeDots = document.querySelectorAll('.route-dot');
    function setRouteLit(on) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      routeDots.forEach((dot, i) => {
        if (!on) { dot.classList.remove('is-lit'); return; }
        if (reduce) { dot.classList.add('is-lit'); return; }
        setTimeout(() => dot.classList.add('is-lit'), i * 110);
      });
    }

    document.getElementById('searchForm').addEventListener('submit', async function(event) {
      event.preventDefault();
      const query = document.getElementById('searchQuery').value.trim();
      if (!query) return;
      const engines = Array.from(document.querySelectorAll('input[name="engine"]:checked')).map((cb) => cb.value).join(',');
      if (!engines) {
        setMessage(searchStatus, 'error', '请至少选择一个搜索引擎（engines 为必填项）');
        return;
      }
      const location = locationInput ? locationInput.value.trim() : '';

      const searchBtn = document.getElementById('searchBtn');
      const originalText = searchBtn.textContent;
      setMessage(searchStatus, 'loading', '搜索中...');
      searchBtn.textContent = '搜索中...';
      searchBtn.disabled = true;
      setRouteLit(true);

      try {
        let url = \`\${currentOrigin}/search?q=\${encodeURIComponent(query)}\`;
        if (engines) url += \`&engines=\${engines}\`;
        if (location && location !== 'off') url += \`&location=\${encodeURIComponent(location)}\`;

        const response = await fetch(url, {
          credentials: 'same-origin',
          headers: getAuthHeaders(),
        });
        const data = await parseJsonResponse(response);

        if (TOKEN_ENABLED && getCurrentToken()) {
          localStorage.setItem(tokenStorageKey, getCurrentToken());
          setTokenBadge('success', '已通过');
        }

        collapseMasthead();
        displayResults(data);
        setMessage(searchStatus, 'success', \`搜索完成，共 \${data.number_of_results} 条结果\`);
      } catch (error) {
        if (TOKEN_ENABLED && isAuthError(error)) {
          setTokenBadge('error', '未通过');
          setMessage(tokenStatusText, 'error', error.message);
        }
        setMessage(searchStatus, 'error', error.message);
      } finally {
        searchBtn.textContent = originalText;
        searchBtn.disabled = false;
        setRouteLit(false);
      }
    });

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
          const item = createElement('div', 'result-item');

          const header = createElement('div', 'flex items-start justify-between gap-3');
          const body = createElement('div', 'flex-1 min-w-0');
          const title = createElement('a', 'font-medium hover:underline block truncate', result.title || '无标题');
          title.style.color = 'var(--accent)';
          const urlText = createElement('p', 'text-xs truncate mt-0.5 font-mono', safeUrl || String(result.url || ''));
          urlText.style.color = 'var(--url)';
          const description = createElement('p', 'text-sm mt-2 leading-relaxed', result.description || '暂无描述');

          const actions = createElement('div', 'flex-shrink-0 flex flex-col gap-2 items-end');
          const engine = createElement('span', 'text-xs px-2 py-0.5 rounded-full font-mono', result.engine || 'unknown');
          engine.style.cssText = 'background: transparent; color: var(--ink-muted); border: 1px solid var(--line)';

          if (safeUrl) {
            title.href = safeUrl;
            title.target = '_blank';
            title.rel = 'noopener noreferrer';

            const readBtn = createElement('button', 'read-btn', '阅读正文');
            readBtn.addEventListener('click', () => openReaderModal(safeUrl, result.title));
            actions.append(engine, readBtn);
          } else {
            title.href = '#';
            actions.appendChild(engine);
          }

          body.append(title, urlText, description);
          header.append(body, actions);
          item.appendChild(header);
          resultsContainer.appendChild(item);
        });
      } else {
        resultsContainer.appendChild(
          createElement('p', 'text-center py-8', '没有找到相关结果')
        );
        resultsContainer.lastChild.style.color = 'var(--ink-muted)';
      }

      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    document.getElementById('clearBtn').addEventListener('click', function() {
      document.getElementById('resultsSection').classList.add('hidden');
      clearChildren(document.getElementById('results'));
      setMessage(searchStatus, 'info', '');
      expandMasthead();
    });

    // Reader modal
    const readerModal = document.getElementById('readerModal');
    const readerModalTitle = document.getElementById('readerModalTitle');
    const readerModalBody = document.getElementById('readerModalBody');
    const readerModalClose = document.getElementById('readerModalClose');

    async function openReaderModal(url, title) {
      readerModalTitle.textContent = title || '加载中...';
      readerModalBody.innerHTML = '<p style="color: var(--ink-muted)">正在读取正文...</p>';
      readerModal.classList.add('active');

      try {
        const response = await fetch(\`\${currentOrigin}/content?url=\${encodeURIComponent(url)}\`, {
          credentials: 'same-origin',
          headers: getAuthHeaders(),
        });
        const data = await parseJsonResponse(response);

        readerModalTitle.textContent = data.title || title || '无标题';

        const meta = [];
        if (data.metadata?.author) meta.push(\`作者: \${data.metadata.author}\`);
        if (data.metadata?.published_time) meta.push(\`发布时间: \${data.metadata.published_time}\`);
        if (data.stats?.text_length) meta.push(\`字数: \${data.stats.text_length}\`);

        let html = '';
        if (meta.length > 0) {
          html += \`<div class="reader-modal-meta">\${meta.join(' · ')}</div>\`;
        }
        html += \`<div>\${data.text || data.excerpt || '无法提取正文'}</div>\`;

        readerModalBody.innerHTML = html;
      } catch (error) {
        readerModalBody.innerHTML = \`<p style="color: #991b1b">读取失败: \${error.message}</p>\`;
      }
    }

    function closeReaderModal() {
      readerModal.classList.remove('active');
    }

    readerModalClose.addEventListener('click', closeReaderModal);
    readerModal.addEventListener('click', (e) => {
      if (e.target === readerModal) closeReaderModal();
    });
  </script>
</body>
</html>`;
}
