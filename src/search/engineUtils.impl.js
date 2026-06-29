import { ApiError } from "../core/errors.js";
import { fetchWithOptionalCurlImpersonate } from "../platform/nodeHttpClient.js";

const PROFILE_CATALOG = {
  default: [
    {
      id: "chrome-win",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
        "sec-ch-ua-platform": '"Windows"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      },
    },
    {
      id: "chrome-mac",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
        "sec-ch-ua-platform": '"macOS"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      },
    },
    {
      id: "firefox-win",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      },
    },
  ],
  bing: ["chrome-win", "chrome-mac"],
  startpage: ["chrome-win", "firefox-win"],
  duckduckgo: ["chrome-mac", "firefox-win"],
  brave: ["chrome-win", "chrome-mac"],
  yahoo: ["chrome-win", "firefox-win"],
  qwant: ["chrome-mac", "firefox-win"],
  mojeek: ["chrome-win", "chrome-mac"],
  toutiao: ["chrome-mac"],
};

const PROFILE_LOOKUP = new Map(
  PROFILE_CATALOG.default.map((profile) => [profile.id, profile])
);

let profileIndex = 0;

function getProfileIdsForEngine(engine) {
  const normalizedEngine = String(engine || "").toLowerCase();
  if (normalizedEngine === "default") {
    return PROFILE_CATALOG.default.map((profile) => profile.id);
  }

  const configured = PROFILE_CATALOG[normalizedEngine];
  if (!configured || configured.length === 0) {
    return PROFILE_CATALOG.default.map((profile) => profile.id);
  }

  return configured;
}

export function getBrowserProfilesForEngine(engine) {
  return getProfileIdsForEngine(engine)
    .map((id) => PROFILE_LOOKUP.get(id))
    .filter(Boolean);
}

export function getRandomUserAgent(engine = "default") {
  const profiles = getBrowserProfilesForEngine(engine);
  profileIndex = (profileIndex + 1) % profiles.length;
  return profiles[profileIndex].ua;
}

export function getRandomBrowserProfile(engine = "default") {
  const profiles = getBrowserProfilesForEngine(engine);
  profileIndex = (profileIndex + 1) % profiles.length;
  return profiles[profileIndex];
}

export function getBrowserProfileById(profileId) {
  return PROFILE_LOOKUP.get(profileId) || null;
}

export function getAcceptLanguageHeader(language) {
  const normalized = String(language || "").trim().toLowerCase();

  if (!normalized) {
    return "en-US,en;q=0.9";
  }

  if (normalized.startsWith("zh")) {
    return "zh-CN,zh;q=0.9,en;q=0.8";
  }

  if (normalized.startsWith("en-gb")) {
    return "en-GB,en;q=0.9";
  }

  if (normalized.startsWith("en")) {
    return "en-US,en;q=0.9";
  }

  return `${language},en;q=0.8`;
}

export function getDefaultFetchHeaders(language, extraHeaders = {}, engine = "default") {
  const profile = getRandomBrowserProfile(engine);
  return {
    ...profile.headers,
    "accept-language": getAcceptLanguageHeader(language),
    "user-agent": profile.ua,
    "sec-fetch-site": "none",
    ...extraHeaders,
  };
}

export async function fetchText(
  url,
  { signal, language, headers = {}, referrer, engine = "default" } = {}
) {
  const response = await fetchWithOptionalCurlImpersonate(url, {
    signal,
    redirect: "follow",
    referrer,
    headers: getDefaultFetchHeaders(language, headers, engine),
  });

  if (!response.ok) {
    throw new ApiError({
      status: 502,
      code: "UPSTREAM_BAD_STATUS",
      category: "upstream",
      message: `Upstream request failed with status ${response.status}`,
      details: {
        upstream_status: response.status,
        url,
      },
    });
  }

  return response.text();
}

export async function fetchJson(
  url,
  { signal, language, headers = {}, referrer, engine = "default" } = {}
) {
  const response = await fetchWithOptionalCurlImpersonate(url, {
    signal,
    redirect: "follow",
    referrer,
    headers: getDefaultFetchHeaders(
      language,
      {
        accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        ...headers,
      },
      engine
    ),
  });

  if (!response.ok) {
    throw new ApiError({
      status: 502,
      code: "UPSTREAM_BAD_STATUS",
      category: "upstream",
      message: `Upstream request failed with status ${response.status}`,
      details: {
        upstream_status: response.status,
        url,
      },
    });
  }

  return response.json();
}

export function ensureAbsoluteUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch (_) {
    return String(url || "").trim();
  }
}

export function mapTimeRange(timeRange, mapping) {
  if (!timeRange) {
    return "";
  }

  return mapping[String(timeRange).toLowerCase()] || "";
}

export function mapLanguage(language, mapping, fallback = "") {
  if (!language) {
    return fallback;
  }

  const normalized = String(language).toLowerCase();
  const short = normalized.split("-")[0];
  return mapping[normalized] || mapping[short] || fallback;
}

export function resolvePageNumber(value) {
  const parsed = Number.parseInt(value ?? "0", 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}
