import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { initializeRuntimeErrorGuard } from "./services/runtimeErrorGuard";
import {
  initializeRuntimeOriginProbe,
  clearRuntimeProbe,
} from "./services/runtimeOriginProbe";
import "./index.css";

clearRuntimeProbe();
initializeRuntimeOriginProbe();

// Force unregister of old Service Workers to clear aggressive caching
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then(
        (success) => console.log('SW unregistered:', success)
      );
    }
  });
}

// Force clear Cache Storage so old files aren't served
if ('caches' in window) {
  caches.keys().then((names) => {
    for (const name of names) {
      caches.delete(name).then(
        (success) => console.log('Cache cleared:', name, success)
      );
    }
  });
}
initializeRuntimeErrorGuard();

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    'Root element "#root" was not found.'
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
);
