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
  /captcha/i,
  /verify/i,
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

export function parseToutiaoResults(html) {
  if (isToutiaoChallengeResponse(html)) {
    throwToutiaoChallengeError();
  }

  const root = parseHtml(html);
  // Toutiao search results are in cards with data-test-card-id="undefined-default"
  // or similar patterns. Each result card has a title link and a description area.
  const cardNodes = root.querySelectorAll(
    "[data-test-card-id='undefined-default'], [data-test-card-id^='67-']"
  );

  const results = [];

  for (const card of cardNodes) {
    // Title is the first meaningful <a> with an href
    const linkNode = card.querySelector("a[href]");
    if (!linkNode) {
      continue;
    }

    const url = linkNode.getAttribute("href") || "";
    const title = cleanText(linkNode.innerHTML || linkNode.text);

    if (!title || !url || url.startsWith("#")) {
      continue;
    }

    // Description: look for text in the card after the title
    const descNode =
      card.querySelector(".abstract, .result-abstract, .cs-desc") ||
      card.querySelector("p, span");

    const description = cleanText(
      descNode?.innerHTML || descNode?.text || ""
    );

    results.push({ title, url, description });
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
    // engineRequest already applies a realistic Chrome UA + Sec-Fetch headers
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
