"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "40px 20px",
            fontFamily: "Georgia, serif",
            background: "#f3efe6",
            color: "#1e1a15",
          }}
        >
          <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>
            页面出现了问题
          </h1>
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
      </body>
    </html>
  );
}
