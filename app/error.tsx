"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-page">
      <h1>!</h1>
      <h2>页面出现了问题</h2>
      <p>{error.message || "发生了意外错误，请尝试刷新页面。"}</p>
      <button onClick={reset} className="error-page-action">
        重试
      </button>
    </div>
  );
}
