import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-page">
      <h1>404</h1>
      <h2>页面不存在</h2>
      <p>你访问的页面可能已被移动或删除。</p>
      <Link href="/" className="error-page-action">
        返回首页
      </Link>
    </div>
  );
}
