import { env } from "../../envs.js";
import { sha256Hex } from "../core/crypto.js";
import { logWarn } from "./logger.js";

const CACHE_PREFIX = "search:v3";
const EDGE_CACHE_NAMESPACE = "search-edge:v1";

function isKvAvailable() {
  return !!env.SEARCH_KV && typeof env.SEARCH_KV.get === "function";
}

function isEdgeCacheAvailable() {
  return typeof caches !== "undefined" && !!caches.default;
}

async function getCacheKey({
  query,
  requested_engines,
  engines,
  language,
  time_range,
  pageno,
}) {
  const payload = JSON.stringify({
    query,
    requested_engines,
    engines,
    language,
    time_range,
    pageno,
  });
  const hash = await sha256Hex(payload);
  return `${CACHE_PREFIX}:${hash}`;
}

async function getEdgeCacheKey(searchParams) {
  const key = await getCacheKey(searchParams);
  return `${EDGE_CACHE_NAMESPACE}:${key}`;
}

async function getCachedSearchResponseFromEdge(searchParams) {
  const ttl = Number.parseInt(env.EDGE_CACHE_TTL_SECONDS || "0", 10);
  if (!isEdgeCacheAvailable() || ttl <= 0) {
    return null;
  }

  try {
    const cacheKey = await getEdgeCacheKey(searchParams);
    const response = await caches.default.match(`https://cache.internal/${cacheKey}`);
    if (!response) {
      return null;
    }

    const payload = await response.json();
    if (!payload?.response) {
      return null;
    }

    return {
      response: payload.response,
      state: "hit",
      layer: "edge",
    };
  } catch (error) {
    logWarn("cache.edge_read_failed", {}, error);
    return null;
  }
}

async function setCachedSearchResponseToEdge(searchParams, response) {
  const ttl = Number.parseInt(env.EDGE_CACHE_TTL_SECONDS || "0", 10);
  if (!isEdgeCacheAvailable() || ttl <= 0) {
    return;
  }

  try {
    const cacheKey = await getEdgeCacheKey(searchParams);
    const request = new Request(`https://cache.internal/${cacheKey}`);
    const payload = new Response(
      JSON.stringify({
        response,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `max-age=${ttl}`,
        },
      }
    );
    await caches.default.put(request, payload);
  } catch (error) {
    logWarn("cache.edge_write_failed", {}, error);
  }
}

export async function getCachedSearchResponse(searchParams) {
  const edgeEntry = await getCachedSearchResponseFromEdge(searchParams);
  if (edgeEntry) {
    return edgeEntry;
  }

  const ttl = Number.parseInt(env.CACHE_TTL_SECONDS || "0", 10);
  if (!isKvAvailable() || ttl <= 0) {
    return null;
  }

  const key = await getCacheKey(searchParams);
  const entry = await env.SEARCH_KV.get(key, "json");
  if (!entry?.response) {
    return null;
  }

  const now = Date.now();
  if (entry.freshUntil > now) {
    return {
      response: entry.response,
      state: "hit",
      layer: "kv",
    };
  }

  if (entry.staleUntil > now) {
    return {
      response: entry.response,
      state: "stale",
      layer: "kv",
    };
  }

  return null;
}

export async function setCachedSearchResponse(searchParams, response) {
  await setCachedSearchResponseToEdge(searchParams, response);

  const ttl = Number.parseInt(env.CACHE_TTL_SECONDS || "0", 10);
  if (!isKvAvailable() || ttl <= 0) {
    return;
  }

  const staleTtl = Math.max(
    0,
    Number.parseInt(env.STALE_CACHE_TTL_SECONDS || "0", 10)
  );
  const now = Date.now();
  const freshUntil = now + ttl * 1000;
  const staleUntil = freshUntil + staleTtl * 1000;
  const key = await getCacheKey(searchParams);
  await env.SEARCH_KV.put(
    key,
    JSON.stringify({
      response,
      freshUntil,
      staleUntil,
    }),
    {
      expirationTtl: ttl + staleTtl,
    }
  );
}

export function createDeferredCachedSearchResponseWriter(searchParams, response) {
  return async function writeCachedSearchResponse() {
    await setCachedSearchResponse(searchParams, response);
  };
}
