import { env } from "../../envs.js";
import { getCachedSearchResponse } from "../platform/cache.js";
import { ApiError, normalizeError } from "../core/errors.js";
import { getEngineRegistry, resolveEngineSelection } from "./engineRegistry.js";
import {
  createDeferredEngineFailureRecorder,
  createDeferredEngineSuccessRecorder,
  recordEngineFailure,
  recordEngineSuccess,
} from "../platform/health.js";
import { dedupeAndRankResults, canonicalizeUrl } from "./ranking.js";
import {
  buildEnginePolicy,
  getTierExecutionOrder,
  groupEnginesByTier,
} from "./requestPolicy.js";
import { createDeferredCachedSearchResponseWriter } from "../platform/cache.js";
import { runDeferredTask } from "../platform/tasks.js";
import { logWarn } from "../platform/logger.js";
import { recordMetric, recordTiming } from "../platform/metrics.js";

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function filterEnginesByCapabilities(
  engineNames,
  registry,
  { vertical = "web", time_range, pageno }
) {
  const page = parseNonNegativeInt(pageno, 0);
  const enabledEngines = [];
  const skippedEngines = [];

  for (const engineName of engineNames) {
    const adapter = registry[engineName];
    const baseSupports = adapter?.supports || {};
    const supports =
      typeof baseSupports[vertical] === "object"
        ? { ...baseSupports, ...baseSupports[vertical] }
        : baseSupports;

    if (time_range && supports.time_range === false) {
      skippedEngines.push({
        engine: engineName,
        reason: "unsupported_time_range",
      });
      continue;
    }

    if (page > 0 && supports.pageno === false) {
      skippedEngines.push({
        engine: engineName,
        reason: "unsupported_pageno",
      });
      continue;
    }

    enabledEngines.push(engineName);
  }

  return {
    enabledEngines,
    skippedEngines,
  };
}

function startEngineSearch(adapter, params) {
  const timeoutMs = Number.parseInt(env.DEFAULT_TIMEOUT || "4000", 10);
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const policy = buildEnginePolicy(adapter);

  const promise = adapter
    .search({
      ...params,
      signal: controller.signal,
      requestPolicy: policy,
    })
    .then((results) => ({
      engine: adapter.name,
      results,
      duration_ms: Date.now() - startedAt,
      tier: policy.tier,
    }))
    .catch((error) => ({
      engine: adapter.name,
      error: normalizeError(error, { engine: adapter.name }),
      duration_ms: Date.now() - startedAt,
      tier: policy.tier,
    }))
    .finally(() => clearTimeout(timeoutId));

  return {
    engine: adapter.name,
    promise,
    abort: () => controller.abort(),
  };
}

function buildSearchResponse({
  vertical = "web",
  query,
  enabledEngines,
  skippedEngines,
  unresponsiveEngines,
  results,
}) {
  return {
    vertical,
    query,
    number_of_results: results.length,
    enabled_engines: enabledEngines,
    skipped_engines: skippedEngines,
    unresponsive_engines: [...new Set(unresponsiveEngines)],
    results,
  };
}

function buildSearchMeta({
  cacheStatus,
  cacheLayer = "none",
  fallbackOrder,
  fallbackPath,
  engineTimings,
  strategy = "tiered",
}) {
  return {
    cache_status: cacheStatus,
    cache_layer: cacheLayer,
    fallback_order: fallbackOrder,
    fallback_path: fallbackPath,
    engine_timings: engineTimings,
    strategy,
  };
}

function abortActiveSearches(activeSearches) {
  for (const task of activeSearches.values()) {
    task.abort();
  }
}

async function runParallelSearch({
  registry,
  engines,
  vertical,
  query,
  language,
  time_range,
  pageno,
  clientId,
  runtimeContext,
}) {
  const minResults = Math.max(
    1,
    Number.parseInt(env.FALLBACK_MIN_RESULTS || "6", 10)
  );
  const minContributingEngines = Math.min(
    engines.length,
    parsePositiveInt(env.FALLBACK_MIN_CONTRIBUTING_ENGINES, 2)
  );
  const engineResults = [];
  const unresponsiveEngines = [];
  const engineTimings = [];
  const fallbackPath = [];
  const canonicalUrls = new Set();
  const tierGroups = groupEnginesByTier(engines, registry);
  const tierOrder = getTierExecutionOrder(tierGroups);

  const hasEnoughResults = () =>
    canonicalUrls.size >= minResults &&
    engineResults.length >= minContributingEngines;

  for (const tier of tierOrder) {
    if (hasEnoughResults()) {
      break;
    }

    const tierEngines = tierGroups.get(tier) || [];
    if (tierEngines.length === 0) {
      continue;
    }

    fallbackPath.push(...tierEngines);
    const activeSearches = new Map();
    for (const engineName of tierEngines) {
      activeSearches.set(
        engineName,
        startEngineSearch(registry[engineName], {
          vertical,
          query,
          language,
          time_range,
          pageno,
          clientId,
          runtimeContext,
        })
      );
    }

    while (activeSearches.size > 0 && !hasEnoughResults()) {
      const completionPromises = [...activeSearches.values()].map((task) =>
        task.promise
      );
      const outcome = await Promise.race(completionPromises);

      activeSearches.delete(outcome.engine);
      engineTimings.push({
        engine: outcome.engine,
        duration_ms: outcome.duration_ms,
        status: outcome.error ? outcome.error.code : "ok",
        result_count: outcome.results?.length || 0,
        tier: outcome.tier,
      });

      if (outcome.error) {
        logWarn("search.engine_failed", {
          engine: outcome.engine,
          tier: outcome.tier,
          code: outcome.error.code,
          duration_ms: outcome.duration_ms,
        }, undefined, runtimeContext);
        await runDeferredTask(
          runtimeContext,
          `health-failure:${outcome.engine}`,
          createDeferredEngineFailureRecorder(outcome.engine)
        );
        unresponsiveEngines.push(outcome.engine);
      } else {
        await runDeferredTask(
          runtimeContext,
          `health-success:${outcome.engine}`,
          createDeferredEngineSuccessRecorder(outcome.engine)
        );

        if (outcome.results.length > 0) {
          engineResults.push({
            engine: outcome.engine,
            results: outcome.results,
          });
          for (const result of outcome.results) {
            canonicalUrls.add(canonicalizeUrl(result.url || result.link || result.href || ""));
          }
        }
      }

    }

    if (activeSearches.size > 0) {
      abortActiveSearches(activeSearches);
    }

    if (hasEnoughResults()) {
      break;
    }
  }

  // Dedupe and rank once, after all collected results
  const aggregatedResults = dedupeAndRankResults({
    engineResults,
    query,
    registry,
  });

  return {
    results: aggregatedResults,
    unresponsiveEngines,
    meta: {
      fallbackPath,
      engineTimings,
    },
  };
}

export async function searchAllWithMeta({
  vertical = "web",
  query,
  engines,
  language,
  time_range,
  pageno,
  clientId,
  runtimeContext,
}) {
  const registry = getEngineRegistry();
  const engineSelection = resolveEngineSelection(engines, { vertical });
  const capabilitySelection = filterEnginesByCapabilities(
    engineSelection.enabledEngines,
    registry,
    {
      vertical,
      time_range,
      pageno,
    }
  );
  const enabledEngines = capabilitySelection.enabledEngines;
  const skippedEngines = [
    ...engineSelection.skippedEngines,
    ...capabilitySelection.skippedEngines,
  ];

  if (enabledEngines.length === 0) {
    throw new ApiError({
      status: 400,
      code: "NO_ENGINES_AVAILABLE",
      category: "validation",
      message: "No requested search engines are available for these parameters",
    });
  }

  const cacheParams = {
    vertical,
    query,
    requested_engines: engineSelection.requestedEngines,
    engines: enabledEngines,
    language,
    time_range,
    pageno,
  };
  const cachedResponse = await getCachedSearchResponse(cacheParams);
  if (cachedResponse?.state === "hit") {
    return {
      response: cachedResponse.response,
      meta: buildSearchMeta({
        cacheStatus: "hit",
        cacheLayer: cachedResponse.layer || "unknown",
        fallbackOrder: enabledEngines,
        fallbackPath: [],
        engineTimings: [],
        strategy: "cache-hit",
      }),
    };
  }

  const fallbackOrder = enabledEngines;
  const searchOutcome = await runParallelSearch({
    registry,
    engines: fallbackOrder,
    vertical,
    query,
    language,
    time_range,
    pageno,
    clientId,
    runtimeContext,
  });

  if (
    searchOutcome.results.length === 0 &&
    searchOutcome.unresponsiveEngines.length > 0 &&
    cachedResponse?.state === "stale"
  ) {
    return {
      response: cachedResponse.response,
      meta: buildSearchMeta({
        cacheStatus: "stale-if-error",
        cacheLayer: cachedResponse.layer || "kv",
        fallbackOrder,
        fallbackPath: searchOutcome.meta.fallbackPath,
        engineTimings: searchOutcome.meta.engineTimings,
        strategy: "tiered",
      }),
    };
  }

  const response = buildSearchResponse({
    vertical,
    query,
    enabledEngines,
    skippedEngines,
    unresponsiveEngines: searchOutcome.unresponsiveEngines,
    results: searchOutcome.results,
  });

  await runDeferredTask(
    runtimeContext,
    "search-cache-write",
    createDeferredCachedSearchResponseWriter(cacheParams, response)
  );
  recordMetric(runtimeContext, "search.cache_write_scheduled", {
    cache_layer: "edge+kv",
  });
  for (const timing of searchOutcome.meta.engineTimings) {
    recordTiming(runtimeContext, "search.engine", timing.duration_ms, {
      engine: timing.engine,
      tier: timing.tier,
      status: timing.status,
      result_count: timing.result_count,
    });
  }
  return {
    response,
    meta: buildSearchMeta({
      cacheStatus: cachedResponse?.state === "stale" ? "revalidated" : "miss",
      cacheLayer: cachedResponse?.layer || "none",
      fallbackOrder,
      fallbackPath: searchOutcome.meta.fallbackPath,
      engineTimings: searchOutcome.meta.engineTimings,
      strategy: "tiered",
    }),
  };
}

export async function searchAll(params) {
  const { response } = await searchAllWithMeta(params);
  return response;
}
