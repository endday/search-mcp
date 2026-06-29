import { ApiError } from "../../core/errors.js";
import {
  fetchSearchText,
  isChallengeResponse,
  throwBlockedUpstreamError,
} from "../engineRequest.js";
import { cleanText, parseHtml } from "../../core/html.js";
import { normalizeResults } from "../ranking.js";

const TOUTIAO_CHALLENGE_PATTERNS = [
  /安全验证/i,
  /captcha.*验证/i,
];

function isToutiaoChallengeResponse(source) {
  const text = String(source || "");
  return (
    isChallengeResponse(text, TOUTIAO_CHALLENGE_PATTERNS) ||
    (text.length < 1000 && /<form\b/i.test(text)) ||
    /"challenge_code"\s*:\s*1366/.test(text) ||
    /"template_key"\s*:\s*"71-undefined"/.test(text)
  );
}

function throwToutiaoChallengeError() {
  throwBlockedUpstreamError({
    engine: "Toutiao",
    surface: "html",
  });
}

/**
 * Decode a Toutiao search-jump redirect URL.
 * Links in the SSR HTML look like:
 *   https://sou.toutiao.com/search/jump?url=https%3A%2F%2Fexample.com%2Farticle
 * We extract and decode the embedded target URL.
 */
function decodeToutiaoJumpUrl(href) {
  try {
    const url = new URL(href);
    const target = url.searchParams.get("url");
    if (!target) return href;
    const decoded = decodeURIComponent(target);
    if (decoded.includes("search/jump?url=")) {
      return decodeToutiaoJumpUrl(decoded);
    }
    return decoded;
  } catch (_) {
    return href;
  }
}

/**
 * Extract description text from a result-content card.
 *
 * Toutiao SSR DOM structure per search result:
 *   div.result-content
 *     script/style (hydrate/render code, ignored)
 *     div
 *       div.cs-view.cs-view-block.cs-card
 *         div.cs-view.cs-view-block.cs-card-header
 *           a[href] (title link)
 *         div.cs-view.cs-view-block.cs-card-content
 *           (description text, may be inside nested divs)
 */
function extractCardDescription(card) {
  // Look for cs-card-content, which holds the description
  const contentNode = card.querySelector(".cs-card-content");
  if (contentNode) {
    // The description text is usually in a direct child div without a link
    const descDivs = contentNode.querySelectorAll("div");
    for (const d of descDivs) {
      const txt = cleanText(d.textContent || "").trim();
      // Skip text that's just the title repeated, or too short, or contains JS
      if (
        txt.length > 15 &&
        txt.length < 500 &&
        !txt.includes("druid") &&
        !txt.includes("PerfTag") &&
        !txt.includes("script")
      ) {
        // Prefer longer, more descriptive text
        if (txt.length > 40) {
          return txt.slice(0, 300);
        }
      }
    }
    // Fallback: the content node's own text (excluding nested links)
    const fullText = cleanText(contentNode.textContent || "").trim();
    // Remove the title portion from the description
    const titleLink = card.querySelector("a[href]");
    const titleText = titleLink ? (titleLink.textContent || "").trim() : "";
    const descOnly = fullText.replace(titleText, "").trim();
    if (descOnly.length > 15 && descOnly.length < 500 && !descOnly.includes("druid")) {
      return descOnly.slice(0, 300);
    }
  }

  // Fallback: search all divs in the card for description-like text
  const allDivs = card.querySelectorAll("div");
  for (const d of allDivs) {
    const txt = cleanText(d.textContent || "").trim();
    if (
      txt.length > 30 &&
      txt.length < 500 &&
      !txt.includes("druid") &&
      !txt.includes("PerfTag") &&
      !txt.includes("script") &&
      !txt.includes("换一换")
    ) {
      return txt.slice(0, 300);
    }
  }

  return "";
}

export function parseToutiaoResults(html) {
  if (isToutiaoChallengeResponse(html)) {
    throwToutiaoChallengeError();
  }

  const root = parseHtml(html);
  const seen = new Set();
  const results = [];

  // Find the search result list container
  const resultList = root.querySelector(".s-result-list");

  if (!resultList) {
    throw new ApiError({
      status: 502,
      code: "UPSTREAM_PARSE_ERROR",
      category: "upstream",
      message: "Toutiao parser could not find s-result-list container",
    });
  }

  // Each div.result-content inside s-result-list is one search result card.
  // Skip cards inside s-side-list (hot trending sidebar).
  const cards = resultList.querySelectorAll(".result-content");

  for (const card of cards) {
    // Exclude the hot trending sidebar entirely
    if (card.closest(".s-side-list")) continue;

    // Exclude ad/promotion cards: data-test-card-id="67-toutiao_web"
    // Keep organic results: "67-homepage" (official site), "26-aft_ciyu_detail" (word definition)
    const adMarker = card.querySelector("[data-test-card-id='67-toutiao_web']");
    if (adMarker) continue;

    // Exclude related-search suggestions: data-test-card-id="20-undefined"
    const relatedMarker = card.querySelector("[data-test-card-id^='20-']");
    if (relatedMarker) continue;

    // Find the primary title link
    const links = card.querySelectorAll("a[href]");
    const titleLink = links.find((a) => {
      const href = a.getAttribute("href") || "";
      const text = (a.textContent || "").trim();
      return (
        href.includes("search/jump?url=") ||
        href.includes("/article/") ||
        href.includes("m.douyinhanyu.com") ||
        href.includes("baike.com") ||
        href.includes("m.toutiaoimg.cn") ||
        href.includes("cloud.tencent.com")
      ) && text.length > 3 && !/^\d{1,2}:\d{2}/.test(text);
    });

    if (!titleLink) continue;

    const title = cleanText(titleLink.textContent || titleLink.innerHTML || "").trim();
    const href = titleLink.getAttribute("href") || "";

    if (!title || title.length < 3 || title.length > 150) continue;

    // Skip UI/navigation titles
    if (
      title.includes("换一换") ||
      title.includes("首页") ||
      title.includes("登录") ||
      title.includes("去西瓜搜") ||
      title.includes("去抖音搜") ||
      title.includes("查看详情") ||
      title.includes("播放") ||
      title.startsWith("无障碍") ||
      title.startsWith("相关搜索")
    ) continue;

    const targetUrl = decodeToutiaoJumpUrl(href);
    if (!targetUrl || targetUrl.startsWith("#") || targetUrl.startsWith("/")) continue;

    // Skip trending items and internal search navigation
    if (targetUrl.includes("/trending")) continue;
    if (targetUrl.includes("so.toutiao.com/search") && !targetUrl.includes("toutiao.com/a")) continue;

    // Deduplicate by target URL
    try {
      const canonical = new URL(targetUrl).toString().toLowerCase();
      if (seen.has(canonical)) continue;
      seen.add(canonical);
    } catch (_) {
      if (seen.has(targetUrl)) continue;
      seen.add(targetUrl);
    }

    // Extract description from cs-card-content
    const description = extractCardDescription(card);

    results.push({ title, url: targetUrl, description });
  }

  if (results.length === 0) {
    throw new ApiError({
      status: 502,
      code: "UPSTREAM_PARSE_ERROR",
      category: "upstream",
      message: "Toutiao parser could not find organic results",
    });
  }

  return normalizeResults(results);
}

async function searchToutiao(params) {
  const { query, signal, runtimeContext } = params;
  const searchUrl = new URL("https://so.toutiao.com/search");
  searchUrl.searchParams.set("keyword", query);
  searchUrl.searchParams.set("dvpf", "pc");
  searchUrl.searchParams.set("source", "input");

  const html = await fetchSearchText(searchUrl.toString(), {
    engine: "toutiao",
    engineLabel: "Toutiao",
    signal,
    referrer: "https://so.toutiao.com/",
    runtimeContext,
    blockedStatuses: [403, 429],
    isBlocked: isToutiaoChallengeResponse,
    blockedSurface: "html",
  });

  return parseToutiaoResults(html);
}

export const toutiaoAdapter = {
  name: "toutiao",
  label: "Toutiao",
  priority: 65,
  tier: "experimental",
  requestPolicy: {
    retryAttempts: 0,
    minRequestIntervalMs: 500,
  },
  supports: {
    language: true,
    time_range: false,
    pageno: false,
  },
  isAvailable: () => true,
  search: searchToutiao,
};

export default searchToutiao;
