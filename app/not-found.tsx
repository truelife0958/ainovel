import Link from "next/link";

export default function NotFound() {
  return (
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
      <h1 style={{ fontSize: "48px", marginBottom: "8px", opacity: 0.2 }}>
        404
      </h1>
      <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>
        页面不存在
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
        你访问的页面可能已被移动或删除。
      </p>
      <Link
        href="/projects"
        style={{
          padding: "12px 24px",
          borderRadius: "999px",
          border: "1px solid #8f3f2d",
          background: "#8f3f2d",
          color: "#fff9f5",
          textDecoration: "none",
          fontSize: "15px",
        }}
      >
        返回项目
      </Link>
    </div>
  );
}
