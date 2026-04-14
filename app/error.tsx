"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "40px 20px",
      }}
    >
      <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>
        页面出现了问题
      </h2>
      <p
        style={{
          color: "#6c6257",
          maxWidth: "480px",
          textAlign: "center",
          lineHeight: 1.6,
          marginBottom: "24px",
        }}
      >
        {error.message || "发生了意外错误，请尝试刷新页面。"}
      </p>
      <button
        onClick={reset}
        className="action-button"
        style={{
          padding: "12px 24px",
          borderRadius: "999px",
          border: "1px solid #8f3f2d",
          background: "#8f3f2d",
          color: "#fff9f5",
          cursor: "pointer",
          font: "inherit",
          fontSize: "15px",
        }}
      >
        重试
      </button>
    </div>
  );
}
