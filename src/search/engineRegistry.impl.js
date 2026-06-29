import { env } from "../../envs.js";
import { bingAdapter } from "./engines/bing.js";
import { braveAdapter } from "./engines/brave.js";
import { duckDuckGoAdapter } from "./engines/duckduckgo.js";
import { mojeekAdapter } from "./engines/mojeek.js";
import { qwantAdapter } from "./engines/qwant.js";
import { startpageAdapter } from "./engines/startpage.js";
import { toutiaoAdapter } from "./engines/toutiao.js";
import { yahooAdapter } from "./engines/yahoo.js";

const ENGINE_REGISTRY = {
  bing: bingAdapter,
  toutiao: toutiaoAdapter,
  startpage: startpageAdapter,
  mojeek: mojeekAdapter,
  duckduckgo: duckDuckGoAdapter,
  brave: braveAdapter,
  qwant: qwantAdapter,
  yahoo: yahooAdapter,
};

export function getEngineRegistry() {
  return ENGINE_REGISTRY;
}

function normalizeEngineList(engines) {
  if (!engines) {
    return [];
  }

  if (Array.isArray(engines)) {
    return engines;
  }

  return String(engines).split(",");
}

export function normalizeRequestedEngines(engines) {
  return normalizeEngineList(engines)
    .map((engine) => String(engine).trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve the engines the caller explicitly requested.
 * Language-specific defaults are resolved before this layer, so this function
 * only filters and normalizes the concrete engine list it receives.
 * `env.SUPPORTED_ENGINES` is still used to filter out engines the deployment
 * does not recognize.
 */
export function resolveEngineSelection(engines) {
  const requestedEngines = normalizeRequestedEngines(engines);
  const supportedEngines = new Set(env.SUPPORTED_ENGINES);
  const seen = new Set();
  const enabledEngines = [];
  const skippedEngines = [];

  for (const engine of requestedEngines) {
    if (seen.has(engine)) {
      continue;
    }

    seen.add(engine);

    const adapter = ENGINE_REGISTRY[engine];
    if (!adapter || !supportedEngines.has(engine)) {
      skippedEngines.push({
        engine,
        reason: "unsupported_engine",
      });
      continue;
    }

    if (adapter.isAvailable && !adapter.isAvailable()) {
      skippedEngines.push({
        engine,
        reason: "unavailable_engine",
      });
      continue;
    }

    enabledEngines.push(engine);
  }

  return {
    requestedEngines,
    enabledEngines,
    skippedEngines,
  };
}

export function resolveEngineOrder(engines) {
  return resolveEngineSelection(engines).enabledEngines;
}
