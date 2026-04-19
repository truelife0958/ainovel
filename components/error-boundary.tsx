"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: (info: { errorId: string; retry: () => void }) => ReactNode;
};

type State = { errorId: string | null };

/**
 * Top-level error boundary that surfaces an errorId the user can copy
 * into a bug report. A custom fallback renderer can be passed via the
 * `fallback` prop; otherwise a default Chinese message is shown.
 *
 * This is intentionally a class component — React still requires class
 * components for catching render errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { errorId: null };

  static getDerivedStateFromError(): State {
    // errorId is generated in componentDidCatch where we have access to
    // both the error and info; for now just mark the boundary as tripped.
    return { errorId: "__pending__" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const errorId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.setState({ errorId });
    if (typeof console !== "undefined" && typeof console.error === "function") {
      // Tier 3 will replace with structured logger; for now keep it visible.
      console.error("[ErrorBoundary]", errorId, error, info.componentStack);
    }
  }

  retry = () => this.setState({ errorId: null });

  render() {
    const { errorId } = this.state;
    if (errorId) {
      const displayId = errorId === "__pending__" ? "(生成中)" : errorId;
      if (this.props.fallback) {
        return this.props.fallback({ errorId: displayId, retry: this.retry });
      }
      return (
        <div className="error-boundary-fallback" role="alert">
          <h3>出错了</h3>
          <p>页面渲染遇到异常。你可以点击下方按钮重试，或复制错误 ID 反馈问题。</p>
          <div className="error-boundary-actions">
            <button type="button" onClick={this.retry}>重试</button>
            <button
              type="button"
              onClick={() => {
                const nav = typeof navigator !== "undefined" ? navigator : null;
                nav?.clipboard?.writeText?.(displayId);
              }}
            >复制错误 ID</button>
          </div>
          <code>{displayId}</code>
        </div>
      );
    }
    return this.props.children;
  }
}
