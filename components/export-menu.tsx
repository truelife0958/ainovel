"use client";

import { useEffect, useRef, useState } from "react";

type ExportMenuProps = {
  currentChapterFileName?: string;
  disabled?: boolean;
};

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ExportMenu({ currentChapterFileName, disabled }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function downloadCurrent() {
    if (!currentChapterFileName) return;
    const url = `/api/projects/current/export?format=md&file=${encodeURIComponent(currentChapterFileName)}`;
    triggerDownload(url);
    setOpen(false);
  }

  function downloadAll() {
    triggerDownload(`/api/projects/current/export?format=txt-all`);
    setOpen(false);
  }

  return (
    <div className="export-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >导出 ▾</button>
      {open && (
        <div className="export-menu-popup" role="menu">
          <button
            type="button"
            role="menuitem"
            className="export-menu-item"
            onClick={downloadCurrent}
            disabled={!currentChapterFileName}
            title={currentChapterFileName ? `导出 ${currentChapterFileName}` : "请先选择一个章节"}
          >当前章节 (.md)</button>
          <button
            type="button"
            role="menuitem"
            className="export-menu-item"
            onClick={downloadAll}
          >全部章节合并 (.txt)</button>
        </div>
      )}
    </div>
  );
}
