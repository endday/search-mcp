import { env } from "../../../envs.js";
import { ApiError } from "../../core/errors.js";
import { searchAllWithMeta } from "../../search/gateway.js";

const LATIN_QUERY_RE = /^[\p{Script=Latin}\p{Number}\s'".,!?():/_+-]+$/u;

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

function resolveRequestedEngines(engines, language) {
  if (Array.isArray(engines) && engines.length > 0) {
    return engines;
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

  const language = resolveLanguage(normalizedQuery, options.language);
  const requestedEngines = resolveRequestedEngines(engines, language);
  const effectiveQuery = appendLocationToQuery(normalizedQuery, options.location);
  const filters = normalizeSourceFilters(options);
  const clientId = String(options.clientId || "mcp-local").trim() || "mcp-local";
  const runtimeContext = createRuntimeContext(effectiveQuery, clientId);

  const { response } = await searchAllWithMeta({
    query: effectiveQuery,
    engines: requestedEngines,
    language,
    time_range: options.time_range,
    pageno: options.pageno,
    clientId,
    runtimeContext,
  });

  return {
    ...applySourceFilters(response, filters),
    query: normalizedQuery,
    effective_query: effectiveQuery,
    location: options.location || null,
    location_source: options.location ? "explicit" : "disabled",
  };
}
