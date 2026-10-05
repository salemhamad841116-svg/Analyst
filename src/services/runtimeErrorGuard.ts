import {
  isIgnorableRuntimeError,
  normalizeRuntimeError,
} from "./runtimeErrorUtils";

const GUARD_KEY = "__USE_RUNTIME_ERROR_GUARD_ACTIVE__";

type GuardedWindow = Window & {
  [GUARD_KEY]?: boolean;
};

export function initializeRuntimeErrorGuard() {
  const guardedWindow = window as GuardedWindow;

  // Important with Vite HMR:
  // prevent registering duplicate listeners.
  if (guardedWindow[GUARD_KEY]) {
    return;
  }

  guardedWindow[GUARD_KEY] = true;

  window.addEventListener("error", (event) => {
    const candidate =
      event.error ??
      event.message ??
      "Unknown window error";

    if (
      isIgnorableRuntimeError(
        candidate,
        event.filename
      )
    ) {
      // Do NOT use console.error here.
      console.debug(
        "[IGNORED_EXTERNAL_RUNTIME_EVENT]",
        event.message
      );

      event.preventDefault();
      return;
    }

    const error = normalizeRuntimeError(candidate);

    // This is a genuine app/runtime error.
    console.error("[APP_WINDOW_ERROR]", {
      message: error.message,
      stack: error.stack,
      file: event.filename,
      line: event.lineno,
      column: event.colno,
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = event.reason;

      if (isIgnorableRuntimeError(reason)) {
        console.debug(
          "[IGNORED_EXTERNAL_PROMISE_REJECTION]",
          normalizeRuntimeError(reason).message
        );

        event.preventDefault();
        return;
      }

      const error = normalizeRuntimeError(reason);

      console.error(
        "[APP_UNHANDLED_PROMISE_REJECTION]",
        {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        }
      );
    }
  );
}
