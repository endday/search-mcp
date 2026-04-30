type ResultItem = {
  title: string;
  description: string;
  url: string;
  source_type?: SourceType;
  authority_score?: number;
};

type TimeRange = "day" | "week" | "month" | "year";
type SkippedEngineReason =
  | "unsupported_engine"
  | "unavailable_engine"
  | "unsupported_time_range"
  | "unsupported_pageno";

type SkippedEngine = {
  engine: string;
  reason: SkippedEngineReason;
};

type LocationSource = "auto" | "explicit" | "disabled" | "unavailable";
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

type SourceFilters = {
  include_source_types: string[];
  exclude_source_types: string[];
  min_authority_score: number | null;
  active: boolean;
};

type ResearchSourceBase = ResultItem & {
  index: number;
  engine: string;
  source_type: SourceType;
  authority_score: number;
};

type ResearchOkSource = ResearchSourceBase & {
  status: "ok";
  source_title: string;
  source_description: string;
  extractor: string | null;
  metadata: Record<string, unknown>;
  excerpt: string;
  stats: {
    text_length: number;
    html_length: number;
    score: number | null;
    link_density: number | null;
    paragraph_count: number;
  } | null;
};

type ResearchErrorSource = ResearchSourceBase & {
  status: "error";
  error: {
    code: string;
    category: string;
    message: string;
    status: number;
  };
};

type ResearchSkippedSource = ResearchSourceBase & {
  status: "skipped";
  source_title: string;
  source_description: string;
  extractor: string | null;
  metadata: Record<string, unknown>;
  stats: {
    text_length: number;
    html_length: number;
    score: number | null;
    link_density: number | null;
    paragraph_count: number;
  } | null;
  reason: {
    code: string;
    category: "quality";
    message: string;
  };
};

export type ResearchSource =
  | ResearchOkSource
  | ResearchErrorSource
  | ResearchSkippedSource;

export type subSearch = (params: {
  query: string;
  language?: string;
  location?: string;
  time_range?: TimeRange;
  pageno?: number;
  signal?: AbortSignal;
}) => Promise<Array<ResultItem>>;

export type searchAll = (params: {
  query: string;
  engines?: string[];
  language?: string;
  location?: string;
  time_range?: TimeRange;
  pageno?: number;
  min_authority_score?: number;
  include_source_types?: string[];
  exclude_source_types?: string[];
}) => Promise<{
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
  enabled_engines: string[];
  skipped_engines: SkippedEngine[];
  unresponsive_engines: string[];
  source_filters?: SourceFilters;
  results: Array<ResultItem & { engine: string }>;
}>;

export type searchAllWithMeta = (params: {
  query: string;
  engines?: string[];
  language?: string;
  location?: string;
  time_range?: TimeRange;
  pageno?: number;
}) => Promise<{
  response: Awaited<ReturnType<searchAll>>;
  meta: {
    cache_status: "hit" | "miss" | "revalidated" | "stale-if-error";
    fallback_order: string[];
    fallback_path: string[];
    engine_timings: Array<{
      engine: string;
      duration_ms: number;
      status: string;
      result_count: number;
    }>;
  };
}>;

export type research = (params: {
  query: string;
  engines?: string[];
  language?: string;
  location?: string;
  time_range?: TimeRange;
  pageno?: number;
  limit?: number;
  excerpt_chars?: number;
  max_bytes?: number;
  min_authority_score?: number;
  include_source_types?: string[];
  exclude_source_types?: string[];
}) => Promise<{
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
  enabled_engines: string[];
  skipped_engines: SkippedEngine[];
  unresponsive_engines: string[];
  source_filters?: SourceFilters;
  results: Array<ResultItem & { engine: string }>;
  limit: number;
  excerpt_chars: number;
  max_bytes: number;
  attempted_count: number;
  read_count: number;
  failed_count: number;
  skipped_count: number;
  duration_ms: number;
  sources: ResearchSource[];
}>;

export type ResearchResponse = Awaited<ReturnType<research>>;

export interface Env {
  DEFAULT_TIMEOUT?: string;
  HEDGED_FALLBACK_DELAY_MS?: string;
  SUPPORTED_ENGINES?: string[];
  DEFAULT_ENGINES?: string[];
  DEFAULT_LANGUAGE?: string;
  FALLBACK_MIN_RESULTS?: string;
  FALLBACK_MIN_CONTRIBUTING_ENGINES?: string;
  CACHE_TTL_SECONDS?: string;
  STALE_CACHE_TTL_SECONDS?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  HEALTH_FAILURE_THRESHOLD?: string;
  HEALTH_COOLDOWN_SECONDS?: string;
  HEALTH_STATE_TTL_SECONDS?: string;
  CORS_ALLOWED_ORIGINS?: string[] | string;
  CORS_ALLOWED_HEADERS?: string[] | string;
  AUTH_REQUIRED?: string;
  TOKEN?: string;
  CF_BROWSER_RENDERING_ACCOUNT_ID?: string;
  CF_BROWSER_RENDERING_API_TOKEN?: string;
  SEARCH_KV?: unknown;
  SEARCH_STATE_KV?: unknown;
}
