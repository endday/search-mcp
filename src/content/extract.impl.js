import { Readability } from "@mozilla/readability";
import { DOMParser } from "linkedom/worker";

import { cleanText, parseHtml } from "../core/html.js";

const NOISE_SELECTOR =
  "script, style, noscript, nav, footer, header, aside, form, iframe, svg, canvas, button, input, select, textarea";
const CANDIDATE_SELECTOR =
  "article, main, section, div, [role=main], .article, .post, .content, .entry-content, #content";
const POSITIVE_RE =
  /article|body|content|entry|hentry|main|page|post|story|text|正文|内容|文章/i;
const NEGATIVE_RE =
  /ad|banner|comment|combx|contact|footer|header|menu|meta|nav|promo|related|remark|rss|share|sidebar|social|tag|tool|widget|广告|评论|导航|分享|推荐|相关阅读/i;

function getNodeText(node) {
  return cleanText(node?.text || "");
}

function getMeta(root, selector) {
  return cleanText(root.querySelector(selector)?.getAttribute("content") || "");
}

function getNodeSignal(node) {
  return `${node.getAttribute?.("id") || ""} ${node.getAttribute?.("class") || ""}`;
}

function scoreCandidate(node) {
  const text = getNodeText(node);
  const textLength = text.length;

  if (textLength < 80) {
    return {
      node,
      score: 0,
      textLength,
      linkDensity: 1,
      paragraphCount: 0,
    };
  }

  const linkTextLength = node
    .querySelectorAll("a")
    .reduce((total, link) => total + getNodeText(link).length, 0);
  const paragraphCount = node.querySelectorAll("p").filter((p) => {
    return getNodeText(p).length >= 20;
  }).length;
  const commaCount = (text.match(/[，,。.!?！？；;]/g) || []).length;
  const signal = getNodeSignal(node);
  const linkDensity = textLength ? linkTextLength / textLength : 1;
  let score = textLength + paragraphCount * 120 + commaCount * 12;

  if (POSITIVE_RE.test(signal)) {
    score += 350;
  }

  if (NEGATIVE_RE.test(signal)) {
    score -= 500;
  }

  score *= Math.max(0.05, 1 - linkDensity);

  return {
    node,
    score,
    textLength,
    linkDensity,
    paragraphCount,
  };
}

function cleanTree(root) {
  root.querySelectorAll(NOISE_SELECTOR).forEach((node) => node.remove());
  root.querySelectorAll("a").forEach((link) => {
    const href = String(link.getAttribute("href") || "").trim();
    if (/^\s*javascript:/i.test(href)) {
      link.removeAttribute("href");
    }
  });
}

function stripUnsafeHtml(html) {
  return String(html || "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+href\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, "");
}

function pickBestCandidate(root) {
  const candidates = root
    .querySelectorAll(CANDIDATE_SELECTOR)
    .map(scoreCandidate)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (best?.score > 0) {
    return best;
  }

  const body = root.querySelector("body") || root;
  return scoreCandidate(body);
}

function getPageMetadata(html) {
  const root = parseHtml(html);

  return {
    title:
      getMeta(root, 'meta[property="og:title"]') ||
      getMeta(root, 'meta[name="twitter:title"]') ||
      cleanText(root.querySelector("title")?.text || ""),
    description:
      getMeta(root, 'meta[property="og:description"]') ||
      getMeta(root, 'meta[name="twitter:description"]') ||
      getMeta(root, 'meta[name="description"]'),
    site_name: getMeta(root, 'meta[property="og:site_name"]'),
    author: getMeta(root, 'meta[name="author"]'),
    published_time:
      getMeta(root, 'meta[property="article:published_time"]') ||
      getMeta(root, 'meta[name="date"]') ||
      getMeta(root, 'meta[name="pubdate"]'),
    image:
      getMeta(root, 'meta[property="og:image"]') ||
      getMeta(root, 'meta[name="twitter:image"]'),
    lang: root.querySelector("html")?.getAttribute("lang") || "",
  };
}

function extractWithReadability(html, url) {
  const document = new DOMParser().parseFromString(html, "text/html");

  if (url && document.head) {
    const base = document.createElement("base");
    base.setAttribute("href", url);
    document.head.appendChild(base);
  }

  const article = new Readability(document, {
    keepClasses: true,
  }).parse();

  if (!article?.content) {
    return null;
  }

  return article;
}

function normalizeReadabilityArticle(article, metadata, url) {
  const text = cleanText(article.textContent || article.content);
  const contentHtml = stripUnsafeHtml(article.content);

  if (text.length < 80) {
    return null;
  }

  return {
    url: article.url || url,
    source: "direct-fetch",
    extractor: "readability",
    title: cleanText(article.title || metadata.title || ""),
    description: cleanText(article.excerpt || metadata.description || ""),
    metadata: {
      ...metadata,
      title: cleanText(article.title || metadata.title || ""),
      description: cleanText(article.excerpt || metadata.description || ""),
      site_name: cleanText(article.siteName || metadata.site_name || ""),
      author: cleanText(article.byline || metadata.author || ""),
      lang: article.lang || metadata.lang || "",
    },
    html: contentHtml,
    text,
    excerpt: text.slice(0, 500),
    stats: {
      text_length: text.length,
      html_length: contentHtml.length,
      score: null,
      link_density: null,
      paragraph_count: (contentHtml.match(/<p\b/gi) || []).length,
    },
  };
}

function extractPageContentWithHeuristics(html, url) {
  const root = parseHtml(html);
  const metadata = getPageMetadata(html);

  cleanTree(root);

  const candidate = pickBestCandidate(root);
  const text = getNodeText(candidate.node);
  const contentHtml = stripUnsafeHtml(candidate.node?.toString() || "");

  return {
    url,
    source: "direct-fetch",
    extractor: "heuristic",
    title: metadata.title,
    description: metadata.description,
    metadata,
    html: contentHtml,
    text,
    excerpt: text.slice(0, 500),
    stats: {
      text_length: text.length,
      html_length: contentHtml.length,
      score: Math.round(candidate.score),
      link_density: Number(candidate.linkDensity.toFixed(3)),
      paragraph_count: candidate.paragraphCount,
    },
  };
}

export async function extractPageContent(html, url) {
  try {
    const metadata = getPageMetadata(html);
    const article = extractWithReadability(html, url);
    const extracted = normalizeReadabilityArticle(article, metadata, url);

    if (extracted) {
      return extracted;
    }
  } catch (_) {
    // Fall back to the local heuristic extractor when the library cannot parse
    // a page or when Worker bundling/runtime behavior differs by site.
  }

  return extractPageContentWithHeuristics(html, url);
}
