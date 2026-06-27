import { isAuthRequired } from "./auth.js";

export async function getDocsHtml() {
  const TOKEN_ENABLED = isAuthRequired();

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search MCP - 文档</title>
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
    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    .code-block {
      background: #1a1714;
      color: #d8d0c0;
      border-radius: 4px;
      padding: 1rem;
      font-size: 0.8rem;
      line-height: 1.6;
      overflow-x: auto;
      border: 1px solid #2a2520;
    }
    .copy-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: rgba(255,255,255,0.1);
      color: #d8d0c0;
      border-radius: 6px;
      padding: 0.3rem 0.6rem;
      font-size: 0.7rem;
      opacity: 0;
      transition: opacity 160ms;
    }
    .code-wrapper:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { background: rgba(255,255,255,0.2); }
    @media (prefers-reduced-motion: reduce) {
      * { scroll-behavior: auto !important; }
    }
  </style>
</head>
<body class="min-h-screen">
  <div class="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">

    <!-- Nav: sticky -->
    <nav class="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b mb-8" style="background: var(--page-bg); border-color: var(--line)">
      <a href="/" class="flex items-baseline gap-2 hover:underline" style="color: var(--ink)">
        <span class="font-serif font-semibold text-lg">Search MCP</span>
      </a>
      <div class="flex gap-4 text-sm font-medium">
        <a href="/" class="hover:underline" style="color: var(--ink-muted)">首页</a>
        <a href="/docs" class="hover:underline" style="color: var(--accent)">文档</a>
        <a href="https://github.com/endday/search-mcp" target="_blank" class="flex items-center gap-1.5 hover:underline" style="color: var(--ink-muted)">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.475 2 2 6.588 2 12.253c0 4.537 2.862 8.369 6.838 9.727.5.09.687-.218.687-.487 0-.243-.013-1.05-.013-1.91C7 20.059 6.35 18.957 6.15 18.38c-.113-.295-.6-1.205-1.025-1.448-.35-.192-.85-.667-.013-.68.788-.012 1.35.744 1.538 1.051.9 1.551 2.338 1.116 2.912.846.088-.666.35-1.115.638-1.371-2.225-.256-4.55-1.14-4.55-5.062 0-1.115.387-2.038 1.025-2.756-.1-.256-.45-1.307.1-2.717 0 0 .837-.269 2.75 1.051.8-.23 1.65-.346 2.5-.346.85 0 1.7.115 2.5.346 1.912-1.333 2.75-1.05 2.75-1.05.55 1.409.2 2.46.1 2.716.637.718 1.025 1.628 1.025 2.756 0 3.934-2.337 4.806-4.562 5.062.362.32.675.936.675 1.897 0 1.371-.013 2.473-.013 2.82 0 .268.188.589.688.486a10.039 10.039 0 004.932-3.74A10.447 10.447 0 0022 12.253C22 6.588 17.525 2 12 2Z"/></svg>
          GitHub
        </a>
      </div>
    </nav>

    <!-- MCP section -->
    <section class="card p-5 sm:p-6 mb-8">
      <h2 class="text-lg font-semibold mb-4">MCP 配置</h2>
      <p class="text-sm mb-4" style="color: var(--ink-muted)">
        将下方配置添加到对应客户端的配置文件，重启后即可在 AI Agent 中使用搜索能力。
      </p>

      <div class="text-xs mb-2 space-y-1" style="color: var(--ink-muted)">
        <p><strong style="color: var(--ink)">Claude Code:</strong> <code class="px-1 rounded" style="background: var(--surface-muted)">~/.claude/config.json</code> 或 <code class="px-1 rounded" style="background: var(--surface-muted)">~/.claude.json</code></p>
        <p><strong style="color: var(--ink)">Claude Desktop (macOS):</strong> <code class="px-1 rounded" style="background: var(--surface-muted)">~/Library/Application Support/Claude/claude_desktop_config.json</code></p>
        <p><strong style="color: var(--ink)">Claude Desktop (Windows):</strong> <code class="px-1 rounded" style="background: var(--surface-muted)">%APPDATA%\\Claude\\claude_desktop_config.json</code></p>
      </div>

      <div class="code-wrapper relative">
        <button type="button" class="copy-btn" data-copy-target="mcp-config-json">复制</button>
        <pre class="code-block"><code id="mcp-config-json"></code></pre>
      </div>

      <div class="mt-5 text-sm space-y-3" style="color: var(--ink-muted)">
        <div class="flex gap-2">
          <span class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold" style="background: var(--accent-bg); color: var(--accent)">1</span>
          <p>粘贴配置到客户端配置文件，保存。</p>
        </div>
        <div class="flex gap-2">
          <span class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold" style="background: var(--accent-bg); color: var(--accent)">2</span>
          <p>重启 Claude Code / Claude Desktop。</p>
        </div>
        <div class="flex gap-2">
          <span class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold" style="background: var(--accent-bg); color: var(--accent)">3</span>
          <p>Claude Code 中运行 <code class="px-1 rounded" style="background: var(--surface-muted)">/mcp</code> 确认 <code class="px-1 rounded" style="background: var(--surface-muted)">search-mcp</code> 已连接。</p>
        </div>
      </div>

      <div class="mt-5 pt-5 border-t text-xs" style="border-color: var(--line); color: var(--ink-muted)">
        <p>NPM: <a href="https://www.npmjs.com/package/@endday/search-mcp" target="_blank" class="hover:underline" style="color: var(--accent)">@endday/search-mcp</a> · MCP 协议: <a href="https://modelcontextprotocol.io" target="_blank" class="hover:underline" style="color: var(--accent)">modelcontextprotocol.io</a></p>
      </div>
    </section>

    <!-- Engines section -->
    <section class="card p-5 sm:p-6 mb-8">
      <h2 class="text-lg font-semibold mb-4">支持的搜索引擎</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        ${[
          { name: "Startpage", tag: "默认优先", desc: "基于 Google 结果，注重隐私，作为默认首选引擎" },
          { name: "DuckDuckGo", tag: "高优先级", desc: "独立索引，注重隐私，无需 API key" },
          { name: "Brave", tag: "高优先级", desc: "独立搜索引擎，直接解析 HTML" },
          { name: "Toutiao", tag: "中文优先", desc: "头条搜索，中文内容覆盖度好" },
          { name: "Mojeek", tag: "补充来源", desc: "独立索引，页面结构简单" },
          { name: "Bing", tag: "兜底", desc: "微软搜索引擎，作为最后一层补充" },
          { name: "Qwant", tag: "补充来源", desc: "欧洲搜索引擎，Qwant Lite 版本" },
          { name: "Yahoo", tag: "补充来源", desc: "Yahoo Search，基于 Bing 结果" },
        ].map((engine) => `
          <div class="rounded-lg p-4 border" style="background: var(--surface-muted); border-color: var(--line)">
            <div class="flex items-center justify-between mb-1.5">
              <div class="font-medium text-sm">${engine.name}</div>
              <span class="text-xs px-2 py-0.5 rounded-full" style="background: var(--accent-bg); color: var(--accent)">${engine.tag}</span>
            </div>
            <p class="text-xs" style="color: var(--ink-muted)">${engine.desc}</p>
          </div>
        `).join("")}
      </div>
    </section>

    <!-- Deploy section -->
    <section class="card p-5 sm:p-6 mb-8">
      <h2 class="text-lg font-semibold mb-4">快速部署</h2>
      <div class="mb-5">
        <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/endday/search-mcp" target="_blank" rel="noopener noreferrer">
          <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers" style="height: 32px;">
        </a>
      </div>
      <p class="text-sm mb-4" style="color: var(--ink-muted)">或使用 Wrangler CLI 手动部署：</p>
      <div class="space-y-3 text-sm">
        <div class="flex gap-3">
          <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style="background: var(--accent-bg); color: var(--accent)">1</span>
          <div>
            <p class="font-medium">安装 Wrangler 并登录</p>
            <div class="code-wrapper relative mt-2">
              <button type="button" class="copy-btn" data-copy-target="deploy-cmd-1">复制</button>
              <pre class="code-block"><code id="deploy-cmd-1">npm install -g wrangler
wrangler login</code></pre>
            </div>
          </div>
        </div>
        <div class="flex gap-3">
          <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style="background: var(--accent-bg); color: var(--accent)">2</span>
          <div>
            <p class="font-medium">克隆并部署</p>
            <div class="code-wrapper relative mt-2">
              <button type="button" class="copy-btn" data-copy-target="deploy-cmd-2">复制</button>
              <pre class="code-block"><code id="deploy-cmd-2">git clone https://github.com/endday/search-mcp.git
cd search-mcp
wrangler deploy</code></pre>
            </div>
          </div>
        </div>
        <div class="flex gap-3">
          <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style="background: var(--accent-bg); color: var(--accent)">3</span>
          <div>
            <p class="font-medium">配置 Token（推荐）</p>
            <div class="code-wrapper relative mt-2">
              <button type="button" class="copy-btn" data-copy-target="deploy-cmd-3">复制</button>
              <pre class="code-block"><code id="deploy-cmd-3">wrangler secret put TOKEN</code></pre>
            </div>
          </div>
        </div>
        <div class="flex gap-3">
          <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style="background: var(--accent-bg); color: var(--accent)">4</span>
          <div>
            <p class="font-medium">绑定自定义域名（推荐）</p>
            <p class="text-xs mt-1" style="color: var(--ink-muted)">
              部署后会获得 <code class="px-1 rounded" style="background: var(--surface-muted)">*.workers.dev</code> 默认域名，但在部分地区可能无法直接访问。绑定自己的域名可确保稳定访问：
            </p>
            <div class="code-wrapper relative mt-2">
              <button type="button" class="copy-btn" data-copy-target="deploy-cmd-4">复制</button>
              <pre class="code-block"><code id="deploy-cmd-4">wrangler deployments tail  # 查看部署状态
# 在 Cloudflare Dashboard → Workers → 你的 Worker → Triggers → Custom Domains 中绑定域名</code></pre>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-5 pt-5 border-t text-xs" style="border-color: var(--line); color: var(--ink-muted)">
        更完整的配置说明请查看 <a href="https://github.com/endday/search-mcp#readme" target="_blank" class="hover:underline" style="color: var(--accent)">GitHub README</a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style="border-color: var(--line); color: var(--ink-muted)">
      <p>Powered by Cloudflare Workers · <a href="https://github.com/endday/search-mcp" target="_blank" class="hover:underline" style="color: var(--accent)">GitHub</a></p>
      <a href="/" class="font-medium hover:underline" style="color: var(--ink)">返回搜索页</a>
    </footer>
  </div>

  <script>
    const currentOrigin = window.location.origin;
    const TOKEN_ENABLED = ${TOKEN_ENABLED};

    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.copyTarget);
        if (!target) return;
        navigator.clipboard.writeText(target.textContent).then(() => {
          const original = btn.textContent;
          btn.textContent = '已复制';
          setTimeout(() => { btn.textContent = original; }, 1500);
        });
      });
    });

    // Examples
    function updateExamples() {
      const exampleToken = TOKEN_ENABLED ? 'YOUR_TOKEN' : '';
      const mcpEnv = [
        \`        "SEARCH_MCP_URL": "\${currentOrigin}"\`,
        ...(TOKEN_ENABLED ? [\`        "SEARCH_MCP_TOKEN": "\${exampleToken}"\`] : []),
      ].join(',\\n');

      document.getElementById('mcp-config-json').textContent = \`{
  "mcpServers": {
    "search-mcp": {
      "command": "npx",
      "args": ["-y", "@endday/search-mcp"],
      "env": {
\${mcpEnv}
      }
    }
  }
}\`;
    }

    updateExamples();
  </script>
</body>
</html>`;
}
