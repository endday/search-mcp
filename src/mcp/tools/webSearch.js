import { formatSearchResponse } from "../format.js";
import { searchLocal } from "../local/search.js";

export function buildSearchOptions(args, overrides = {}) {
  const searchOptions = {
    vertical: overrides.vertical || "web",
    language: args.language,
    search_lang: args.search_lang,
    ui_lang: args.ui_lang,
    location: args.location,
    time_range: args.time_range,
    pageno: args.pageno,
    count: args.count,
    offset: args.offset,
    clientId: args.client_id,
  };

  if (Number.isFinite(args.min_authority_score)) {
    searchOptions.min_authority_score = args.min_authority_score;
  }
  if (Array.isArray(args.include_source_types)) {
    searchOptions.include_source_types = args.include_source_types;
  }
  if (Array.isArray(args.exclude_source_types)) {
    searchOptions.exclude_source_types = args.exclude_source_types;
  }

  return searchOptions;
}

export async function executeSearch(config, args, overrides = {}) {
  const engines = Array.isArray(args.engines) && args.engines.length > 0 ? args.engines : null;
  const searchOptions = {
    ...buildSearchOptions(args, overrides),
    clientId: args.client_id || config.localClientId,
  };

  return searchLocal(args.query, engines, searchOptions);
}

export async function handleWebSearch(config, args) {
  if (!args.query || typeof args.query !== "string") {
    throw new Error("query required");
  }

  try {
    const result = await executeSearch(config, args);
    return {
      content: [{ type: "text", text: formatSearchResponse(result) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Search failed: ${error.message}` }],
      isError: true,
    };
  }
}
