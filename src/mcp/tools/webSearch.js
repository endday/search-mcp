import { formatSearchResponse } from "../format.js";
import { searchLocal } from "../local/search.js";

function buildSearchOptions(args) {
  const options = {
    language: args.language,
    location: args.location,
    time_range: args.time_range,
    pageno: args.pageno,
    clientId: args.client_id,
  };

  if (Number.isFinite(args.min_authority_score)) {
    options.min_authority_score = args.min_authority_score;
  }
  if (Array.isArray(args.include_source_types)) {
    options.include_source_types = args.include_source_types;
  }
  if (Array.isArray(args.exclude_source_types)) {
    options.exclude_source_types = args.exclude_source_types;
  }

  return options;
}

async function executeSearch(config, args) {
  const engines = Array.isArray(args.engines) && args.engines.length > 0 ? args.engines : null;
  const options = {
    ...buildSearchOptions(args),
    clientId: args.client_id || config.localClientId,
  };

  return searchLocal(args.query, engines, options);
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
