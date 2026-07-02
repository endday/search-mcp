import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

export type SourceType =
  | "official"
  | "model_repo"
  | "code_repo"
  | "paper"
  | "benchmark"
  | "analysis"
  | "media"
  | "blog"
  | "community"
  | "low_credibility"
  | "disinformation"
  | "document"
  | "unknown";

export type TimeRange = "day" | "week" | "month" | "year";

export type ResultItem = {
  title: string;
  description: string;
  url: string;
  source_name?: string;
  published_text?: string;
  source_type?: SourceType;
  authority_score?: number;
};

export type SkippedEngineReason =
  | "unsupported_engine"
  | "unsupported_vertical"
  | "unavailable_engine"
  | "unsupported_time_range"
  | "unsupported_pageno";

export type SkippedEngine = {
  engine: string;
  reason: SkippedEngineReason;
};

export type LocationSource =
  | "auto"
  | "explicit"
  | "disabled"
  | "unavailable";

export type SourceFilters = {
  include_source_types: string[];
  exclude_source_types: string[];
  min_authority_score: number | null;
  active: boolean;
};

export type SearchLocalOptions = {
  vertical?: "web" | "news";
  language?: string;
  search_lang?: string;
  ui_lang?: string;
  location?: string;
  time_range?: TimeRange;
  pageno?: number;
  count?: number;
  offset?: number;
  min_authority_score?: number | string | null;
  include_source_types?: string[];
  exclude_source_types?: string[];
  clientId?: string;
};

export type SearchAllParams = {
  vertical?: "web" | "news";
  query: string;
  engines: string[];
  language?: string;
  time_range?: TimeRange;
  pageno?: number;
  clientId?: string;
  runtimeContext?: unknown;
};

export type SearchResponse = {
  vertical?: "web" | "news";
  query: string;
  effective_query?: string;
  location?: string | null;
  location_source?: LocationSource;
  location_context?: {
    value: string;
    source: LocationSource;
    mode: string;
    client: {
      city: string;
      region: string;
      country: string;
      timezone: string;
    };
  };
  number_of_results: number;
  count?: number | null;
  offset?: number;
  enabled_engines: string[];
  skipped_engines: SkippedEngine[];
  unresponsive_engines: string[];
  source_filters?: SourceFilters;
  results: Array<ResultItem & { engine: string }>;
};

export type SearchMetaResponse = {
  response: SearchResponse;
  meta: {
    cache_status: "hit" | "miss" | "revalidated" | "stale-if-error";
    cache_layer?: string;
    fallback_order: string[];
    fallback_path: string[];
    strategy?: string;
    engine_timings: Array<{
      engine: string;
      duration_ms: number;
      status: string;
      result_count: number;
      tier?: string;
    }>;
  };
};

export interface Env {
  DEFAULT_TIMEOUT?: string;
  SUPPORTED_ENGINES?: string[];
  DEFAULT_ENGINES?: string[];
  DEFAULT_ENGINES_ZH?: string[];
  DEFAULT_ENGINES_NON_ZH?: string[];
  DEFAULT_LANGUAGE?: string;
  FALLBACK_MIN_RESULTS?: string;
  FALLBACK_MIN_CONTRIBUTING_ENGINES?: string;
  SEARCH_PRIMARY_TIERS?: string[];
  SEARCH_SECONDARY_TIERS?: string[];
  SEARCH_EXPERIMENTAL_TIERS?: string[];
  SEARCH_TIER_HEDGE_DELAY_MS?: string;
  EDGE_CACHE_TTL_SECONDS?: string;
  CACHE_TTL_SECONDS?: string;
  STALE_CACHE_TTL_SECONDS?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  UPSTREAM_RETRY_ATTEMPTS?: string;
  UPSTREAM_RETRY_DELAY_MS?: string;
  UPSTREAM_PRIMARY_RETRY_ATTEMPTS?: string;
  UPSTREAM_SECONDARY_RETRY_ATTEMPTS?: string;
  UPSTREAM_EXPERIMENTAL_RETRY_ATTEMPTS?: string;
  UPSTREAM_SESSION_TTL_SECONDS?: string;
  UPSTREAM_MIN_REQUEST_INTERVAL_MS?: string;
  UPSTREAM_PRIMARY_MIN_REQUEST_INTERVAL_MS?: string;
  UPSTREAM_SECONDARY_MIN_REQUEST_INTERVAL_MS?: string;
  UPSTREAM_EXPERIMENTAL_MIN_REQUEST_INTERVAL_MS?: string;
  HEALTH_FAILURE_THRESHOLD?: string;
  HEALTH_COOLDOWN_SECONDS?: string;
  HEALTH_STATE_TTL_SECONDS?: string;
  CORS_ALLOWED_ORIGINS?: string[] | string;
  CORS_ALLOWED_HEADERS?: string[] | string;
  AUTH_REQUIRED?: string;
  TOKEN?: string | null;
  CF_BROWSER_RENDERING_ACCOUNT_ID?: string | null;
  CF_BROWSER_RENDERING_API_TOKEN?: string | null;
  SEARCH_KV?: unknown;
  SEARCH_STATE_KV?: unknown;
}

export type McpConfig = {
  mode: "local";
  jinaApiKey: string;
  jinaBaseUrl: string;
  upstreamClient: string;
  localClientId: string;
  allEngines: string[];
};

export const env: Env;
export function setEnv(newEnv?: Partial<Env>): void;
export function loadMcpConfig(): McpConfig;
export function main(): Promise<void>;
export function createServer(config: McpConfig): Server;
export function startServer(server: Server): Promise<void>;
export function searchLocal(
  query: string,
  engines?: string[] | null,
  options?: SearchLocalOptions
): Promise<SearchResponse>;
export function searchAll(params: SearchAllParams): Promise<SearchResponse>;
export function searchAllWithMeta(
  params: SearchAllParams
): Promise<SearchMetaResponse>;
