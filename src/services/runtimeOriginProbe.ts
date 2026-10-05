type RuntimeProbeRecord = {
  id: string;
  type:
    | "WINDOW_ERROR"
    | "UNHANDLED_REJECTION"
    | "RESOURCE_ERROR"
    | "FETCH_ERROR";
  message: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
  timestamp: string;
};

const STORAGE_KEY = "USE_RUNTIME_ORIGIN_PROBE";

function readRecords(): RuntimeProbeRecord[] {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
  } catch {
    return [];
  }
}

function saveRecord(
  record: Omit<RuntimeProbeRecord, "id" | "timestamp">
) {
  const records = readRecords();

  records.push({
    ...record,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(records.slice(-100))
  );
}

export function clearRuntimeProbe() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getRuntimeProbeRecords() {
  return readRecords();
}

export function initializeRuntimeOriginProbe() {
  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;

      // Resource loading errors
      if (
        target instanceof HTMLScriptElement ||
        target instanceof HTMLLinkElement ||
        target instanceof HTMLImageElement
      ) {
        saveRecord({
          type: "RESOURCE_ERROR",
          message: "Resource failed to load",
          source:
            target instanceof HTMLScriptElement
              ? target.src
              : target instanceof HTMLLinkElement
              ? target.href
              : target.src,
        });

        return;
      }

      saveRecord({
        type: "WINDOW_ERROR",
        message:
          event.message ||
          event.error?.message ||
          "Unknown window error",
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack:
          event.error instanceof Error
            ? event.error.stack
            : undefined,
      });
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = event.reason;

      saveRecord({
        type: "UNHANDLED_REJECTION",
        message:
          reason instanceof Error
            ? reason.message
            : String(reason),
        stack:
          reason instanceof Error
            ? reason.stack
            : undefined,
      });
    }
  );
}
