const createDefaultEnv = () => ({
  DEFAULT_TIMEOUT: "4000",
  SUPPORTED_ENGINES: [
    "startpage",
    "duckduckgo",
    "brave",
    "qwant",
    "yahoo",
    "mojeek",
    "bing",
    "toutiao",
  ],
  DEFAULT_ENGINES: ["startpage", "bing", "duckduckgo", "brave", "mojeek"],
  DEFAULT_ENGINES_ZH: ["bing"],
  DEFAULT_ENGINES_NON_ZH: ["bing", "yahoo", "mojeek"],
  DEFAULT_LANGUAGE: "en",
  FALLBACK_MIN_RESULTS: "6",
  FALLBACK_MIN_CONTRIBUTING_ENGINES: "2",
  SEARCH_PRIMARY_TIERS: ["primary"],
  SEARCH_SECONDARY_TIERS: ["secondary"],
  SEARCH_EXPERIMENTAL_TIERS: ["experimental"],
  SEARCH_TIER_HEDGE_DELAY_MS: "250",
  EDGE_CACHE_TTL_SECONDS: "30",
  CACHE_TTL_SECONDS: "300",
  STALE_CACHE_TTL_SECONDS: "1800",
  RATE_LIMIT_WINDOW_SECONDS: "60",
  RATE_LIMIT_MAX_REQUESTS: "60",
  UPSTREAM_RETRY_ATTEMPTS: "1",
  UPSTREAM_RETRY_DELAY_MS: "200",
  UPSTREAM_PRIMARY_RETRY_ATTEMPTS: "1",
  UPSTREAM_SECONDARY_RETRY_ATTEMPTS: "0",
  UPSTREAM_EXPERIMENTAL_RETRY_ATTEMPTS: "0",
  UPSTREAM_SESSION_TTL_SECONDS: "3600",
  UPSTREAM_MIN_REQUEST_INTERVAL_MS: "150",
  UPSTREAM_PRIMARY_MIN_REQUEST_INTERVAL_MS: "100",
  UPSTREAM_SECONDARY_MIN_REQUEST_INTERVAL_MS: "250",
  UPSTREAM_EXPERIMENTAL_MIN_REQUEST_INTERVAL_MS: "500",
  HEALTH_FAILURE_THRESHOLD: "2",
  HEALTH_COOLDOWN_SECONDS: "180",
  HEALTH_STATE_TTL_SECONDS: "3600",
  CORS_ALLOWED_ORIGINS: ["*"],
  CORS_ALLOWED_HEADERS: ["Authorization", "Content-Type", "x-api-key"],
  AUTH_REQUIRED: "false",
  TOKEN: null,
  CF_BROWSER_RENDERING_ACCOUNT_ID: null,
  CF_BROWSER_RENDERING_API_TOKEN: null,
  SEARCH_KV: null,
  SEARCH_STATE_KV: null,
});

function normalizeStringArray(value, fallback) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [...fallback];
    }

    if (trimmed.startsWith("[")) {
      try {
        return normalizeStringArray(JSON.parse(trimmed), fallback);
      } catch (_) {
        return [...fallback];
      }
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [...fallback];
}

function resetEnv(target) {
  const defaults = createDefaultEnv();
  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  Object.assign(target, defaults);
}

export const env = createDefaultEnv();

export const setEnv = (newEnv = {}) => {
  resetEnv(env);
  Object.assign(env, newEnv);
  env.SUPPORTED_ENGINES = normalizeStringArray(
    env.SUPPORTED_ENGINES,
    createDefaultEnv().SUPPORTED_ENGINES
  );
  env.DEFAULT_ENGINES = normalizeStringArray(
    env.DEFAULT_ENGINES,
    createDefaultEnv().DEFAULT_ENGINES
  );
  env.DEFAULT_ENGINES_ZH = normalizeStringArray(
    env.DEFAULT_ENGINES_ZH,
    createDefaultEnv().DEFAULT_ENGINES_ZH
  );
  env.DEFAULT_ENGINES_NON_ZH = normalizeStringArray(
    env.DEFAULT_ENGINES_NON_ZH,
    createDefaultEnv().DEFAULT_ENGINES_NON_ZH
  );
  env.CORS_ALLOWED_ORIGINS = normalizeStringArray(
    env.CORS_ALLOWED_ORIGINS,
    createDefaultEnv().CORS_ALLOWED_ORIGINS
  );
  env.CORS_ALLOWED_HEADERS = normalizeStringArray(
    env.CORS_ALLOWED_HEADERS,
    createDefaultEnv().CORS_ALLOWED_HEADERS
  );
  env.SEARCH_PRIMARY_TIERS = normalizeStringArray(
    env.SEARCH_PRIMARY_TIERS,
    createDefaultEnv().SEARCH_PRIMARY_TIERS
  );
  env.SEARCH_SECONDARY_TIERS = normalizeStringArray(
    env.SEARCH_SECONDARY_TIERS,
    createDefaultEnv().SEARCH_SECONDARY_TIERS
  );
  env.SEARCH_EXPERIMENTAL_TIERS = normalizeStringArray(
    env.SEARCH_EXPERIMENTAL_TIERS,
    createDefaultEnv().SEARCH_EXPERIMENTAL_TIERS
  );
};
