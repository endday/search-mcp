import { env } from "../../envs.js";
import { normalizeError, toErrorPayload } from "../core/errors.js";

const ALLOWED_METHODS = "GET, POST, OPTIONS";

function buildServerTimingHeader(engineTimings) {
  return engineTimings
    .map((timing) => `${timing.engine};dur=${timing.duration_ms}`)
    .join(", ");
}

function buildTierSummary(engineTimings) {
  const tiers = new Set();
  for (const timing of engineTimings) {
    if (timing?.tier) {
      tiers.add(String(timing.tier));
    }
  }

  return [...tiers].join(",");
}

export function buildCorsHeaders(request) {
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

export function jsonResponse(request, payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(request),
      ...headers,
    },
  });
}

export function getRequestId(request) {
  return request.headers.get("cf-ray") || crypto.randomUUID();
}

export function buildSearchResponseHeaders({ requestId, durationMs, meta }) {
  const headers = {
    "X-Search-Request-Id": requestId,
    "X-Search-Duration-Ms": String(durationMs),
    "X-Search-Cache": meta.cache_status,
    "X-Search-Cache-Layer": meta.cache_layer || "none",
    "X-Search-Fallback-Path": meta.fallback_path.join(","),
    "X-Search-Strategy": meta.strategy || "tiered",
  };

  if (meta.fallback_order.length > 0) {
    headers["X-Search-Fallback-Order"] = meta.fallback_order.join(",");
  }

  if (meta.engine_timings.length > 0) {
    headers["Server-Timing"] = buildServerTimingHeader(meta.engine_timings);
    const tierSummary = buildTierSummary(meta.engine_timings);
    if (tierSummary) {
      headers["X-Search-Upstream-Tiers"] = tierSummary;
    }
  }

  return headers;
}

export function createOptionsResponse(request, requestId) {
  return new Response(null, {
    status: 204,
    headers: {
      ...buildCorsHeaders(request),
      "X-Search-Request-Id": requestId,
    },
  });
}

export function createErrorResponse(request, requestId, error) {
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
