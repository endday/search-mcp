import { GENERATED_SOURCE_AUTHORITY } from "../../data/sourceAuthority.generated.js";

export const normalizeResults = (results) =>
  results
    .map((result) => ({
      title: String(result.title || result.name || "").trim(),
      url: String(result.url || result.link || result.href || "").trim(),
      description: String(
        result.description || result.content || result.snippet || ""
      ).trim(),
    }))
    .filter((result) => result.url && result.title);

const TRACKING_QUERY_PARAMS = new Set([
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "ref_src",
  "srsltid",
]);
const SOURCE_AUTHORITY_RULES = [
  {
    domains: ["deepseek.com"],
    source_type: "official",
    authority_score: 90,
    ai_model_boost: 20,
  },
  {
    domains: ["huggingface.co"],
    source_type: "model_repo",
    authority_score: 70,
    ai_model_boost: 15,
  },
  {
    domains: ["github.com"],
    source_type: "code_repo",
    authority_score: 55,
    ai_model_boost: 10,
  },
  {
    domains: ["arxiv.org", "openreview.net"],
    source_type: "paper",
    authority_score: 60,
    ai_model_boost: 15,
  },
  {
    domains: [
      "artificialanalysis.ai",
      "lmarena.ai",
      "livebench.ai",
      "paperswithcode.com",
      "scale.com",
      "swebench.com",
      "vals.ai",
    ],
    source_type: "benchmark",
    authority_score: 55,
    ai_model_boost: 15,
  },
  {
    domains: ["semianalysis.com"],
    source_type: "analysis",
    authority_score: 50,
    ai_model_boost: 10,
  },
  {
    domains: [
      "apnews.com",
      "bloomberg.com",
      "ft.com",
      "reuters.com",
      "theverge.com",
      "wsj.com",
    ],
    source_type: "media",
    authority_score: 35,
  },
  {
    domains: [
      "caixin.com",
      "eet-china.com",
      "infoq.cn",
      "news.cn",
      "stcn.com",
      "yicai.com",
    ],
    source_type: "media",
    authority_score: 28,
  },
  {
    domains: ["csdn.net", "juejin.cn"],
    source_type: "blog",
    authority_score: -20,
  },
  {
    domains: ["zhihu.com"],
    source_type: "community",
    authority_score: -10,
  },
];
const AI_MODEL_QUERY_RE =
  /ai|agent|benchmark|deepseek|gpt|llm|model|性能|模型|推理|评测|测评|基准|代码|上下文|开源/i;
const PDF_PATH_RE = /\.pdf(?:$|[?#])/i;
const HAN_SEGMENT_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]{2,}/gu;
const MOSTLY_LATIN_QUERY_RE = /^[\p{Script=Latin}\p{Number}\s'".,!?():/_+-]+$/u;

function normalizeUrlPath(pathname) {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function hostnameMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getMatchedAuthorityRule(hostname) {
  return SOURCE_AUTHORITY_RULES.find((rule) =>
    rule.domains.some((domain) => hostnameMatches(hostname, domain))
  );
}

function getGeneratedAuthorityRule(hostname) {
  const domains = GENERATED_SOURCE_AUTHORITY.domains || {};
  const parts = hostname.split(".");

  for (let index = 0; index <= parts.length - 2; index += 1) {
    const candidate = parts.slice(index).join(".");
    if (domains[candidate]) {
      return domains[candidate];
    }
  }

  return null;
}

function getSourceAuthority(rawUrl, query) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    const rule = getMatchedAuthorityRule(hostname);
    const generatedRule = getGeneratedAuthorityRule(hostname);
    const isAiModelQuery = AI_MODEL_QUERY_RE.test(String(query || ""));
    const mobilePenalty = hostname.startsWith("m.") ? -5 : 0;
    const pdfPenalty = PDF_PATH_RE.test(`${url.pathname}${url.search}`) ? -15 : 0;

    if (!rule) {
      if (generatedRule) {
        return {
          source_type: generatedRule.source_type || "low_credibility",
          authority_score:
            Number.parseInt(generatedRule.authority_score || "0", 10) +
            mobilePenalty +
            pdfPenalty,
        };
      }

      return {
        source_type: PDF_PATH_RE.test(`${url.pathname}${url.search}`)
          ? "document"
          : "unknown",
        authority_score: mobilePenalty + pdfPenalty,
      };
    }

    return {
      source_type: rule.source_type,
      authority_score:
        rule.authority_score +
        mobilePenalty +
        pdfPenalty +
        (isAiModelQuery ? rule.ai_model_boost || 0 : 0),
    };
  } catch (_) {
    return {
      source_type: "unknown",
      authority_score: 0,
    };
  }
}

export function canonicalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = normalizeUrlPath(url.pathname);

    [...url.searchParams.keys()].forEach((key) => {
      if (key.startsWith("utm_") || TRACKING_QUERY_PARAMS.has(key)) {
        url.searchParams.delete(key);
      }
    });

    return url.toString();
  } catch (_) {
    return String(rawUrl || "").trim();
  }
}

function tokenizeQuery(query) {
  const normalizedQuery = String(query || "");
  const tokens = normalizedQuery
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const hanSegments = normalizedQuery.match(HAN_SEGMENT_RE) || [];

  return [...new Set([...tokens, ...hanSegments])];
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/gu, "");
}

function isMostlyLatinQuery(query) {
  const normalized = String(query || "").trim();
  return MOSTLY_LATIN_QUERY_RE.test(normalized) && /[a-z]/i.test(normalized);
}

function getHanPenalty(text) {
  const matches = String(text || "").match(HAN_SEGMENT_RE) || [];
  return matches.join("").length >= 6 ? -30 : 0;
}

function calculateResultScore({
  queryTokens,
  queryPhrase,
  query,
  title,
  description,
  url,
  sourceType,
  enginePriority,
  position,
}) {
  const normalizedTitle = title.toLowerCase();
  const normalizedDescription = description.toLowerCase();
  const comparableTitle = normalizeComparableText(title);
  const comparableDescription = normalizeComparableText(description);
  const comparableUrl = normalizeComparableText(url);
  const titleMatches = queryTokens.filter((token) =>
    normalizedTitle.includes(token)
  ).length;
  const descriptionMatches = queryTokens.filter((token) =>
    normalizedDescription.includes(token)
  ).length;
  const titlePhraseMatch =
    queryPhrase.length >= 4 && comparableTitle.includes(queryPhrase);
  const descriptionPhraseMatch =
    queryPhrase.length >= 4 && comparableDescription.includes(queryPhrase);
  const urlPhraseMatch =
    queryPhrase.length >= 4 && comparableUrl.includes(queryPhrase);
  const hasAnyTokenMatch = titleMatches > 0 || descriptionMatches > 0;
  const officialPhraseBoost =
    sourceType === "official" && (titlePhraseMatch || urlPhraseMatch) ? 20 : 0;
  const latinQueryHanPenalty =
    isMostlyLatinQuery(query) && sourceType !== "official"
      ? getHanPenalty(`${title} ${description}`)
      : 0;
  const hanQueryNoMatchPenalty =
    !isMostlyLatinQuery(query) &&
    queryTokens.length > 0 &&
    !hasAnyTokenMatch &&
    !titlePhraseMatch &&
    !descriptionPhraseMatch &&
    !urlPhraseMatch
      ? -60
      : 0;

  return (
    enginePriority +
    Math.max(0, 30 - position * 2) +
    titleMatches * 6 +
    descriptionMatches * 2 +
    (titlePhraseMatch ? 35 : 0) +
    (descriptionPhraseMatch ? 10 : 0) +
    (urlPhraseMatch ? 20 : 0) +
    officialPhraseBoost +
    latinQueryHanPenalty +
    hanQueryNoMatchPenalty
  );
}

const LOW_QUALITY_ENGINE_THRESHOLD = 80;

export function dedupeAndRankResults({ engineResults, query, registry }) {
  const queryTokens = tokenizeQuery(query);
  const queryPhrase = normalizeComparableText(query);
  const deduped = new Map();
  // Track which engines contributed to each URL for cross-engine penalty
  const urlEngineCount = new Map();

  for (const { engine, results } of engineResults) {
    const enginePriority = registry[engine]?.priority || 0;

    normalizeResults(results).forEach((result, index) => {
      const canonicalUrl = canonicalizeUrl(result.url);
      const sourceAuthority = getSourceAuthority(canonicalUrl, query);
      const candidate = {
        ...result,
        url: canonicalUrl,
        engine,
        ...sourceAuthority,
        score:
          calculateResultScore({
            queryTokens,
            queryPhrase,
            query,
            title: result.title,
            description: result.description,
            url: canonicalUrl,
            sourceType: sourceAuthority.source_type,
            enginePriority,
            position: index,
          }) + sourceAuthority.authority_score,
      };

      // Track engine contribution count for this URL
      const prevCount = urlEngineCount.get(canonicalUrl) || 0;
      urlEngineCount.set(canonicalUrl, prevCount + 1);

      const existing = deduped.get(canonicalUrl);
      if (!existing || candidate.score > existing.score) {
        deduped.set(canonicalUrl, candidate);
      } else if (!existing.description && candidate.description) {
        existing.description = candidate.description;
      }
    });
  }

  // Penalize results that only appear in a single low-quality engine
  // (likely irrelevant / low-quality results that no other engine confirmed)
  const LOW_PRIORITY_SOLE_PENALTY = -40;

  return [...deduped.values()]
    .map((result) => {
      const enginePriority = registry[result.engine]?.priority || 0;
      const engineCount = urlEngineCount.get(result.url) || 1;

      if (engineCount === 1 && enginePriority < LOW_QUALITY_ENGINE_THRESHOLD) {
        return { ...result, score: result.score + LOW_PRIORITY_SOLE_PENALTY };
      }

      return result;
    })
    .sort((left, right) => right.score - left.score)
    .map(({ score, ...result }) => result);
}
