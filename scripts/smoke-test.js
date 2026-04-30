#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 15000;

function getBaseUrl() {
  const value =
    process.argv[2] || process.env.SMOKE_BASE_URL || process.env.CF_SEARCH_URL;

  if (!value) {
    throw new Error(
      "Provide a target URL as an argument or set SMOKE_BASE_URL/CF_SEARCH_URL"
    );
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getToken() {
  return process.env.SMOKE_TOKEN || process.env.CF_SEARCH_TOKEN || process.env.TOKEN || "";
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`Expected JSON response, got: ${text.slice(0, 200)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function smokeRequest({ baseUrl, path, token, expectJson = true }) {
  const headers = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    headers,
  });

  assert(
    response.ok,
    `${path} returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`
  );

  if (!expectJson) {
    return null;
  }

  return readJsonResponse(response);
}

async function main() {
  const baseUrl = getBaseUrl();
  const token = getToken();

  console.log(`Smoke target: ${baseUrl}`);

  await smokeRequest({
    baseUrl,
    path: "/",
    token: "",
    expectJson: false,
  });
  console.log("ok /");

  if (!token) {
    console.warn(
      "No SMOKE_TOKEN/CF_SEARCH_TOKEN/TOKEN provided; skipped protected endpoint checks."
    );
    return;
  }

  const auth = await smokeRequest({
    baseUrl,
    path: "/auth/verify",
    token,
  });
  assert(auth.authorized === true, "/auth/verify did not confirm authorization");
  console.log("ok /auth/verify");

  const search = await smokeRequest({
    baseUrl,
    path: "/search?q=cloudflare&location=off&min_authority_score=-100",
    token,
  });
  assert(search.query === "cloudflare", "/search returned an unexpected query");
  assert(Array.isArray(search.results), "/search did not return results array");
  console.log(`ok /search (${search.number_of_results} results)`);

  const research = await smokeRequest({
    baseUrl,
    path:
      "/research?q=cloudflare&location=off&limit=1&excerpt_chars=200&max_bytes=50000&min_authority_score=-100",
    token,
  });
  assert(Array.isArray(research.sources), "/research did not return sources");
  console.log(
    `ok /research (${research.read_count} read, ${research.failed_count} failed, ${research.skipped_count} skipped)`
  );

  const content = await smokeRequest({
    baseUrl,
    path: "/content?url=https%3A%2F%2Fexample.com%2F&max_bytes=50000",
    token,
  });
  assert(content.source === "direct-fetch", "/content returned unexpected source");
  console.log(`ok /content (${content.stats?.text_length || 0} chars)`);
}

main().catch((error) => {
  console.error(`Smoke failed: ${error.message}`);
  process.exit(1);
});
