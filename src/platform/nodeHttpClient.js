import { Impit } from "impit/index.js";

const impitClients = new Map();

function isNodeRuntime() {
  return typeof process !== "undefined" && !!process.versions?.node;
}

function isPatchedFetch(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    return false;
  }

  return !/\[native code\]/.test(Function.prototype.toString.call(fetchImpl));
}

function normalizeClientMode(value) {
  const mode = String(value || "auto").trim().toLowerCase();
  if (mode === "fetch" || mode === "impit") {
    return mode;
  }
  return "auto";
}

function resolveBrowserProfile(profile) {
  const profileId = String(profile?.id || "").toLowerCase();

  if (profileId.startsWith("firefox")) {
    return "firefox144";
  }

  return "chrome136";
}

function buildClientKey({ browser, proxyUrl, ignoreTlsErrors }) {
  return JSON.stringify({
    browser,
    proxyUrl: proxyUrl || "",
    ignoreTlsErrors: !!ignoreTlsErrors,
  });
}

function getImpitClient({ profile } = {}) {
  const browser = resolveBrowserProfile(profile);
  const proxyUrl = process.env.SEARCH_MCP_PROXY_URL || "";
  const ignoreTlsErrors = ["1", "true", "yes", "on"].includes(
    String(process.env.SEARCH_MCP_IGNORE_TLS_ERRORS || "").trim().toLowerCase()
  );
  const key = buildClientKey({ browser, proxyUrl, ignoreTlsErrors });

  if (!impitClients.has(key)) {
    impitClients.set(
      key,
      new Impit({
        browser,
        proxyUrl: proxyUrl || undefined,
        ignoreTlsErrors,
        followRedirects: true,
        vanillaFallback: false,
        timeout: Number.parseInt(process.env.SEARCH_MCP_UPSTREAM_TIMEOUT_MS || "15000", 10),
      })
    );
  }

  return impitClients.get(key);
}

function normalizeRequestInit(init = {}) {
  const normalized = { ...init };

  if (normalized.headers instanceof Headers) {
    normalized.headers = Object.fromEntries(normalized.headers.entries());
  }

  delete normalized.referrer;
  return normalized;
}

export async function fetchWithOptionalCurlImpersonate(
  url,
  init = {},
  { profile } = {}
) {
  const clientMode = normalizeClientMode(process.env.SEARCH_MCP_UPSTREAM_CLIENT);
  const shouldUseImpit =
    clientMode !== "fetch" &&
    isNodeRuntime() &&
    !isPatchedFetch(globalThis.fetch);

  if (!shouldUseImpit) {
    return fetch(url, init);
  }

  try {
    const client = getImpitClient({ profile });
    return await client.fetch(url, normalizeRequestInit(init));
  } catch (error) {
    if (clientMode === "impit") {
      throw error;
    }

    return fetch(url, init);
  }
}
