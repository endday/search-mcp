import { ApiError } from "../core/errors.js";
import { extractPageContent } from "./extract.js";
import { getRandomBrowserProfile } from "../search/engineUtils.js";
import { normalizePositiveInteger } from "../routes/requestParams.js";
import { fetchWithOptionalCurlImpersonate } from "../platform/nodeHttpClient.js";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_SAFE_REDIRECTS = 5;

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
  const leftParts = compressionParts[0] ? compressionParts[0].split(":") : [];
  const rightParts =
    hasCompression && compressionParts[1] ? compressionParts[1].split(":") : [];
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

function buildNavigationHeaders(profile) {
  const headers = {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": profile.ua,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };

  if (profile.headers?.["sec-ch-ua"]) {
    headers["Sec-Ch-Ua"] = profile.headers["sec-ch-ua"];
    headers["Sec-Ch-Ua-Platform"] = profile.headers["sec-ch-ua-platform"];
    headers["Sec-Ch-Ua-Mobile"] = profile.headers["sec-ch-ua-mobile"];
  }

  return headers;
}

export function normalizeTargetUrl(value) {
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
    // best effort
  }
}

async function fetchWithSafeRedirects(targetUrl, init = {}) {
  let currentUrl = normalizeTargetUrl(targetUrl);

  for (let redirectCount = 0; redirectCount <= MAX_SAFE_REDIRECTS; redirectCount += 1) {
    const response = await fetchWithOptionalCurlImpersonate(currentUrl, {
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

export async function verifySafeRedirectChain(targetUrl) {
  const profile = getRandomBrowserProfile("default");
  const response = await fetchWithSafeRedirects(targetUrl, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Range: "bytes=0-0",
      "User-Agent": profile.ua,
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

export function normalizeContentMaxBytes(params) {
  return normalizePositiveInteger(params.max_bytes || params.maxBytes, 1_500_000, {
    min: 50_000,
    max: 5_000_000,
  });
}

export async function fetchReadableContent(targetUrl, maxBytes) {
  const normalizedTargetUrl = normalizeTargetUrl(targetUrl);
  const profile = getRandomBrowserProfile("default");
  const contentHeaders = buildNavigationHeaders(profile);
  const upstreamResponse = await fetchWithSafeRedirects(normalizedTargetUrl, {
    headers: contentHeaders,
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

  const payload = await extractPageContent(
    html,
    upstreamResponse.url || normalizedTargetUrl
  );

  return {
    ...payload,
    requested_url: normalizedTargetUrl,
    content_type: contentType || null,
    max_bytes: maxBytes,
  };
}
