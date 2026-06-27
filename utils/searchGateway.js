import { env } from "../envs.js";
import { getCachedSearchResponse, setCachedSearchResponse } from "./cache.js";
import { ApiError, normalizeError } from "./errors.js";
import { getEngineRegistry, resolveEngineSelection } from "./engineRegistry.js";
import {
  recordEngineFailure,
  recordEngineSuccess,
} from "./health.js";
import { dedupeAndRankResults, canonicalizeUrl } from "./index.js";

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
  { time_range, pageno }
) {
  const page = parseNonNegativeInt(pageno, 0);
  const enabledEngines = [];
  const skippedEngines = [];

  for (const engineName of engineNames) {
    const supports = registry[engineName]?.supports || {};

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

  const promise = adapter
    .search({
      ...params,
      signal: controller.signal,
    })
    .then((results) => ({
      engine: adapter.name,
      results,
      duration_ms: Date.now() - startedAt,
    }))
    .catch((error) => ({
      engine: adapter.name,
      error: normalizeError(error, { engine: adapter.name }),
      duration_ms: Date.now() - startedAt,
    }))
    .finally(() => clearTimeout(timeoutId));

  return {
    engine: adapter.name,
    promise,
    abort: () => controller.abort(),
  };
}

function buildSearchResponse({
  query,
  enabledEngines,
  skippedEngines,
  unresponsiveEngines,
  results,
}) {
  return {
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
  fallbackOrder,
  fallbackPath,
  engineTimings,
}) {
  return {
    cache_status: cacheStatus,
    fallback_order: fallbackOrder,
    fallback_path: fallbackPath,
    engine_timings: engineTimings,
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
  query,
  language,
  time_range,
  pageno,
}) {
  const minResults = Math.max(
    1,
    Number.parseInt(env.FALLBACK_MIN_RESULTS || "6", 10)
  );
  const minContributingEngines = Math.min(
    engines.length,
    parsePositiveInt(env.FALLBACK_MIN_CONTRIBUTING_ENGINES, 2)
  );

  // Start every requested engine in parallel — no priority, no hedging.
  const activeSearches = new Map();
  for (const engineName of engines) {
    activeSearches.set(
      engineName,
      startEngineSearch(registry[engineName], {
        query,
        language,
        time_range,
        pageno,
      })
    );
  }

  const engineResults = [];
  const unresponsiveEngines = [];
  const engineTimings = [];
  // Every requested engine was started, so the "path" is the full set.
  const fallbackPath = [...engines];
  const canonicalUrls = new Set();

  const hasEnoughResults = () =>
    canonicalUrls.size >= minResults &&
    engineResults.length >= minContributingEngines;

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
    });

    if (outcome.error) {
      console.warn(`[${outcome.engine}] ${outcome.error.code}: ${outcome.error.message}`);
      await recordEngineFailure(outcome.engine);
      unresponsiveEngines.push(outcome.engine);
    } else {
      await recordEngineSuccess(outcome.engine);

      if (outcome.results.length > 0) {
        engineResults.push({
          engine: outcome.engine,
          results: outcome.results,
        });
        // Track canonical URLs for early-stop check
        for (const result of outcome.results) {
          canonicalUrls.add(canonicalizeUrl(result.url || result.link || result.href || ""));
        }
      }
    }
  }

  if (hasEnoughResults()) {
    abortActiveSearches(activeSearches);
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
  query,
  engines,
  language,
  time_range,
  pageno,
}) {
  const registry = getEngineRegistry();
  const engineSelection = resolveEngineSelection(engines);
  const capabilitySelection = filterEnginesByCapabilities(
    engineSelection.enabledEngines,
    registry,
    {
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
        fallbackOrder: enabledEngines,
        fallbackPath: [],
        engineTimings: [],
      }),
    };
  }

  const fallbackOrder = enabledEngines;
  const searchOutcome = await runParallelSearch({
    registry,
    engines: fallbackOrder,
    query,
    language,
    time_range,
    pageno,
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
        fallbackOrder,
        fallbackPath: searchOutcome.meta.fallbackPath,
        engineTimings: searchOutcome.meta.engineTimings,
      }),
    };
  }

  const response = buildSearchResponse({
    query,
    enabledEngines,
    skippedEngines,
    unresponsiveEngines: searchOutcome.unresponsiveEngines,
    results: searchOutcome.results,
  });

  await setCachedSearchResponse(cacheParams, response);
  return {
    response,
    meta: buildSearchMeta({
      cacheStatus: cachedResponse?.state === "stale" ? "revalidated" : "miss",
      fallbackOrder,
      fallbackPath: searchOutcome.meta.fallbackPath,
      engineTimings: searchOutcome.meta.engineTimings,
    }),
  };
}

export async function searchAll(params) {
  const { response } = await searchAllWithMeta(params);
  return response;
}
