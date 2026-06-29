import { logWarn } from "./logger.js";

export function runDeferredTask(runtimeContext, label, task) {
  const runner = Promise.resolve()
    .then(task)
    .catch((error) => {
      logWarn("task.background_failed", { task: label }, error, runtimeContext);
    });

  const executionCtx = runtimeContext?.executionCtx;
  if (executionCtx && typeof executionCtx.waitUntil === "function") {
    executionCtx.waitUntil(runner);
    return Promise.resolve();
  }

  return runner;
}
