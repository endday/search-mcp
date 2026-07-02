import { ApiError } from "../../core/errors.js";
import { fetchSearchText } from "../engineRequest.js";
import { ensureAbsoluteUrl, mapTimeRange, resolvePageNumber } from "../engineUtils.js";
import { cleanText, parseHtml } from "../../core/html.js";
import { normalizeResults } from "../ranking.js";

const BAIDU_TIME_RANGE = {
  day: "1",
  week: "2",
  month: "3",
  year: "4",
};

function extractBaiduResultUrl(node, linkNode) {
  const mu = node.getAttribute("mu");
  if (mu) {
    return ensureAbsoluteUrl(mu, "https://www.baidu.com");
  }

  return ensureAbsoluteUrl(
    linkNode?.getAttribute("href"),
    "https://www.baidu.com"
  );
}

function extractBaiduTitle(node, linkNode) {
  const titleNode =
    node.querySelector("h3 a") ||
    node.querySelector("h3") ||
    linkNode;

  return cleanText(titleNode?.innerHTML || titleNode?.text || "");
}

export function parseBaiduResults(html) {
  const root = parseHtml(html);
  const resultNodes = root.querySelectorAll(
    "#content_left .result, #content_left .result-op"
  );
  const results = [];

  for (const node of resultNodes) {
    const linkNode = node.querySelector("h3 a[href]");
    if (!linkNode) {
      continue;
    }

    const url = extractBaiduResultUrl(node, linkNode);
    if (!url || /^https?:\/\/(?:www\.)?baidu\.com\//i.test(url)) {
      continue;
    }

    const descriptionNode =
      node.querySelector('[data-sanssr-cmpt="card/www-summary"]') ||
      node.querySelector(".c-span-last p") ||
      node.querySelector(".content-right_8Zs40") ||
      node.querySelector(".c-color-text") ||
      node.querySelector(".c-line-clamp3") ||
      node.querySelector("p");

    results.push({
      title: extractBaiduTitle(node, linkNode),
      url,
      description: cleanText(
        descriptionNode?.innerHTML || descriptionNode?.text || ""
      ),
    });
  }

  const normalized = normalizeResults(results);
  if (normalized.length === 0) {
    throw new ApiError({
      status: 502,
      code: "UPSTREAM_PARSE_ERROR",
      category: "upstream",
      message: "Baidu parser could not find organic results",
    });
  }

  return normalized;
}

function buildBaiduSearchUrl({ query, time_range, pageno }) {
  const page = resolvePageNumber(pageno);
  const searchUrl = new URL("https://www.baidu.com/s");
  searchUrl.searchParams.set("wd", query);
  searchUrl.searchParams.set("ie", "utf-8");
  searchUrl.searchParams.set("rn", "10");

  if (page > 0) {
    searchUrl.searchParams.set("pn", String(page * 10));
  }

  const timeFilter = mapTimeRange(time_range, BAIDU_TIME_RANGE);
  if (timeFilter) {
    searchUrl.searchParams.set("gpc", `stf=${timeFilter}`);
  }

  return searchUrl;
}

async function searchBaidu(params) {
  const { query, language, time_range, pageno, signal, runtimeContext } = params;
  const searchUrl = buildBaiduSearchUrl({
    query,
    time_range,
    pageno,
  });

  const html = await fetchSearchText(searchUrl.toString(), {
    engine: "baidu",
    engineLabel: "Baidu",
    signal,
    language,
    cookies: {
      BAIDUID_BFESS: "search-mcp",
      PSTM: "0",
    },
    referrer: "https://www.baidu.com/",
    runtimeContext,
    blockedStatuses: [403, 429],
  });

  return parseBaiduResults(html);
}

export const baiduAdapter = {
  name: "baidu",
  label: "Baidu",
  priority: 60,
  tier: "primary",
  requestPolicy: {
    retryAttempts: 1,
    minRequestIntervalMs: 150,
  },
  supports: {
    language: false,
    time_range: true,
    pageno: true,
  },
  isAvailable: () => true,
  search: searchBaidu,
};

export default searchBaidu;
