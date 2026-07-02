#!/usr/bin/env node

import { Impit } from "impit/index.js";
import { parseHTML } from "linkedom";

const DEFAULT_DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const DEFAULT_MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

function printUsage() {
  console.log(`Usage:
  node scripts/probe-engine.js --url <url> [options]

Options:
  --url <url>                  Required. Target search URL.
  --selector <css>             Top-level result node selector. Repeatable.
  --link-selector <css>        Link selector inside a result node. Default: h3 a[href], h2 a[href], a[href]
  --title-selector <css>       Title selector inside a result node. Default: h3, h2
  --desc-selector <css>        Description selector inside a result node. Repeatable.
  --ua <string>                Custom user-agent string.
  --mobile                     Use the default mobile user-agent.
  --header <key:value>         Extra request header. Repeatable.
  --max-items <n>              Number of result nodes to print. Default: 5.
  --timeout <ms>               Request timeout. Default: 15000.

Example:
  node scripts/probe-engine.js ^
    --url "https://www.sogou.com/web?query=cloudflare%20workers" ^
    --selector ".results > div" ^
    --selector ".vrwrap" ^
    --desc-selector "p" ^
    --desc-selector ".str-text-info"`);
}

function parseArgs(argv) {
  const options = {
    selectors: [],
    headers: {},
    descSelectors: [],
    linkSelector: "h3 a[href], h2 a[href], a[href]",
    titleSelector: "h3, h2",
    maxItems: 5,
    timeout: 15000,
    ua: DEFAULT_DESKTOP_UA,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--url":
        options.url = next;
        index += 1;
        break;
      case "--selector":
        options.selectors.push(next);
        index += 1;
        break;
      case "--link-selector":
        options.linkSelector = next;
        index += 1;
        break;
      case "--title-selector":
        options.titleSelector = next;
        index += 1;
        break;
      case "--desc-selector":
        options.descSelectors.push(next);
        index += 1;
        break;
      case "--ua":
        options.ua = next;
        index += 1;
        break;
      case "--mobile":
        options.ua = DEFAULT_MOBILE_UA;
        break;
      case "--header": {
        const [key, ...rest] = String(next || "").split(":");
        options.headers[key.trim()] = rest.join(":").trim();
        index += 1;
        break;
      }
      case "--max-items":
        options.maxItems = Number.parseInt(next, 10) || options.maxItems;
        index += 1;
        break;
      case "--timeout":
        options.timeout = Number.parseInt(next, 10) || options.timeout;
        index += 1;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        break;
    }
  }

  return options;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toHeaderEntries(headers) {
  return Object.entries(headers).filter(
    ([key, value]) => key && value !== undefined && value !== null && value !== ""
  );
}

function uniqueNodes(nodes) {
  const seen = new Set();
  const unique = [];

  for (const node of nodes) {
    if (!node || seen.has(node)) {
      continue;
    }

    seen.add(node);
    unique.push(node);
  }

  return unique;
}

function collectNodes(document, selectors) {
  const nodes = [];
  for (const selector of selectors) {
    nodes.push(...document.querySelectorAll(selector));
  }
  return uniqueNodes(nodes);
}

function pickFirst(node, selectors) {
  for (const selector of selectors) {
    const match = node.querySelector(selector);
    if (match) {
      return match;
    }
  }
  return null;
}

function summarizeNode(node, options, index) {
  const linkNode = node.querySelector(options.linkSelector);
  const titleNode =
    pickFirst(node, [options.titleSelector]) ||
    linkNode;
  const descNode = pickFirst(node, options.descSelectors);

  return {
    rank: index + 1,
    class: node.getAttribute("class") || "",
    id: node.getAttribute("id") || "",
    mu: node.getAttribute("mu") || "",
    title: cleanText(titleNode?.textContent || ""),
    href: linkNode?.getAttribute("href") || "",
    description: cleanText(descNode?.textContent || ""),
    html_preview: cleanText(node.outerHTML).slice(0, 500),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.url || options.selectors.length === 0) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  if (options.descSelectors.length === 0) {
    options.descSelectors = [
      "p",
      ".c-color-text",
      ".str-text-info",
      ".mh-content",
      ".res-desc",
      ".c-span-last",
      ".compText",
    ];
  }

  const client = new Impit({
    browser: options.ua === DEFAULT_MOBILE_UA ? "chrome136" : "chrome136",
    followRedirects: true,
    vanillaFallback: false,
    timeout: options.timeout,
  });

  const startedAt = Date.now();
  const response = await client.fetch(options.url, {
    headers: toHeaderEntries({
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "user-agent": options.ua,
      ...options.headers,
    }),
  });
  const html = await response.text();
  const { document } = parseHTML(html);
  const nodes = collectNodes(document, options.selectors);

  console.log(
    JSON.stringify(
      {
        url: options.url,
        final_url: response.url,
        status: response.status,
        duration_ms: Date.now() - startedAt,
        title: cleanText(document.querySelector("title")?.textContent || ""),
        content_length: html.length,
        selector_counts: Object.fromEntries(
          options.selectors.map((selector) => [
            selector,
            document.querySelectorAll(selector).length,
          ])
        ),
        result_count: nodes.length,
        results: nodes.slice(0, options.maxItems).map((node, index) =>
          summarizeNode(node, options, index)
        ),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error.message,
        stack: error.stack,
      },
      null,
      2
    )
  );
  process.exit(1);
});
