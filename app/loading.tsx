export default function Loading() {
  return (
    <div className="creation-shell">
      {/* Toolbar skeleton */}
      <header className="toolbar">
        <div className="toolbar-brand">
          <span className="toolbar-brand-name">Webnovel Writer</span>
        </div>
        <div className="skeleton skeleton-toolbar-project" />
        <div className="toolbar-spacer" />
        <div className="skeleton skeleton-toolbar-btn" />
        <div className="skeleton skeleton-toolbar-icon" />
        <div className="skeleton skeleton-toolbar-icon" />
        <div className="skeleton skeleton-toolbar-avatar" />
      </header>

      {/* Editor skeleton */}
      <main className="creation-main">
        <div className="creation-editor-area">
          <div className="skeleton skeleton-editor-heading" />
          <div className="skeleton skeleton-editor-body" />
        </div>
      </main>

      {/* Bottom bar skeleton */}
      <div className="bottom-bar">
        <div className="skeleton skeleton-bar-tab" />
        <div className="skeleton skeleton-bar-select" />
        <div className="bottom-bar-spacer" />
        <div className="skeleton skeleton-bar-word" />
        <div className="skeleton skeleton-bar-btn" />
      </div>
    </div>
  );
}
