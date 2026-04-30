import { GENERATED_SOURCE_AUTHORITY } from "../data/sourceAuthority.generated.js";

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
  return String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function calculateResultScore({
  queryTokens,
  title,
  description,
  enginePriority,
  position,
}) {
  const normalizedTitle = title.toLowerCase();
  const normalizedDescription = description.toLowerCase();
  const titleMatches = queryTokens.filter((token) =>
    normalizedTitle.includes(token)
  ).length;
  const descriptionMatches = queryTokens.filter((token) =>
    normalizedDescription.includes(token)
  ).length;

  return (
    enginePriority +
    Math.max(0, 30 - position * 2) +
    titleMatches * 6 +
    descriptionMatches * 2
  );
}

export function dedupeAndRankResults({ engineResults, query, registry }) {
  const queryTokens = tokenizeQuery(query);
  const deduped = new Map();

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
            title: result.title,
            description: result.description,
            enginePriority,
            position: index,
          }) + sourceAuthority.authority_score,
      };

      const existing = deduped.get(canonicalUrl);
      if (!existing || candidate.score > existing.score) {
        deduped.set(canonicalUrl, candidate);
      } else if (!existing.description && candidate.description) {
        existing.description = candidate.description;
      }
    });
  }

  return [...deduped.values()]
    .sort((left, right) => right.score - left.score)
    .map(({ score, ...result }) => result);
}
