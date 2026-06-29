export function normalizePositiveInteger(value, fallback, { min = 1, max } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }

  if (max !== undefined && parsed > max) {
    return max;
  }

  return parsed;
}
