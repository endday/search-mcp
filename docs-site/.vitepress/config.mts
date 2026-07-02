import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "zh-CN",
  title: "Search MCP",
  description: "Search MCP 本地文档站",
  base: process.env.GITHUB_ACTIONS ? "/search-mcp/" : "/",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: "/mark.svg",
    nav: [
      { text: "首页", link: "/" },
      { text: "快速开始", link: "/guide/getting-started" },
      { text: "MCP 配置", link: "/guide/mcp-config" },
      { text: "GitHub", link: "https://github.com/endday/search-mcp" }
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "MCP 配置", link: "/guide/mcp-config" }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/endday/search-mcp" }
    ],
    footer: {
      message: "Local-first documentation for Search MCP",
      copyright: "GPL-3.0"
    },
    search: {
      provider: "local"
    }
  }
});
