import { env } from "../../envs.js";
import { ApiError } from "../core/errors.js";
import { validateSession, getSessionIdFromRequest } from "./session.js";
import { enforceRateLimit } from "./rateLimit.js";

function matchesConfigSet(value, allowedValues) {
  return allowedValues.includes(
    String(value || "").trim().toLowerCase()
  );
}

const TRUTHY_CONFIG_VALUES = ["1", "true", "yes", "on", "required"];

function getBearerToken(request) {
  return request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
}

function getRequestToken(request, paramToken) {
  return getBearerToken(request) || request.headers.get("x-api-key") || paramToken;
}

function isAuthRequired() {
  return !!env.TOKEN || isTruthyConfig(env.AUTH_REQUIRED);
}

function isTruthyConfig(value) {
  return matchesConfigSet(value, TRUTHY_CONFIG_VALUES);
}

function isAuthorizedToken(requestToken) {
  if (!isAuthRequired()) {
    return true;
  }
  return !!env.TOKEN && requestToken === env.TOKEN;
}

/**
 * Unified authentication: checks token OR session cookie.
 * Returns { authenticated, method } where method is 'token', 'session', or 'none'.
 */
export async function authenticateRequest(request, params = {}) {
  // If auth is not required at all, allow immediately
  if (!isAuthRequired()) {
    return { authenticated: true, method: "none" };
  }

  // 1. Check token auth (Authorization header, x-api-key header, or query param)
  const requestToken = getRequestToken(request, params.token);
  if (requestToken && isAuthorizedToken(requestToken)) {
    return { authenticated: true, method: "token", token: requestToken };
  }

  // 2. Check session cookie
  const sessionResult = await validateSession(request);
  if (sessionResult.valid) {
    return {
      authenticated: true,
      method: "session",
      sessionId: sessionResult.sessionId,
      setCookie: sessionResult.setCookie,
    };
  }

  // 3. Not authenticated - fail closed if AUTH_REQUIRED but no TOKEN configured
  if (isTruthyConfig(env.AUTH_REQUIRED) && !env.TOKEN) {
    throw new ApiError({
      status: 503,
      code: "AUTH_TOKEN_NOT_CONFIGURED",
      category: "configuration",
      message:
        "AUTH_REQUIRED is enabled but TOKEN is not configured. Set TOKEN before using protected local MCP flows.",
    });
  }

  return { authenticated: false, method: "none" };
}

/**
 * Get the rate limit key based on auth method.
 */
export function getRateLimitKey(authResult) {
  if (authResult.method === "token") {
    return authResult.token;
  }
  if (authResult.method === "session" && authResult.sessionId) {
    return `session:${authResult.sessionId}`;
  }
  // For unauthenticated, use null (IP-based rate limiting)
  return null;
}

export function getRequestClientId(request, authResult, paramToken) {
  if (authResult?.method === "session" && authResult.sessionId) {
    return `session:${authResult.sessionId}`;
  }

  if (authResult?.method === "token" && authResult.token) {
    return `token:${authResult.token}`;
  }

  const requestToken = getRequestToken(request, paramToken);
  if (requestToken && isAuthorizedToken(requestToken)) {
    return `token:${requestToken}`;
  }

  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) {
    return `session:${sessionId}`;
  }

  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "anonymous";

  return `ip:${clientIp}`;
}

/**
 * Get rate limit token for pre-auth rate limiting.
 * Returns the token if valid, session ID if cookie present, otherwise null (IP-based).
 * Fix #7: Session users get their own bucket, not shared with unauthenticated IP users.
 */
export function getRateLimitToken(request, paramToken) {
  if (!isAuthRequired()) {
    return null;
  }

  const requestToken = getRequestToken(request, paramToken);
  if (requestToken && isAuthorizedToken(requestToken)) {
    return requestToken;
  }

  // Peek at session cookie without KV validation - gives session users
  // their own rate limit bucket so they don't share with unauthenticated IPs
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) {
    return `session:${sessionId}`;
  }

  return null;
}

/**
 * Fix #8: Unified auth+rate-limit helper to eliminate boilerplate duplication.
 * Rate limits first (prevents brute force), then authenticates.
 * Returns authResult or throws 401/429.
 */
export async function requireAuth(request, params = {}) {
  await enforceRateLimit(request, getRateLimitToken(request, params.token));

  const authResult = await authenticateRequest(request, params);

  if (!authResult.authenticated) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      category: "auth",
      message: "Authentication required. Provide a valid token or session cookie.",
    });
  }

  return authResult;
}

export { isAuthRequired, isTruthyConfig, matchesConfigSet, getRequestToken, isAuthorizedToken };
