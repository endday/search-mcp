import { env, setEnv } from "./envs.js";
import { ApiError, normalizeError, toErrorPayload } from "./utils/errors.js";
import { getSearchHtml } from "./utils/getHTML.js";
import { extractPageContent } from "./utils/pageExtract.js";
import { enforceRateLimit } from "./utils/rateLimit.js";
import { searchAllWithMeta } from "./utils/searchGateway.js";

const ALLOWED_METHODS = "GET, POST, OPTIONS";
const TARGET_FETCH_USER_AGENT =
  "Mozilla/5.0 (compatible; CloudflareSearchReader/1.0; +https://workers.cloudflare.com/)";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_SAFE_REDIRECTS = 5;

function buildCorsHeaders(request) {
  const headers = {
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers":
      request.headers.get("Access-Control-Request-Headers") ||
      env.CORS_ALLOWED_HEADERS.join(", "),
    "Access-Control-Max-Age": "86400",
  };
  const origin = request.headers.get("Origin");

  if (env.CORS_ALLOWED_ORIGINS.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  if (origin && env.CORS_ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

function jsonResponse(request, payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(request),
      ...headers,
    },
  });
}

function getRequestId(request) {
  return request.headers.get("cf-ray") || crypto.randomUUID();
}

function buildServerTimingHeader(engineTimings) {
  return engineTimings
    .map((timing) => `${timing.engine};dur=${timing.duration_ms}`)
    .join(", ");
}

function buildSearchResponseHeaders({ requestId, durationMs, meta }) {
  const headers = {
    "X-Search-Request-Id": requestId,
    "X-Search-Duration-Ms": String(durationMs),
    "X-Search-Cache": meta.cache_status,
    "X-Search-Fallback-Path": meta.fallback_path.join(","),
  };

  if (meta.fallback_order.length > 0) {
    headers["X-Search-Fallback-Order"] = meta.fallback_order.join(",");
  }

  if (meta.engine_timings.length > 0) {
    headers["Server-Timing"] = buildServerTimingHeader(meta.engine_timings);
  }

  return headers;
}

function getBearerToken(request) {
  return request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
}

function getRequestToken(request, paramToken) {
  return getBearerToken(request) || request.headers.get("x-api-key") || paramToken;
}

function isTruthyConfig(value) {
  return ["1", "true", "yes", "on", "required"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function isAuthRequired() {
  return !!env.TOKEN || isTruthyConfig(env.AUTH_REQUIRED);
}

function ensureAuthConfigured() {
  if (isTruthyConfig(env.AUTH_REQUIRED) && !env.TOKEN) {
    throw new ApiError({
      status: 503,
      code: "AUTH_TOKEN_NOT_CONFIGURED",
      category: "configuration",
      message:
        "AUTH_REQUIRED is enabled but TOKEN is not configured. Set TOKEN as a Cloudflare Worker secret before deploying publicly.",
    });
  }
}

function isAuthorizedToken(requestToken) {
  if (!isAuthRequired()) {
    return true;
  }

  return !!env.TOKEN && requestToken === env.TOKEN;
}

function verifyToken(requestToken) {
  return isAuthorizedToken(requestToken);
}

function getRateLimitToken(requestToken) {
  if (!isAuthRequired()) {
    return null;
  }

  return isAuthorizedToken(requestToken) ? requestToken : null;
}

async function parsePostParams(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = await request.json();
      return payload && typeof payload === "object" ? payload : {};
    } catch (_) {
      throw new ApiError({
        status: 400,
        code: "INVALID_JSON",
        category: "validation",
        message: "POST body must be valid JSON",
      });
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(await request.text()));
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  try {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  } catch (_) {
    return {};
  }
}

async function parseRequestParams(request, url) {
  if (request.method === "GET") {
    return Object.fromEntries(url.searchParams.entries());
  }

  return parsePostParams(request);
}

function normalizeEngineParam(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value.split(",").filter(Boolean);
  }

  return undefined;
}

function normalizeTimeRange(value) {
  const normalized = String(value || "").toLowerCase();
  return ["day", "week", "month", "year"].includes(normalized)
    ? normalized
    : undefined;
}

function normalizePageNumber(value) {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function normalizePositiveInteger(value, fallback, { min = 1, max } = {}) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max || parsed);
}

function normalizeWaitUntil(value) {
  const normalized = String(value || "").trim();
  return ["load", "domcontentloaded", "networkidle0", "networkidle2"].includes(
    normalized
  )
    ? normalized
    : "load";
}

function parseIpv4Address(value) {
  const match = String(value || "").match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );

  if (!match) {
    return null;
  }

  const octets = match.slice(1).map((part) => Number.parseInt(part, 10));
  return {
    octets,
    valid: octets.every((part) => part >= 0 && part <= 255),
  };
}

function isBlockedIpv4Address(octets) {
  const [first, second] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function parseIpv6Hextets(value) {
  let normalized = String(value || "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split("%")[0];

  if (!normalized.includes(":")) {
    return null;
  }

  const embeddedIpv4Match = normalized.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embeddedIpv4Match) {
    const parsedIpv4 = parseIpv4Address(embeddedIpv4Match[1]);
    if (!parsedIpv4?.valid) {
      return null;
    }

    const [a, b, c, d] = parsedIpv4.octets;
    const replacement = `${((a << 8) | b).toString(16)}:${(
      (c << 8) |
      d
    ).toString(16)}`;
    normalized =
      normalized.slice(0, normalized.length - embeddedIpv4Match[1].length) +
      replacement;
  }

  const compressionParts = normalized.split("::");
  if (compressionParts.length > 2) {
    return null;
  }

  const hasCompression = compressionParts.length === 2;
  const leftParts = compressionParts[0]
    ? compressionParts[0].split(":")
    : [];
  const rightParts =
    hasCompression && compressionParts[1]
      ? compressionParts[1].split(":")
      : [];
  const parts = [...leftParts, ...rightParts];

  if (parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }

  if (!hasCompression && parts.length !== 8) {
    return null;
  }

  const fillCount = hasCompression ? 8 - parts.length : 0;
  if (fillCount < 1 && hasCompression) {
    return null;
  }

  return [
    ...leftParts.map((part) => Number.parseInt(part, 16)),
    ...Array(fillCount).fill(0),
    ...rightParts.map((part) => Number.parseInt(part, 16)),
  ];
}

function getEmbeddedIpv4FromIpv6(hextets) {
  if (!hextets || hextets.length !== 8) {
    return null;
  }

  const lastIpv4 = [
    hextets[6] >> 8,
    hextets[6] & 255,
    hextets[7] >> 8,
    hextets[7] & 255,
  ];

  const isIpv4Mapped =
    hextets.slice(0, 5).every((part) => part === 0) && hextets[5] === 0xffff;
  const isIpv4Compatible = hextets.slice(0, 6).every((part) => part === 0);
  const isNat64WellKnown =
    hextets[0] === 0x0064 &&
    hextets[1] === 0xff9b &&
    hextets.slice(2, 6).every((part) => part === 0);

  return isIpv4Mapped || isIpv4Compatible || isNat64WellKnown ? lastIpv4 : null;
}

function isBlockedIpv6Address(hextets) {
  if (!hextets || hextets.length !== 8) {
    return false;
  }

  const first = hextets[0];
  const embeddedIpv4 = getEmbeddedIpv4FromIpv6(hextets);

  return (
    hextets.every((part) => part === 0) ||
    hextets.slice(0, 7).every((part) => part === 0) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (embeddedIpv4 ? isBlockedIpv4Address(embeddedIpv4) : false)
  );
}

function isBlockedTargetHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  const parsedIpv4 = parseIpv4Address(normalized);
  if (parsedIpv4) {
    return !parsedIpv4.valid || isBlockedIpv4Address(parsedIpv4.octets);
  }

  return isBlockedIpv6Address(parseIpv6Hextets(normalized));
}

function normalizeTargetUrl(value) {
  const rawUrl = String(value || "").trim();

  if (!rawUrl) {
    throw new ApiError({
      status: 400,
      code: "MISSING_URL",
      category: "validation",
      message: "Please provide 'url' parameter",
    });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (_) {
    throw new ApiError({
      status: 400,
      code: "INVALID_URL",
      category: "validation",
      message: "The 'url' parameter must be a valid URL",
    });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_URL",
      category: "validation",
      message: "Only http and https URLs are supported",
    });
  }

  if (isBlockedTargetHostname(parsedUrl.hostname)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_URL",
      category: "validation",
      message: "Localhost and private network URLs are not supported",
    });
  }

  return parsedUrl.toString();
}

function getSafeRedirectUrl(response, currentUrl) {
  if (!REDIRECT_STATUSES.has(response.status)) {
    return null;
  }

  const location = response.headers.get("location");
  if (!location) {
    return null;
  }

  return normalizeTargetUrl(new URL(location, currentUrl).toString());
}

async function cancelResponseBody(response) {
  try {
    await response.body?.cancel();
  } catch (_) {
    // Ignored: this is only a best-effort cleanup for redirect/preflight checks.
  }
}

async function fetchWithSafeRedirects(targetUrl, init = {}) {
  let currentUrl = normalizeTargetUrl(targetUrl);

  for (let redirectCount = 0; redirectCount <= MAX_SAFE_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });
    const redirectUrl = getSafeRedirectUrl(response, currentUrl);

    if (!redirectUrl) {
      return response;
    }

    await cancelResponseBody(response);
    currentUrl = redirectUrl;
  }

  throw new ApiError({
    status: 508,
    code: "TOO_MANY_REDIRECTS",
    category: "upstream",
    message: "Target URL redirected too many times",
  });
}

async function verifySafeRedirectChain(targetUrl) {
  const response = await fetchWithSafeRedirects(targetUrl, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Range: "bytes=0-0",
      "User-Agent": TARGET_FETCH_USER_AGENT,
    },
  });

  await cancelResponseBody(response);
}

async function readResponseTextWithLimit(response, maxBytes) {
  const contentLength = Number.parseInt(
    response.headers.get("content-length") || "0",
    10
  );

  if (contentLength > maxBytes) {
    throw new ApiError({
      status: 413,
      code: "CONTENT_TOO_LARGE",
      category: "upstream",
      message: `Upstream response is larger than ${maxBytes} bytes`,
    });
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      throw new ApiError({
        status: 413,
        code: "CONTENT_TOO_LARGE",
        category: "upstream",
        message: `Upstream response is larger than ${maxBytes} bytes`,
      });
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = value instanceof Uint8Array ? value : new TextEncoder().encode(value);
    receivedBytes += chunk.byteLength;

    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw new ApiError({
        status: 413,
        code: "CONTENT_TOO_LARGE",
        category: "upstream",
        message: `Upstream response is larger than ${maxBytes} bytes`,
      });
    }

    chunks.push(decoder.decode(chunk, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

function normalizeLocationValue(value) {
  const normalized = String(value || "").trim();

  return normalized || "auto";
}

function isLocationDisabled(value) {
  return ["0", "false", "none", "off", "disable", "disabled"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function getClientLocation(request) {
  const cf = request.cf || {};

  return {
    city: String(cf.city || "").trim(),
    region: String(cf.region || "").trim(),
    country: String(cf.country || "").trim(),
    timezone: String(cf.timezone || "").trim(),
  };
}

function getClientGeoPayload(request) {
  const cf = request.cf || {};

  return {
    ip:
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      null,
    city: cf.city || null,
    region: cf.region || null,
    region_code: cf.regionCode || null,
    country: cf.country || null,
    continent: cf.continent || null,
    postal_code: cf.postalCode || null,
    timezone: cf.timezone || null,
    latitude: cf.latitude || null,
    longitude: cf.longitude || null,
    colo: cf.colo || null,
    asn: cf.asn || null,
    as_organization: cf.asOrganization || null,
  };
}

function resolveLocationContext(request, params) {
  const locationValue = normalizeLocationValue(params.location);

  if (isLocationDisabled(locationValue)) {
    return {
      value: "",
      source: "disabled",
      mode: locationValue,
      client: getClientLocation(request),
    };
  }

  if (locationValue.toLowerCase() !== "auto") {
    return {
      value: locationValue,
      source: "explicit",
      mode: "explicit",
      client: getClientLocation(request),
    };
  }

  const client = getClientLocation(request);
  const value = client.city || client.region;

  return {
    value,
    source: value ? "auto" : "unavailable",
    mode: "auto",
    client,
  };
}

function appendLocationToQuery(query, location) {
  if (!location) {
    return query;
  }

  const normalizedQuery = String(query || "").trim();
  const normalizedLocation = String(location || "").trim();

  if (
    normalizedQuery
      .toLowerCase()
      .includes(normalizedLocation.toLowerCase())
  ) {
    return normalizedQuery;
  }

  return `${normalizedQuery} ${normalizedLocation}`;
}

function inferLanguageFromQuery(query, fallbackLanguage) {
  const normalizedQuery = String(query || "");

  if (/[\u3040-\u30ff]/u.test(normalizedQuery)) {
    return "ja-JP";
  }

  if (/[\uac00-\ud7af]/u.test(normalizedQuery)) {
    return "ko-KR";
  }

  if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(normalizedQuery)) {
    return "zh-CN";
  }

  return fallbackLanguage;
}

function resolveSearchLanguage(params, query) {
  return (
    params.language ||
    params.lang ||
    inferLanguageFromQuery(query, env.DEFAULT_LANGUAGE)
  );
}

async function handleAuthVerify(request, params, requestId) {
  const requestToken = getRequestToken(request, params.token);

  ensureAuthConfigured();
  await enforceRateLimit(request, getRateLimitToken(requestToken));

  if (!verifyToken(requestToken)) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      category: "auth",
      message: "Invalid or missing authentication token",
    });
  }

  return jsonResponse(
    request,
    {
      authorized: true,
      token_required: isAuthRequired(),
    },
    200,
    {
      "X-Search-Request-Id": requestId,
    }
  );
}

async function handleSearch(request, params, requestId) {
  const query = String(params.q || params.query || "").trim();
  const requestToken = getRequestToken(request, params.token);
  const startedAt = Date.now();

  if (!query) {
    throw new ApiError({
      status: 400,
      code: "MISSING_QUERY",
      category: "validation",
      message: "Please provide 'q' or 'query' parameter",
    });
  }

  ensureAuthConfigured();
  await enforceRateLimit(request, getRateLimitToken(requestToken));

  if (!verifyToken(requestToken)) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      category: "auth",
      message: "Invalid or missing authentication token",
    });
  }

  const locationContext = resolveLocationContext(request, params);
  const effectiveQuery = appendLocationToQuery(query, locationContext.value);

  const { response, meta } = await searchAllWithMeta({
    query: effectiveQuery,
    engines: normalizeEngineParam(params.engines),
    language: resolveSearchLanguage(params, query),
    time_range: normalizeTimeRange(params.time_range || params.timeRange),
    pageno: normalizePageNumber(params.pageno || params.page),
  });
  const responsePayload = {
    ...response,
    query,
    effective_query: effectiveQuery,
    location: locationContext.value || null,
    location_source: locationContext.source,
    location_context: locationContext,
  };

  return jsonResponse(
    request,
    responsePayload,
    200,
    buildSearchResponseHeaders({
      requestId,
      durationMs: Date.now() - startedAt,
      meta,
    })
  );
}

function getBrowserRenderingConfig() {
  const accountId = String(env.CF_BROWSER_RENDERING_ACCOUNT_ID || "").trim();
  const apiToken = String(env.CF_BROWSER_RENDERING_API_TOKEN || "").trim();

  if (!accountId || !apiToken) {
    throw new ApiError({
      status: 503,
      code: "BROWSER_RENDERING_NOT_CONFIGURED",
      category: "configuration",
      message:
        "Configure CF_BROWSER_RENDERING_ACCOUNT_ID and CF_BROWSER_RENDERING_API_TOKEN to use /markdown",
    });
  }

  return { accountId, apiToken };
}

function buildMarkdownPayload(targetUrl, params) {
  const timeoutMs = normalizePositiveInteger(params.timeout_ms || params.timeoutMs, 30_000, {
    min: 1_000,
    max: 60_000,
  });
  const payload = {
    url: targetUrl,
    gotoOptions: {
      waitUntil: normalizeWaitUntil(params.wait_until || params.waitUntil),
      timeout: timeoutMs,
    },
  };
  const selector = String(params.wait_for_selector || params.waitForSelector || "").trim();
  const userAgent = String(params.user_agent || params.userAgent || "").trim();

  if (selector) {
    payload.waitForSelector = {
      selector,
      timeout: timeoutMs,
    };
  }

  if (userAgent) {
    payload.userAgent = userAgent;
  }

  return payload;
}

function normalizeMarkdownResult(payload) {
  if (typeof payload === "string") {
    return {
      markdown: payload,
      metadata: {},
    };
  }

  const result = payload?.result ?? payload;

  if (typeof result === "string") {
    return {
      markdown: result,
      metadata: {},
    };
  }

  return {
    markdown: String(result?.markdown || result?.content || result?.text || ""),
    metadata:
      result && typeof result === "object"
        ? Object.fromEntries(
            Object.entries(result).filter(
              ([key]) => !["markdown", "content", "text"].includes(key)
            )
          )
        : {},
  };
}

async function handleMarkdown(request, params, requestId) {
  const targetUrl = normalizeTargetUrl(params.url);
  const requestToken = getRequestToken(request, params.token);
  const startedAt = Date.now();

  ensureAuthConfigured();
  await enforceRateLimit(request, getRateLimitToken(requestToken));

  if (!verifyToken(requestToken)) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      category: "auth",
      message: "Invalid or missing authentication token",
    });
  }

  const { accountId, apiToken } = getBrowserRenderingConfig();
  await verifySafeRedirectChain(targetUrl);

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/markdown`;
  const upstreamResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildMarkdownPayload(targetUrl, params)),
  });
  const browserMsUsed = upstreamResponse.headers.get("X-Browser-Ms-Used");
  const responseText = await upstreamResponse.text();
  let upstreamPayload = responseText;

  try {
    upstreamPayload = JSON.parse(responseText);
  } catch (_) {
    upstreamPayload = responseText;
  }

  if (!upstreamResponse.ok || upstreamPayload?.success === false) {
    const errors = Array.isArray(upstreamPayload?.errors)
      ? upstreamPayload.errors
      : [];
    const message =
      errors[0]?.message ||
      (typeof upstreamPayload === "string" && upstreamPayload) ||
      `Cloudflare Browser Rendering request failed (${upstreamResponse.status})`;

    throw new ApiError({
      status: upstreamResponse.status === 401 ? 502 : upstreamResponse.status,
      code: "BROWSER_RENDERING_ERROR",
      category: "upstream",
      message,
      details: {
        upstream_status: upstreamResponse.status,
        errors,
      },
    });
  }

  const result = normalizeMarkdownResult(upstreamPayload);

  return jsonResponse(
    request,
    {
      url: targetUrl,
      source: "cloudflare-browser-rendering",
      markdown: result.markdown,
      metadata: result.metadata,
      browser_ms_used: browserMsUsed ? Number.parseInt(browserMsUsed, 10) : null,
      duration_ms: Date.now() - startedAt,
    },
    200,
    {
      "X-Search-Request-Id": requestId,
      ...(browserMsUsed ? { "X-Browser-Ms-Used": browserMsUsed } : {}),
    }
  );
}

async function handleHtml(request, params, requestId) {
  const targetUrl = normalizeTargetUrl(params.url);
  const requestToken = getRequestToken(request, params.token);
  const startedAt = Date.now();
  const maxBytes = normalizePositiveInteger(params.max_bytes || params.maxBytes, 1_500_000, {
    min: 50_000,
    max: 5_000_000,
  });

  ensureAuthConfigured();
  await enforceRateLimit(request, getRateLimitToken(requestToken));

  if (!verifyToken(requestToken)) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      category: "auth",
      message: "Invalid or missing authentication token",
    });
  }

  const upstreamResponse = await fetchWithSafeRedirects(targetUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": TARGET_FETCH_USER_AGENT,
    },
  });
  const contentType = upstreamResponse.headers.get("content-type") || "";

  if (!upstreamResponse.ok) {
    throw new ApiError({
      status: upstreamResponse.status >= 500 ? 502 : upstreamResponse.status,
      code: "UPSTREAM_HTTP_ERROR",
      category: "upstream",
      message: `Upstream returned HTTP ${upstreamResponse.status}`,
      details: {
        upstream_status: upstreamResponse.status,
      },
    });
  }

  if (
    contentType &&
    !/text\/html|application\/xhtml\+xml|application\/xml|text\/xml/i.test(contentType)
  ) {
    throw new ApiError({
      status: 415,
      code: "UNSUPPORTED_CONTENT_TYPE",
      category: "upstream",
      message: `Unsupported content type: ${contentType}`,
    });
  }

  const html = await readResponseTextWithLimit(upstreamResponse, maxBytes);
  const payload = await extractPageContent(html, upstreamResponse.url || targetUrl);

  return jsonResponse(
    request,
    {
      ...payload,
      requested_url: targetUrl,
      content_type: contentType || null,
      max_bytes: maxBytes,
      duration_ms: Date.now() - startedAt,
    },
    200,
    {
      "X-Search-Request-Id": requestId,
      "X-Search-Duration-Ms": String(Date.now() - startedAt),
    }
  );
}

function createErrorResponse(request, requestId, error) {
  const normalized = normalizeError(error);
  const status = normalized.status || 500;
  const headers = {
    "X-Search-Request-Id": requestId,
  };

  if (normalized.details?.retry_after) {
    headers["Retry-After"] = String(normalized.details.retry_after);
  }

  return jsonResponse(request, toErrorPayload(normalized), status, headers);
}

async function handleRequest(request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...buildCorsHeaders(request),
        "X-Search-Request-Id": requestId,
      },
    });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return createErrorResponse(
      request,
      requestId,
      new ApiError({
        status: 405,
        code: "METHOD_NOT_ALLOWED",
        category: "request",
        message: "Method Not Allowed",
      })
    );
  }

  if (url.pathname === "/") {
    return new Response(getSearchHtml(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...buildCorsHeaders(request),
        "X-Search-Request-Id": requestId,
      },
    });
  }

  if (url.pathname === "/auth/verify") {
    try {
      const params = await parseRequestParams(request, url);
      return await handleAuthVerify(request, params, requestId);
    } catch (error) {
      const normalized = normalizeError(error);
      console.error(
        "[handleAuthVerify] Error:",
        normalized.code,
        normalized.message
      );
      return createErrorResponse(request, requestId, normalized);
    }
  }

  if (url.pathname === "/geo") {
    return jsonResponse(
      request,
      {
        geo: getClientGeoPayload(request),
      },
      200,
      {
        "X-Search-Request-Id": requestId,
      }
    );
  }

  if (url.pathname === "/markdown") {
    try {
      const params = await parseRequestParams(request, url);
      return await handleMarkdown(request, params, requestId);
    } catch (error) {
      const normalized = normalizeError(error);
      console.error("[handleMarkdown] Error:", normalized.code, normalized.message);
      return createErrorResponse(request, requestId, normalized);
    }
  }

  if (url.pathname === "/content" || url.pathname === "/html") {
    try {
      const params = await parseRequestParams(request, url);
      return await handleHtml(request, params, requestId);
    } catch (error) {
      const normalized = normalizeError(error);
      console.error("[handleHtml] Error:", normalized.code, normalized.message);
      return createErrorResponse(request, requestId, normalized);
    }
  }

  if (url.pathname !== "/search") {
    return createErrorResponse(
      request,
      requestId,
      new ApiError({
        status: 404,
        code: "NOT_FOUND",
        category: "request",
        message: "Not Found",
      })
    );
  }

  try {
    const params = await parseRequestParams(request, url);
    return await handleSearch(request, params, requestId);
  } catch (error) {
    const normalized = normalizeError(error);
    console.error("[handleRequest] Error:", normalized.code, normalized.message);
    return createErrorResponse(request, requestId, normalized);
  }
}

export default {
  async fetch(request, env_param) {
    setEnv(env_param);
    return handleRequest(request);
  },
};
