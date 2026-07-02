import { env } from "../../../envs.js";
import { ApiError } from "../../core/errors.js";
import { searchAllWithMeta } from "../../search/gateway.js";

const LATIN_QUERY_RE = /^[\p{Script=Latin}\p{Number}\s'".,!?():/_+-]+$/u;
const DEFAULT_NEWS_ENGINES = ["bing", "brave", "yahoo"];

function normalizeSourceTypeList(value) {
  const items = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim());

  return [
    ...new Set(
      items
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function normalizeMinAuthorityScore(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSourceFilters(options) {
  const includeSourceTypes = normalizeSourceTypeList(options.include_source_types);
  const excludeSourceTypes = normalizeSourceTypeList(options.exclude_source_types);
  const minAuthorityScore = normalizeMinAuthorityScore(options.min_authority_score);

  return {
    include_source_types: includeSourceTypes,
    exclude_source_types: excludeSourceTypes,
    min_authority_score: minAuthorityScore,
    active:
      includeSourceTypes.length > 0 ||
      excludeSourceTypes.length > 0 ||
      minAuthorityScore !== null,
  };
}

function resultMatchesSourceFilters(result, filters) {
  if (!filters.active) {
    return true;
  }

  const sourceType = String(result.source_type || "unknown").toLowerCase();
  const authorityScore = Number.isFinite(result.authority_score)
    ? result.authority_score
    : 0;

  if (
    filters.include_source_types.length > 0 &&
    !filters.include_source_types.includes(sourceType)
  ) {
    return false;
  }

  if (filters.exclude_source_types.includes(sourceType)) {
    return false;
  }

  if (
    filters.min_authority_score !== null &&
    authorityScore < filters.min_authority_score
  ) {
    return false;
  }

  return true;
}

function applySourceFilters(response, filters) {
  if (!filters.active) {
    return response;
  }

  const results = response.results.filter((result) =>
    resultMatchesSourceFilters(result, filters)
  );

  return {
    ...response,
    number_of_results: results.length,
    source_filters: filters,
    results,
  };
}

function inferLanguageFromQuery(query, fallbackLanguage) {
  const normalizedQuery = String(query || "");

  if (/[\u3040-\u30ff]/u.test(normalizedQuery)) {
    return "ja-JP";
  }

  if (/[\uac00-\ud7af]/u.test(normalizedQuery)) {
    return "ko-KR";
  }

  if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(normalizedQuery)) {
    return "zh-CN";
  }

  if (LATIN_QUERY_RE.test(normalizedQuery) && /[a-z]/i.test(normalizedQuery)) {
    return "en-US";
  }

  return fallbackLanguage;
}

function resolveLanguage(query, language) {
  return language || inferLanguageFromQuery(query, env.DEFAULT_LANGUAGE);
}

function isChineseLanguage(language) {
  return String(language || "").trim().toLowerCase().startsWith("zh");
}

function resolveRequestedEngines(engines, language, vertical = "web") {
  if (Array.isArray(engines) && engines.length > 0) {
    return engines;
  }

  if (vertical === "news") {
    return DEFAULT_NEWS_ENGINES;
  }

  return isChineseLanguage(language)
    ? env.DEFAULT_ENGINES_ZH
    : env.DEFAULT_ENGINES_NON_ZH;
}

function appendLocationToQuery(query, location) {
  const normalizedLocation = String(location || "").trim();
  if (!normalizedLocation) {
    return query;
  }

  if (String(query).toLowerCase().includes(normalizedLocation.toLowerCase())) {
    return query;
  }

  return `${query} ${normalizedLocation}`;
}

function createRuntimeContext(query, clientId) {
  return {
    request: new Request(
      `https://mcp.local/search?q=${encodeURIComponent(query)}`,
      {
        method: "GET",
        headers: {
          "x-mcp-client-id": clientId,
        },
      }
    ),
  };
}

function paginateResponse(response, options) {
  const offset = Math.max(0, Number.parseInt(options.offset ?? "0", 10) || 0);
  const count =
    options.count === undefined || options.count === null || options.count === ""
      ? null
      : Math.max(1, Number.parseInt(options.count, 10) || 0);

  if (offset === 0 && count === null) {
    return response;
  }

  const results =
    count === null
      ? response.results.slice(offset)
      : response.results.slice(offset, offset + count);

  return {
    ...response,
    number_of_results: results.length,
    offset,
    count,
    results,
  };
}

export async function searchLocal(query, engines = null, options = {}) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    throw new ApiError({
      status: 400,
      code: "MISSING_QUERY",
      category: "validation",
      message: "query required",
    });
  }

  const vertical = String(options.vertical || "web").trim().toLowerCase() || "web";
  const language = resolveLanguage(
    normalizedQuery,
    options.search_lang || options.ui_lang || options.language
  );
  const requestedEngines = resolveRequestedEngines(engines, language, vertical);
  const effectiveQuery = appendLocationToQuery(normalizedQuery, options.location);
  const filters = normalizeSourceFilters(options);
  const clientId = String(options.clientId || "mcp-local").trim() || "mcp-local";
  const runtimeContext = createRuntimeContext(effectiveQuery, clientId);

  const { response } = await searchAllWithMeta({
    vertical,
    query: effectiveQuery,
    engines: requestedEngines,
    language,
    time_range: options.time_range,
    pageno: options.pageno,
    clientId,
    runtimeContext,
  });

  return {
    ...paginateResponse(applySourceFilters(response, filters), options),
    query: normalizedQuery,
    effective_query: effectiveQuery,
    location: options.location || null,
    location_source: options.location ? "explicit" : "disabled",
  };
}
