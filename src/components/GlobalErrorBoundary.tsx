import React from "react";
import { normalizeRuntimeError } from "../services/runtimeErrorUtils";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class GlobalErrorBoundary extends React.Component<
  Props,
  State
> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(
    error: Error
  ): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(
    error: Error,
    info: React.ErrorInfo
  ) {
    const normalized =
      normalizeRuntimeError(error);

    console.error("[REACT_RENDER_ERROR]", {
      message: normalized.message,
      stack: normalized.stack,
      componentStack: info.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          margin: 24,
          padding: 24,
          border: "1px solid #ef4444",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h2>Application Runtime Error</h2>

        <p>
          حدث خطأ حقيقي أثناء عرض أحد مكونات
          التطبيق.
        </p>

        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {this.state.error?.message}
        </pre>

        <button
          type="button"
          onClick={this.handleRetry}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }
}
