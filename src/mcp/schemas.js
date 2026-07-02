import { MAX_CHARS_DEFAULT, MAX_CHARS_MAX, MAX_CHARS_MIN } from "./format.js";

function createSearchProperties(allEngines, options = {}) {
  const properties = {
    query: {
      type: "string",
      description: "Search query",
    },
    engines: {
      type: "array",
      items: {
        type: "string",
        enum: allEngines,
      },
      description: `Engines to query. Default: ${allEngines.join(", ")}.`,
    },
    language: {
      type: "string",
      description: "Language hint (e.g. en, zh-CN)",
    },
    search_lang: {
      type: "string",
      description: "Search language hint (e.g. en, zh-CN)",
    },
    ui_lang: {
      type: "string",
      description: "UI locale hint (e.g. en-US, zh-CN)",
    },
    time_range: {
      type: "string",
      enum: ["day", "week", "month", "year"],
      description: "Time range filter",
    },
    count: {
      type: "integer",
      minimum: 1,
      description: "Max number of results to return after ranking",
    },
    offset: {
      type: "integer",
      minimum: 0,
      description: "Result offset to apply after ranking",
    },
    min_authority_score: {
      type: "number",
      description: "Min source authority score",
    },
    include_source_types: {
      type: "array",
      items: { type: "string" },
      description: "Source types to include",
    },
    exclude_source_types: {
      type: "array",
      items: { type: "string" },
      description: "Source types to exclude",
    },
  };

  if (options.includeLocation !== false) {
    properties.location = {
      type: "string",
      description: "Location hint for query enrichment",
    };
  }

  if (options.includePage !== false) {
    properties.pageno = {
      type: "integer",
      minimum: 0,
      description: "Page number (0-based)",
    };
  }

  return properties;
}

export function createSearchInputSchema(allEngines) {
  return {
    type: "object",
    properties: createSearchProperties(allEngines, {
      includeLocation: true,
      includePage: true,
    }),
    required: ["query"],
  };
}

export function createNewsSearchInputSchema(allEngines) {
  return {
    type: "object",
    properties: createSearchProperties(allEngines, {
      includeLocation: false,
      includePage: false,
    }),
    required: ["query"],
  };
}

export const CONTENT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "URL to extract content from",
    },
    max_chars: {
      type: "integer",
      minimum: MAX_CHARS_MIN,
      maximum: MAX_CHARS_MAX,
      description: `Max text chars to return. Default: ${MAX_CHARS_DEFAULT}.`,
    },
  },
  required: ["url"],
};

export const JINA_CONTENT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "URL to extract content from via Jina AI reader",
    },
    max_chars: {
      type: "integer",
      minimum: MAX_CHARS_MIN,
      maximum: MAX_CHARS_MAX,
      description: `Max text chars to return. Default: ${MAX_CHARS_DEFAULT}.`,
    },
  },
  required: ["url"],
};
