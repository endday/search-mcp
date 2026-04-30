#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const DATA_DIR = resolve(ROOT_DIR, "data");
const OVERRIDES_INPUT = resolve(DATA_DIR, "sourceAuthority.overrides.json");
const JSON_OUTPUT = resolve(DATA_DIR, "sourceAuthority.generated.json");
const JS_OUTPUT = resolve(DATA_DIR, "sourceAuthority.generated.js");

const SOURCES = {
  iffy: {
    name: "Iffy.news Index",
    url: "https://opensheet.elk.sh/1ck1_FZC-97uDLIlvRJDTrGqBk0FuDe9yHkluROgpGS8/Iffy-news",
    license: "See https://iffy.news/index/",
  },
  misinformationDomains: {
    name: "JanaLasser/misinformation_domains",
    url: "https://raw.githubusercontent.com/JanaLasser/misinformation_domains/main/data/clean/domain_list_clean.csv",
    license: "CC-BY-SA 4.0 for compilation; upstream lists vary",
  },
  disinformationDomains: {
    name: "JanaLasser/misinformation_domains disinformation subset",
    url: "https://raw.githubusercontent.com/JanaLasser/misinformation_domains/main/data/clean/disinformation_domains_clean.csv",
    license: "CC-BY-SA 4.0 for compilation; upstream lists vary",
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(field);
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value !== "")) {
    rows.push(row);
  }

  return rows;
}

function csvToObjects(text) {
  const [headers = [], ...rows] = parseCsv(text);
  return rows.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), row[index]?.trim() || ""])
    )
  );
}

async function fetchWithRetries(url, init) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, init);

      if (response.ok || response.status < 500) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < 3) {
      await sleep(500 * attempt);
    }
  }

  throw lastError;
}

async function fetchText(url) {
  const response = await fetchWithRetries(url, {
    headers: {
      "User-Agent": "cloudflare-search-source-authority-updater/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const response = await fetchWithRetries(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "cloudflare-search-source-authority-updater/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.json();
}

function normalizeDomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }

  try {
    const url = raw.includes("://")
      ? new URL(raw)
      : new URL(`https://${raw.replace(/^\/+/, "")}`);
    return url.hostname.replace(/^www\./, "");
  } catch (_) {
    return raw
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0]
      .trim();
  }
}

function getIffyScore(row) {
  const score = Number.parseFloat(row.Score || row.Quality || "");
  return Number.isFinite(score) ? score : null;
}

function getIffyAuthorityScore(row) {
  const score = getIffyScore(row);
  if (score === null) {
    return -20;
  }

  if (score <= 0.2) {
    return -45;
  }

  if (score <= 0.4) {
    return -35;
  }

  return -20;
}

function getMisinformationAuthorityScore(row, fallback) {
  const accuracy = Number.parseInt(row.accuracy || "", 10);
  const transparency = Number.parseInt(row.transparency || "", 10);

  if (row.type === "disinformation") {
    return -50;
  }

  if (accuracy === 1 || transparency === 1) {
    return -40;
  }

  if (accuracy === 2) {
    return -30;
  }

  return fallback;
}

function mergeDomain(domains, domain, patch) {
  if (!domain || domain.includes(" ")) {
    return;
  }

  const existing = domains.get(domain) || {
    source_type: patch.source_type,
    authority_score: patch.authority_score,
    sources: [],
    labels: [],
  };
  const isStrongerPenalty = patch.authority_score < existing.authority_score;

  existing.authority_score = Math.min(
    existing.authority_score,
    patch.authority_score
  );
  existing.source_type = isStrongerPenalty
    ? patch.source_type
    : existing.source_type;

  if (!existing.sources.includes(patch.source)) {
    existing.sources.push(patch.source);
  }

  if (patch.label && !existing.labels.includes(patch.label)) {
    existing.labels.push(patch.label);
  }

  domains.set(domain, existing);
}

async function readAuthorityOverrides() {
  try {
    return JSON.parse(await readFile(OVERRIDES_INPUT, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        domains: {},
      };
    }

    throw error;
  }
}

function normalizeOverrideRule(rule) {
  const authorityScore = Number.parseInt(rule.authority_score ?? "0", 10);

  return {
    source_type: String(rule.source_type || "unknown").trim() || "unknown",
    authority_score: Number.isFinite(authorityScore) ? authorityScore : 0,
    sources: ["manual_override"],
    labels: [String(rule.label || "manual_override").trim()].filter(Boolean),
  };
}

async function applyAuthorityOverrides(domains) {
  const overrides = await readAuthorityOverrides();
  const entries = Object.entries(overrides.domains || {});
  let applied = 0;

  for (const [rawDomain, rule] of entries) {
    const domain = normalizeDomain(rawDomain);
    if (!domain || !rule || typeof rule !== "object") {
      continue;
    }

    domains.set(domain, normalizeOverrideRule(rule));
    applied += 1;
  }

  return {
    name: "Manual source authority overrides",
    url: "data/sourceAuthority.overrides.json",
    license: "Project-maintained",
    records: entries.length,
    applied,
  };
}

async function collectIffyDomains(domains) {
  const rows = await fetchJson(SOURCES.iffy.url);

  for (const row of rows) {
    const domain = normalizeDomain(row.Domain || row.URL);
    if (!domain) {
      continue;
    }

    mergeDomain(domains, domain, {
      source: "iffy",
      source_type: "low_credibility",
      authority_score: getIffyAuthorityScore(row),
      label: row["MBFC Fact"] || row["MBFC cred"] || "iffy",
    });
  }

  return rows.length;
}

async function collectMisinformationDomains(domains) {
  const text = await fetchText(SOURCES.misinformationDomains.url);
  const rows = csvToObjects(text);

  for (const row of rows) {
    const domain = normalizeDomain(row.url);
    if (!domain || row.type !== "unreliable") {
      continue;
    }

    mergeDomain(domains, domain, {
      source: "misinformation_domains",
      source_type: "low_credibility",
      authority_score: getMisinformationAuthorityScore(row, -30),
      label: row.label || row.type,
    });
  }

  return rows.length;
}

async function collectDisinformationDomains(domains) {
  const text = await fetchText(SOURCES.disinformationDomains.url);
  const rows = csvToObjects(text);

  for (const row of rows) {
    const domain = normalizeDomain(row.url);
    if (!domain) {
      continue;
    }

    mergeDomain(domains, domain, {
      source: "disinformation_domains",
      source_type: "disinformation",
      authority_score: -50,
      label: row.label || row.type,
    });
  }

  return rows.length;
}

async function main() {
  const domains = new Map();
  const sourceRecords = [];

  sourceRecords.push({
    ...SOURCES.iffy,
    records: await collectIffyDomains(domains),
  });
  sourceRecords.push({
    ...SOURCES.misinformationDomains,
    records: await collectMisinformationDomains(domains),
  });
  sourceRecords.push({
    ...SOURCES.disinformationDomains,
    records: await collectDisinformationDomains(domains),
  });
  sourceRecords.push(await applyAuthorityOverrides(domains));

  const domainEntries = Object.fromEntries(
    [...domains.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
  const payload = {
    version: 1,
    generated_at: new Date().toISOString(),
    sources: sourceRecords,
    domain_count: Object.keys(domainEntries).length,
    domains: domainEntries,
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const js = `// Generated by scripts/update-source-authority.js. Do not edit by hand.\nexport const GENERATED_SOURCE_AUTHORITY = ${JSON.stringify(payload)};\n`;

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(JSON_OUTPUT, json);
  await writeFile(JS_OUTPUT, js);

  console.log(
    `Wrote ${payload.domain_count} generated source authority domains to data/`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
