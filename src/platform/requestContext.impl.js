export function createRuntimeContext(request, executionCtx) {
  return {
    request,
    executionCtx,
    metrics: {
      counters: [],
      timings: [],
    },
  };
}
