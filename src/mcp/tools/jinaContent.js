import { normalizeMaxChars, truncateText } from "../format.js";
import { requireUrl } from "../local/content.js";

async function jinaContentAPI(config, targetUrl) {
  const encodedUrl = encodeURIComponent(targetUrl);
  const response = await fetch(`${config.jinaBaseUrl}${encodedUrl}`, {
    headers: config.jinaApiKey
      ? { Authorization: `Bearer ${config.jinaApiKey}` }
      : {},
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Jina failed: ${response.status} ${body}`.trim());
  }

  return {
    url: targetUrl,
    text: await response.text(),
  };
}

export async function handleJinaContent(config, args) {
  const url = requireUrl(args);
  const maxChars = normalizeMaxChars(args.max_chars);

  try {
    const result = await jinaContentAPI(config, url);
    return {
      content: [{ type: "text", text: truncateText(String(result.text || ""), maxChars) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: error.message }],
      isError: true,
    };
  }
}
