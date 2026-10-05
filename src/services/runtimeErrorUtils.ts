export type RuntimeErrorInfo = {
  message: string;
  stack?: string;
  source?: string;
};

export function normalizeRuntimeError(
  error: unknown
): RuntimeErrorInfo {
  if (error instanceof Error) {
    return {
      message: error.message || error.name,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  try {
    return {
      message: JSON.stringify(error),
    };
  } catch {
    return {
      message: "Unknown runtime error",
    };
  }
}

export function isIgnorableRuntimeError(
  error: unknown,
  source?: string
): boolean {
  const normalized = normalizeRuntimeError(error);

  const message = normalized.message.toLowerCase();
  const src = (source ?? "").toLowerCase();

  // Browser extensions are outside the app.
  if (
    src.startsWith("moz-extension://") ||
    src.startsWith("chrome-extension://") ||
    src.startsWith("safari-web-extension://")
  ) {
    return true;
  }

  const extensionPatterns = [
    "extension context invalidated",
    "receiving end does not exist",
    "could not establish connection",
  ];

  if (
    extensionPatterns.some((pattern) =>
      message.includes(pattern)
    )
  ) {
    return true;
  }

  // ResizeObserver browser noise.
  const resizeObserverPatterns = [
    "resizeobserver loop limit exceeded",
    "resizeobserver loop completed with undelivered notifications",
  ];

  if (
    resizeObserverPatterns.some((pattern) =>
      message.includes(pattern)
    )
  ) {
    return true;
  }

  // Ignore Vite/HMR network noise ONLY in development.
  if (import.meta.env.DEV) {
    const hmrPatterns = [
      "[vite] failed to connect to websocket",
      "failed to connect to websocket",
      "hmr connection",
      "vite client",
    ];

    if (
      hmrPatterns.some((pattern) =>
        message.includes(pattern)
      )
    ) {
      return true;
    }
  }

  return false;
}
