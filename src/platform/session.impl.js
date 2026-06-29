import { getStateKv } from "./stateKv.js";

const SESSION_PREFIX = "session:v1";
const SESSION_TTL_SECONDS = 86400; // 24 hours
const SESSION_COOKIE_NAME = "search_mcp_sid";

// In-memory fallback when KV is unavailable
const memorySessions = new Map();
let lastPruneTime = 0;
const PRUNE_INTERVAL_SECONDS = 3600; // Prune every hour

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function pruneMemorySessions() {
  const now = nowSeconds();
  if (now - lastPruneTime < PRUNE_INTERVAL_SECONDS) return;
  lastPruneTime = now;

  if (memorySessions.size < 100) return;

  for (const [key, entry] of memorySessions.entries()) {
    if (entry.expiresAt <= now) {
      memorySessions.delete(key);
    }
  }
}

function generateSessionId() {
  return crypto.randomUUID();
}

function kvKey(sessionId) {
  return `${SESSION_PREFIX}:${sessionId}`;
}

export function resetSessionState() {
  memorySessions.clear();
}

/**
 * Extract session ID from request cookies.
 */
export function getSessionIdFromRequest(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;)\\s*${SESSION_COOKIE_NAME}\\s*=\\s*([^;]+)`)
  );
  return match ? match[1].trim() : null;
}

/**
 * Build Set-Cookie header value for the session.
 */
export function buildSessionCookie(sessionId, { secure = true } = {}) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/**
 * Load session data from KV or memory fallback.
 */
async function loadSession(sessionId) {
  pruneMemorySessions();

  const kv = getStateKv();

  if (kv) {
    try {
      const data = await kv.get(kvKey(sessionId), "json");
      return data;
    } catch (_) {
      // Fall through to memory
    }
  }

  const mem = memorySessions.get(sessionId);
  if (!mem) return null;
  if (mem.expiresAt <= nowSeconds()) {
    memorySessions.delete(sessionId);
    return null;
  }
  return mem.data;
}

/**
 * Save session data to KV or memory fallback.
 */
async function saveSession(sessionId, data) {
  const kv = getStateKv();

  if (kv) {
    try {
      await kv.put(kvKey(sessionId), JSON.stringify(data), {
        expirationTtl: SESSION_TTL_SECONDS,
      });
      return;
    } catch (_) {
      // Fall through to memory
    }
  }

  memorySessions.set(sessionId, {
    data,
    expiresAt: nowSeconds() + SESSION_TTL_SECONDS,
  });
}

/**
 * Delete session from KV or memory.
 */
async function deleteSession(sessionId) {
  const kv = getStateKv();

  if (kv) {
    try {
      await kv.delete(kvKey(sessionId));
      return;
    } catch (_) {
      // Fall through
    }
  }

  memorySessions.delete(sessionId);
}

/**
 * Validate and refresh a session.
 * Returns { valid, sessionId, setCookie } where setCookie is the updated
 * Set-Cookie header value (to extend Max-Age) or null.
 */
export async function validateSession(request) {
  const sessionId = getSessionIdFromRequest(request);

  if (!sessionId) {
    return { valid: false, sessionId: null, setCookie: null };
  }

  const session = await loadSession(sessionId);

  if (!session) {
    return { valid: false, sessionId: null, setCookie: null };
  }

  // Sliding window: update lastUsed
  const now = nowSeconds();
  session.lastUsed = now;
  await saveSession(sessionId, session);

  // Determine if the request is HTTPS (for Secure cookie attribute)
  const url = new URL(request.url);
  const secure = url.protocol === "https:";

  return {
    valid: true,
    sessionId,
    setCookie: buildSessionCookie(sessionId, { secure }),
  };
}

/**
 * Create a new session and return { sessionId, setCookie }.
 */
export async function createSession(request) {
  const sessionId = generateSessionId();
  const now = nowSeconds();

  await saveSession(sessionId, {
    createdAt: now,
    lastUsed: now,
    requestCount: 0,
  });

  const url = new URL(request.url);
  const secure = url.protocol === "https:";

  return {
    sessionId,
    setCookie: buildSessionCookie(sessionId, { secure }),
  };
}

/**
 * Revoke a session (logout / invalidate).
 */
export async function revokeSession(sessionId) {
  await deleteSession(sessionId);
}
