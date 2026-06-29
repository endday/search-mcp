import { ApiError } from "../core/errors.js";
import {
  getBrowserProfileById,
  getBrowserProfilesForEngine,
  getRandomBrowserProfile,
  getAcceptLanguageHeader,
} from "./engineUtils.js";
import {
  buildEnginePolicy,
  enforceEngineThrottle,
  sleepBeforeRetry,
  shouldRetryUpstream,
} from "./requestPolicy.js";
import {
  getUpstreamSession,
  createDeferredUpstreamSessionWriter,
} from "./upstreamSession.js";
import { runDeferredTask } from "../platform/tasks.js";
import { fetchWithOptionalCurlImpersonate } from "../platform/nodeHttpClient.js";

function appendParam(target, key, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => appendParam(target, key, item));
    return;
  }

  target.append(key, String(value));
}

function applyParams(target, params) {
  if (!params) {
    return;
  }

  if (params instanceof URLSearchParams) {
    for (const [key, value] of params.entries()) {
      appendParam(target, key, value);
    }
    return;
  }

  for (const [key, value] of Object.entries(params)) {
    appendParam(target, key, value);
  }
}

function normalizeHeaders(headers = {}) {
  const normalized = {};
  const entries =
    headers instanceof Headers ? headers.entries() : Object.entries(headers);

  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    normalized[String(key).toLowerCase()] = String(value);
  }

  return normalized;
}

function toFormBody(form) {
  const params = new URLSearchParams();
  applyParams(params, form);
  return params.toString();
}

export function buildCookieHeader(cookies) {
  if (!cookies) {
    return "";
  }

  if (typeof cookies === "string") {
    return cookies.trim();
  }

  const parts = [];
  const entries = Array.isArray(cookies) ? cookies : Object.entries(cookies);

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) {
      continue;
    }

    const [key, value] = entry;
    if (!key || value === undefined || value === null || value === "") {
      continue;
    }

    parts.push(`${String(key).trim()}=${String(value).trim()}`);
  }

  return parts.join("; ");
}

function mergeCookieHeaders(baseCookies, extraCookies) {
  const merged = [buildCookieHeader(baseCookies), buildCookieHeader(extraCookies)]
    .filter(Boolean)
    .join("; ");

  return merged || "";
}

function parseResponseCookies(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    return {};
  }

  const parsed = {};
  for (const item of setCookie.split(/,(?=[^;]+=[^;]+)/)) {
    const [pair] = item.split(";");
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function buildNavigationContext({ referrer, origin, headers, requestMethod }) {
  const normalizedHeaders = normalizeHeaders(headers);
  const resolvedReferrer = referrer || normalizedHeaders.referer || normalizedHeaders.referrer;
  let derivedOrigin = "";
  if (resolvedReferrer) {
    try {
      derivedOrigin = new URL(resolvedReferrer).origin;
    } catch (_) {
      derivedOrigin = "";
    }
  }
  const resolvedOrigin =
    origin ||
    normalizedHeaders.origin ||
    derivedOrigin;
  const hasBody = requestMethod !== "GET";
  const sameOriginReferrer =
    resolvedReferrer && resolvedOrigin && resolvedReferrer.startsWith(resolvedOrigin);

  return {
    referrer: resolvedReferrer,
    origin: resolvedOrigin,
    secFetchSite:
      normalizedHeaders["sec-fetch-site"] ||
      (sameOriginReferrer ? "same-origin" : hasBody ? "same-site" : "none"),
  };
}

export function isChallengeResponse(source, patterns = []) {
  const text = String(source || "");

  return patterns.some((pattern) => {
    if (!pattern) {
      return false;
    }

    if (pattern instanceof RegExp) {
      pattern.lastIndex = 0;
      return pattern.test(text);
    }

    return text.includes(String(pattern));
  });
}

export function createBlockedUpstreamError({
  engine = "Upstream",
  surface = "response",
  message,
  details,
} = {}) {
  return new ApiError({
    status: 502,
    code: "UPSTREAM_BLOCKED",
    category: "upstream",
    message: message || `${engine} returned a bot-detection challenge (${surface})`,
    details,
  });
}

export function throwBlockedUpstreamError(options = {}) {
  throw createBlockedUpstreamError(options);
}

export function buildEngineRequest(
  url,
  {
    engine,
    signal,
    language,
    method,
    searchParams,
    form,
    body,
    headers = {},
    cookies,
    referrer,
    accept,
    acceptLanguage,
    userAgent,
    origin,
    sessionHeaders = {},
    profile,
    extraCookies,
  } = {}
) {
  const requestUrl = new URL(url);
  const requestMethod = String(method || (form ? "POST" : "GET")).toUpperCase();
  const selectedProfile = profile || getRandomBrowserProfile(engine);
  const navigation = buildNavigationContext({
    referrer,
    origin,
    headers,
    requestMethod,
  });
  const requestHeaders = normalizeHeaders({
    accept:
      accept ||
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": acceptLanguage || getAcceptLanguageHeader(language),
    "user-agent": userAgent || selectedProfile.ua,
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": navigation.secFetchSite,
    "sec-fetch-user": "?1",
    "cache-control": requestMethod === "GET" ? "max-age=0" : "no-cache",
    pragma: "no-cache",
    "upgrade-insecure-requests": "1",
    ...normalizeHeaders(sessionHeaders),
    ...normalizeHeaders(headers),
  });

  // Chrome Client Hints; Firefox skips these
  if (selectedProfile.headers?.["sec-ch-ua"] && !requestHeaders["sec-ch-ua"]) {
    requestHeaders["sec-ch-ua"] = selectedProfile.headers["sec-ch-ua"];
    requestHeaders["sec-ch-ua-platform"] = selectedProfile.headers["sec-ch-ua-platform"];
    requestHeaders["sec-ch-ua-mobile"] = selectedProfile.headers["sec-ch-ua-mobile"];
  }
  const cookieHeader = mergeCookieHeaders(cookies, extraCookies);

  if (cookieHeader) {
    requestHeaders.cookie = cookieHeader;
  }

  if (navigation.origin) {
    requestHeaders.origin = navigation.origin;
  }

  applyParams(requestUrl.searchParams, searchParams);

  let requestBody = body;
  if (form && requestBody === undefined) {
    requestBody = toFormBody(form);
    if (!requestHeaders["content-type"]) {
      requestHeaders["content-type"] =
        "application/x-www-form-urlencoded; charset=UTF-8";
    }
  }

  const init = {
    method: requestMethod,
    signal,
    redirect: "follow",
    referrer: navigation.referrer,
    headers: requestHeaders,
  };

  if (requestBody !== undefined && requestMethod !== "GET") {
    init.body = requestBody;
  }

  return {
    url: requestUrl.toString(),
    init,
  };
}

export async function fetchSearchText(
  url,
  {
    engine,
    engineLabel,
    clientId,
    blockedStatuses = [],
    isBlocked,
    blockedSurface = "response",
    runtimeContext,
    ...requestOptions
  } = {}
) {
  const policy = buildEnginePolicy({ name: engine, requestPolicy: requestOptions.requestPolicy });
  const profiles = getBrowserProfilesForEngine(engine);
  const upstreamSession = await getUpstreamSession(clientId, engine, profiles);
  const selectedProfile =
    getBrowserProfileById(upstreamSession?.profileId) ||
    profiles[0] ||
    getRandomBrowserProfile(engine);

  for (let attempt = 0; ; attempt += 1) {
    await enforceEngineThrottle(engine || "upstream", policy);
    const { url: requestUrl, init } = buildEngineRequest(url, {
      ...requestOptions,
      engine,
      profile: selectedProfile,
      extraCookies: upstreamSession?.cookies,
    });

    try {
      const response = await fetchWithOptionalCurlImpersonate(requestUrl, init, {
        profile: selectedProfile,
      });
      const details = {
        engine,
        upstream_status: response.status,
        url: requestUrl,
        attempt,
      };

      if (blockedStatuses.includes(response.status)) {
        throw createBlockedUpstreamError({
          engine: engineLabel || engine || "Upstream",
          surface: `status ${response.status}`,
          details,
        });
      }

      if (!response.ok) {
        throw new ApiError({
          status: 502,
          code: "UPSTREAM_BAD_STATUS",
          category: "upstream",
          message: `Upstream request failed with status ${response.status}`,
          details,
        });
      }

      const text = await response.text();

      if (typeof isBlocked === "function" && isBlocked(text, response)) {
        throw createBlockedUpstreamError({
          engine: engineLabel || engine || "Upstream",
          surface: blockedSurface,
          details,
        });
      }

      const responseCookies = parseResponseCookies(response);
      if (clientId && (upstreamSession?.profileId || Object.keys(responseCookies).length > 0)) {
        const writeSession = createDeferredUpstreamSessionWriter(clientId, engine, {
          profileId: upstreamSession?.profileId || selectedProfile.id,
          cookies: responseCookies,
        });
        await runDeferredTask(runtimeContext, `upstream-session:${engine}`, writeSession);
      }

      return text;
    } catch (error) {
      if (!shouldRetryUpstream(error, attempt, policy)) {
        throw error;
      }

      await sleepBeforeRetry(policy);
    }
  }
}
