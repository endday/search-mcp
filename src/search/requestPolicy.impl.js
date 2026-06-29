import { env } from "../../envs.js";

const upstreamThrottleState = new Map();

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export function resetUpstreamRequestPolicyState() {
  upstreamThrottleState.clear();
}

export function getEngineTier(adapter) {
  return String(adapter?.tier || "secondary").toLowerCase();
}

export function buildEnginePolicy(adapter = {}) {
  const tier = getEngineTier(adapter);
  const policy = adapter.requestPolicy || {};
  const retryAttempts =
    policy.retryAttempts ??
    parseNonNegativeInt(
      env[`UPSTREAM_${tier.toUpperCase()}_RETRY_ATTEMPTS`],
      parseNonNegativeInt(env.UPSTREAM_RETRY_ATTEMPTS, 1)
    );
  const retryDelayMs =
    policy.retryDelayMs ??
    parseNonNegativeInt(env.UPSTREAM_RETRY_DELAY_MS, 200);
  const minRequestIntervalMs =
    policy.minRequestIntervalMs ??
    parseNonNegativeInt(
      env[`UPSTREAM_${tier.toUpperCase()}_MIN_REQUEST_INTERVAL_MS`],
      parseNonNegativeInt(env.UPSTREAM_MIN_REQUEST_INTERVAL_MS, 150)
    );

  return {
    tier,
    retryAttempts,
    retryDelayMs,
    minRequestIntervalMs,
  };
}

export function groupEnginesByTier(engineNames, registry) {
  const groups = new Map();

  for (const engineName of engineNames) {
    const adapter = registry[engineName];
    const tier = getEngineTier(adapter);
    if (!groups.has(tier)) {
      groups.set(tier, []);
    }

    groups.get(tier).push(engineName);
  }

  return groups;
}

export function getTierExecutionOrder(groups) {
  const primaryTiers = new Set(
    (env.SEARCH_PRIMARY_TIERS || []).map((item) => String(item).toLowerCase())
  );
  const secondaryTiers = new Set(
    (env.SEARCH_SECONDARY_TIERS || []).map((item) => String(item).toLowerCase())
  );
  const experimentalTiers = new Set(
    (env.SEARCH_EXPERIMENTAL_TIERS || []).map((item) => String(item).toLowerCase())
  );
  const known = [];

  for (const tier of [...groups.keys()]) {
    if (primaryTiers.has(tier) || secondaryTiers.has(tier) || experimentalTiers.has(tier)) {
      continue;
    }

    known.push(tier);
  }

  return [
    ...[...primaryTiers].filter((tier) => groups.has(tier)),
    ...[...secondaryTiers].filter((tier) => groups.has(tier)),
    ...[...experimentalTiers].filter((tier) => groups.has(tier)),
    ...known.sort(),
  ];
}

export async function enforceEngineThrottle(engineName, policy) {
  const minInterval = parseNonNegativeInt(policy?.minRequestIntervalMs, 0);
  if (minInterval <= 0) {
    return;
  }

  const now = Date.now();
  const key = String(engineName);
  const nextAllowedAt = upstreamThrottleState.get(key) || 0;
  const delay = nextAllowedAt - now;

  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  upstreamThrottleState.set(key, Date.now() + minInterval);
}

export function shouldRetryUpstream(error, attempt, policy) {
  if (attempt >= parseNonNegativeInt(policy?.retryAttempts, 0)) {
    return false;
  }

  const status = error?.status || error?.details?.upstream_status || 0;
  const code = String(error?.code || "");

  if (code === "UPSTREAM_BLOCKED") {
    return false;
  }

  if (code === "ABORT_ERR" || code === "TIMEOUT") {
    return true;
  }

  return status === 408 || status === 429 || status >= 500 || status === 0;
}

export async function sleepBeforeRetry(policy) {
  const delay = parseNonNegativeInt(policy?.retryDelayMs, 0);
  if (delay <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delay));
}
