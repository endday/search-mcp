import { MAX_CHARS_DEFAULT, MAX_CHARS_MAX, MAX_CHARS_MIN } from "./format.js";

export function createSearchInputSchema(allEngines) {
  return {
    type: "object",
    properties: {
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
      location: {
        type: "string",
        description: "Location hint for query enrichment",
      },
      time_range: {
        type: "string",
        enum: ["day", "week", "month", "year"],
        description: "Time range filter",
      },
      pageno: {
        type: "integer",
        minimum: 0,
        description: "Page number (0-based)",
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
    },
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
