function pruneUndefined(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key] = entry;
    }
  }

  return result;
}

function write(level, event, fields = {}, error, runtimeContext) {
  const request = runtimeContext?.request;
  const url = request ? new URL(request.url) : null;
  const payload = pruneUndefined({
    level,
    event,
    request_id: request?.headers?.get("cf-ray") || fields.request_id,
    method: request?.method,
    path: url?.pathname,
    ...fields,
  });

  if (level === "error") {
    console.error(JSON.stringify(payload), error || "");
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload), error || "");
    return;
  }

  console.log(JSON.stringify(payload), error || "");
}

export function logInfo(event, fields = {}, runtimeContext) {
  write("info", event, fields, undefined, runtimeContext);
}

export function logWarn(event, fields = {}, error, runtimeContext) {
  write("warn", event, fields, error, runtimeContext);
}

export function logError(event, fields = {}, error, runtimeContext) {
  write("error", event, fields, error, runtimeContext);
}
