import {
  formatContentResponse,
  normalizeMaxChars,
} from "../format.js";
import { contentLocal, requireUrl } from "../local/content.js";

function estimateContentMaxBytes(maxChars) {
  return Math.max(1000000, maxChars * 16 + 200000);
}

async function executeContent(config, url, estimatedMaxBytes) {
  return contentLocal(url, { max_bytes: estimatedMaxBytes });
}

export async function handleContent(config, args) {
  const url = requireUrl(args);
  const maxChars = normalizeMaxChars(args.max_chars);
  const estimatedMaxBytes = estimateContentMaxBytes(maxChars);

  try {
    const result = await executeContent(config, url, estimatedMaxBytes);
    return {
      content: [{ type: "text", text: formatContentResponse(result, maxChars) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Content failed: ${error.message}` }],
      isError: true,
    };
  }
}
