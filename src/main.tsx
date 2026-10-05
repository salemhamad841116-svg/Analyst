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
