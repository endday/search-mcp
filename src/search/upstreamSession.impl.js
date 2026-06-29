import { env } from "../../envs.js";
import { sha256Hex } from "../core/crypto.js";
import { getStateKv, normalizeExpirationTtl } from "../platform/stateKv.js";

const UPSTREAM_SESSION_PREFIX = "upstream-session:v1";
const memoryState = new Map();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function buildMemoryKey(clientId, engine) {
  return `${clientId}:${engine}`;
}

async function buildKvKey(clientId, engine) {
  return `${UPSTREAM_SESSION_PREFIX}:${await sha256Hex(`${clientId}:${engine}`)}`;
}

function pickStableIndex(seed, size) {
  if (!size || size < 1) {
    return 0;
  }

  let hash = 0;
  const value = String(seed || "default");
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash % size;
}

export function resetUpstreamSessionState() {
  memoryState.clear();
}

async function loadFromKv(clientId, engine) {
  const kv = getStateKv();
  if (!kv) {
    return null;
  }

  try {
    return await kv.get(await buildKvKey(clientId, engine), "json");
  } catch (_) {
    return null;
  }
}

async function saveToKv(clientId, engine, value) {
  const kv = getStateKv();
  if (!kv) {
    return false;
  }

  try {
    await kv.put(await buildKvKey(clientId, engine), JSON.stringify(value), {
      expirationTtl: normalizeExpirationTtl(env.UPSTREAM_SESSION_TTL_SECONDS, 3600),
    });
    return true;
  } catch (_) {
    return false;
  }
}

function loadFromMemory(clientId, engine) {
  const record = memoryState.get(buildMemoryKey(clientId, engine));
  if (!record) {
    return null;
  }

  if (record.expiresAt <= nowSeconds()) {
    memoryState.delete(buildMemoryKey(clientId, engine));
    return null;
  }

  return record.value;
}

function saveToMemory(clientId, engine, value) {
  memoryState.set(buildMemoryKey(clientId, engine), {
    value,
    expiresAt: nowSeconds() + normalizeExpirationTtl(env.UPSTREAM_SESSION_TTL_SECONDS, 3600),
  });
}

export async function getUpstreamSession(clientId, engine, profiles = []) {
  if (!clientId || !engine || profiles.length === 0) {
    return null;
  }

  const existing = (await loadFromKv(clientId, engine)) || loadFromMemory(clientId, engine);
  if (existing?.profileId) {
    return existing;
  }

  const selectedIndex = pickStableIndex(`${clientId}:${engine}`, profiles.length);
  const selectedProfile = profiles[selectedIndex];
  const created = {
    profileId: selectedProfile.id,
    createdAt: nowSeconds(),
    lastUsedAt: nowSeconds(),
    cookies: {},
  };

  if (!(await saveToKv(clientId, engine, created))) {
    saveToMemory(clientId, engine, created);
  }

  return created;
}

export async function updateUpstreamSession(clientId, engine, patch = {}) {
  if (!clientId || !engine) {
    return null;
  }

  const current =
    (await loadFromKv(clientId, engine)) ||
    loadFromMemory(clientId, engine) || {
      profileId: patch.profileId || "",
      createdAt: nowSeconds(),
      cookies: {},
    };

  const next = {
    ...current,
    ...patch,
    cookies: {
      ...(current.cookies || {}),
      ...(patch.cookies || {}),
    },
    lastUsedAt: nowSeconds(),
  };

  if (!(await saveToKv(clientId, engine, next))) {
    saveToMemory(clientId, engine, next);
  }

  return next;
}

export function createDeferredUpstreamSessionWriter(clientId, engine, patch = {}) {
  return async function writeUpstreamSession() {
    await updateUpstreamSession(clientId, engine, patch);
  };
}
