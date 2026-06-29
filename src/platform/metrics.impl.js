function getStore(runtimeContext) {
  if (!runtimeContext) {
    return null;
  }

  if (!runtimeContext.metrics) {
    runtimeContext.metrics = {
      counters: [],
      timings: [],
    };
  }

  return runtimeContext.metrics;
}

export function recordMetric(runtimeContext, name, fields = {}) {
  const store = getStore(runtimeContext);
  if (!store) {
    return;
  }

  store.counters.push({
    name,
    ...fields,
  });
}

export function recordTiming(runtimeContext, name, durationMs, fields = {}) {
  const store = getStore(runtimeContext);
  if (!store) {
    return;
  }

  store.timings.push({
    name,
    duration_ms: durationMs,
    ...fields,
  });
}

export function readRecordedMetrics(runtimeContext) {
  return runtimeContext?.metrics || { counters: [], timings: [] };
}
