import { ApiError } from "./errors.js";
import {
  fetchSearchText,
  isChallengeResponse,
  throwBlockedUpstreamError,
} from "./engineRequest.js";
import { cleanText, parseHtml } from "./html.js";
import { normalizeResults } from "./index.js";

const TOUTIAO_CHALLENGE_PATTERNS = [
  /安全验证/i,
  /captcha.*验证/i,
];

function isToutiaoChallengeResponse(source) {
  const text = String(source || "");
  return (
    isChallengeResponse(text, TOUTIAO_CHALLENGE_PATTERNS) ||
    (text.length < 1000 && /<form\b/i.test(text))
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
    // If the decoded target is still a redirect, recursively decode
    if (decoded.includes("search/jump?url=")) {
      return decodeToutiaoJumpUrl(decoded);
    }
    return decoded;
  } catch (_) {
    return href;
  }
}

export function parseToutiaoResults(html) {
  if (isToutiaoChallengeResponse(html)) {
    throwToutiaoChallengeError();
  }

  const root = parseHtml(html);
  const seen = new Set();
  const results = [];

  // Toutiao SSR embeds search result links as redirect URLs:
  //   https://sou.toutiao.com/search/jump?url=<encoded-target>
  // These are the actual organic search results with title text in the <a>.
  const allLinks = root.querySelectorAll("a[href]");

  for (const link of allLinks) {
    const href = link.getAttribute("href") || "";
    const title = cleanText(link.textContent || link.innerHTML || "").trim();

    const targetUrl = decodeToutiaoJumpUrl(href);
    if (!targetUrl || targetUrl.startsWith("#") || targetUrl.startsWith("/")) {
      continue;
    }

    // Only process links that look like search result redirects or articles
    if (!href.includes("search/jump?url=") && !targetUrl.includes("/article/")) {
      continue;
    }

    if (!title || title.length < 3 || title.length > 150) {
      continue;
    }

    // Skip links whose title is only a video duration (e.g. "03:06")
    if (/^\d{1,2}:\d{2}/.test(title)) {
      continue;
    }

    // Skip navigation/UI links
    if (
      title.includes("换一换") ||
      title.includes("首页") ||
      title.includes("登录") ||
      title.includes("去西瓜搜") ||
      title.includes("去抖音搜") ||
      title.includes("查看详情") ||
      title.includes("播放") ||
      title.startsWith("无障碍")
    ) {
      continue;
    }

    // Skip trending hot-list items
    if (targetUrl.includes("/trending")) {
      continue;
    }

    // Skip internal Toutiao search navigation links (other search suggestions)
    if (targetUrl.includes("so.toutiao.com/search") && !targetUrl.includes("toutiao.com/a")) {
      continue;
    }

    // Deduplicate by canonical URL
    try {
      const canonical = new URL(targetUrl).toString().toLowerCase();
      if (seen.has(canonical)) {
        continue;
      }
      seen.add(canonical);
    } catch (_) {
      if (seen.has(targetUrl)) {
        continue;
      }
      seen.add(targetUrl);
    }

    // Description: look for the next sibling or parent that has abstract text
    let description = "";
    const parent = link.parentNode;
    if (parent) {
      // Try to find a description-like element near the link
      const descCandidates = parent.querySelectorAll(
        "span, p, div"
      );
      for (const candidate of descCandidates) {
        const text = cleanText(candidate.textContent || "").trim();
        if (text.length > 20 && text.length < 300 && text !== title) {
          description = text;
          break;
        }
      }
    }

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
  const { query, signal } = params;
  const searchUrl = new URL("https://so.toutiao.com/search");
  searchUrl.searchParams.set("keyword", query);
  searchUrl.searchParams.set("dvpf", "pc");
  searchUrl.searchParams.set("source", "input");

  const html = await fetchSearchText(searchUrl.toString(), {
    engine: "toutiao",
    engineLabel: "Toutiao",
    signal,
    referrer: "https://so.toutiao.com/",
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
  supports: {
    language: true,
    time_range: false,
    pageno: false,
  },
  isAvailable: () => true,
  search: searchToutiao,
};

export default searchToutiao;
