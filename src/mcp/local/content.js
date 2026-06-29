import { extractPageContent } from "../../content/extract.js";
import {
  fetchReadableContent,
  normalizeContentMaxBytes,
  normalizeTargetUrl,
} from "../../content/fetch.js";

export function requireUrl(args) {
  const url = args.url;
  if (!url || typeof url !== "string") {
    throw new Error("url required");
  }
  return url;
}

export async function contentLocal(targetUrl, options = {}) {
  const maxBytes = normalizeContentMaxBytes({
    max_bytes: options.max_bytes,
  });
  return fetchReadableContent(targetUrl, maxBytes);
}

export async function extractHtmlLocal(targetUrl, html) {
  const normalizedUrl = normalizeTargetUrl(targetUrl);
  return extractPageContent(html, normalizedUrl);
}
