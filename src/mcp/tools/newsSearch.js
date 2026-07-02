import { formatSearchResponse } from "../format.js";
import { executeSearch } from "./webSearch.js";

export async function handleNewsSearch(config, args) {
  if (!args.query || typeof args.query !== "string") {
    throw new Error("query required");
  }

  try {
    const result = await executeSearch(config, args, {
      vertical: "news",
    });
    return {
      content: [{ type: "text", text: formatSearchResponse(result) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `News search failed: ${error.message}` }],
      isError: true,
    };
  }
}
