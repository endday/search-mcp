export const MAX_CHARS_MIN = 500;
export const MAX_CHARS_MAX = 20000;
export const MAX_CHARS_DEFAULT = 4000;

export function normalizeMaxChars(value) {
  return Number.isInteger(value)
    ? Math.min(Math.max(value, MAX_CHARS_MIN), MAX_CHARS_MAX)
    : MAX_CHARS_DEFAULT;
}

export function truncateText(text, maxChars) {
  return text.length > maxChars
    ? text.slice(0, maxChars) + `\n[...${text.length - maxChars} chars truncated]`
    : text;
}

export function formatSearchResponse(result) {
  const lines = result.results.map((item, index) => {
    const score = item.authority_score ?? 0;
    const type = item.source_type || "unknown";
    const tag = score > 0 || type !== "unknown" ? ` ${type}(${score})` : "";
    const desc = String(item.description || "").slice(0, 120);
    const descPart = desc ? ` | ${desc}` : "";
    const sourcePart = item.source_name ? ` | source: ${item.source_name}` : "";
    const publishedPart = item.published_text ? ` | published: ${item.published_text}` : "";
    return `${index + 1}. ${item.title}${sourcePart}${publishedPart}${descPart} | ${item.url}${tag}`;
  });

  return lines.join("\n");
}

export function formatContentResponse(result, maxChars) {
  const text = String(result.text || result.excerpt || "");
  const header = [
    result.title ? `# ${result.title}` : null,
    result.url ? result.url : null,
    result.extractor ? `(${result.extractor})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const excerpt = truncateText(text, maxChars);
  return header ? `${header}\n${excerpt}` : excerpt;
}
