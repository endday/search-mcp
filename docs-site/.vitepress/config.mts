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
      { text: "架构", link: "/architecture/overview" },
      { text: "产品", link: "/product/roadmap" },
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
      ],
      "/architecture/": [
        {
          text: "Architecture",
          items: [
            { text: "概览", link: "/architecture/overview" },
            { text: "代码架构优化建议", link: "/architecture/architecture-optimization" }
          ]
        }
      ],
      "/product/": [
        {
          text: "Product",
          items: [
            { text: "版本路线图", link: "/product/roadmap" },
            { text: "Search MCP 迭代计划", link: "/product/search-iteration-plan" },
            { text: "Source Policy Engine", link: "/product/source-policy-engine" },
            { text: "AI Context Resolver 草案", link: "/product/ai-context-resolver" }
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
