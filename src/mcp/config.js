import { env, setEnv } from "../../envs.js";
import { createHash } from "node:crypto";

function buildDefaultLocalClientId() {
  const seed = [
    process.env.SEARCH_MCP_SESSION_ID || "",
    process.pid,
    process.cwd(),
  ].join(":");

  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return `mcp-local:${digest}`;
}

function normalizeMode(value) {
  return "local";
}

function applyLocalEnvFromProcess() {
  const overrides = {};
  const keys = [
    "SUPPORTED_ENGINES",
    "DEFAULT_ENGINES",
    "DEFAULT_ENGINES_ZH",
    "DEFAULT_ENGINES_NON_ZH",
    "DEFAULT_LANGUAGE",
    "DEFAULT_TIMEOUT",
    "FALLBACK_MIN_RESULTS",
    "FALLBACK_MIN_CONTRIBUTING_ENGINES",
    "SEARCH_PRIMARY_TIERS",
    "SEARCH_SECONDARY_TIERS",
    "SEARCH_EXPERIMENTAL_TIERS",
    "EDGE_CACHE_TTL_SECONDS",
    "CACHE_TTL_SECONDS",
    "STALE_CACHE_TTL_SECONDS",
    "UPSTREAM_RETRY_ATTEMPTS",
    "UPSTREAM_RETRY_DELAY_MS",
    "UPSTREAM_PRIMARY_RETRY_ATTEMPTS",
    "UPSTREAM_SECONDARY_RETRY_ATTEMPTS",
    "UPSTREAM_EXPERIMENTAL_RETRY_ATTEMPTS",
    "UPSTREAM_MIN_REQUEST_INTERVAL_MS",
    "UPSTREAM_PRIMARY_MIN_REQUEST_INTERVAL_MS",
    "UPSTREAM_SECONDARY_MIN_REQUEST_INTERVAL_MS",
    "UPSTREAM_EXPERIMENTAL_MIN_REQUEST_INTERVAL_MS",
    "HEALTH_FAILURE_THRESHOLD",
    "HEALTH_COOLDOWN_SECONDS",
  ];

  for (const key of keys) {
    if (process.env[key] !== undefined) {
      overrides[key] = process.env[key];
    }
  }

  overrides.SUPPORTED_ENGINES ||= env.SUPPORTED_ENGINES.join(",");
  setEnv(overrides);
}

export function loadMcpConfig() {
  const mode = normalizeMode(process.env.SEARCH_MCP_MODE);

  applyLocalEnvFromProcess();

  return {
    mode,
    jinaApiKey: process.env.JINA_API_KEY || "",
    jinaBaseUrl: process.env.JINA_BASE_URL || "https://r.jina.ai/",
    upstreamClient: process.env.SEARCH_MCP_UPSTREAM_CLIENT || "auto",
    localClientId:
      process.env.SEARCH_MCP_CLIENT_ID ||
      process.env.SEARCH_MCP_SESSION_ID ||
      buildDefaultLocalClientId(),
    allEngines: [...env.SUPPORTED_ENGINES],
  };
}
