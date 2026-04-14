export default function Loading() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="eyebrow">Webnovel Writer</p>
          <h1>创作台</h1>
        </div>
      </aside>
      <main className="content">
        <header className="page-header">
          <div>
            <p className="eyebrow" style={{ opacity: 0.3 }}>
              加载中
            </p>
            <h2 style={{ opacity: 0.2 }}>正在加载...</h2>
          </div>
        </header>
        <div className="workspace-grid">
          <div
            className="editor-card"
            style={{ minHeight: "200px", opacity: 0.15 }}
          />
          <div
            className="editor-card"
            style={{ minHeight: "200px", opacity: 0.1 }}
          />
        </div>
      </main>
    </div>
  );
}
