"use client";

import { useEffect, useState } from "react";
import { ProjectDropdown } from "@/components/project-dropdown";
import type { ProjectSummary } from "@/types/project";

type ToolbarProps = {
  project: ProjectSummary | null;
  aiAvailable: boolean;
  zenMode?: boolean;
  onOpenConnection: () => void;
  onOpenIdeation: () => void;
  onOpenReview: () => void;
  onOpenProjects: () => void;
  onOpenBatch: () => void;
  onOpenScaffold: () => void;
  onOpenReference: () => void;
  onToggleZen?: () => void;
};

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.dataset.theme === "dark";
  });

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <button
      type="button"
      className="toolbar-icon-btn"
      onClick={toggle}
      title={dark ? "切换亮色模式" : "切换暗色模式"}
      aria-label={dark ? "切换亮色模式" : "切换暗色模式"}
    >
      {dark ? "\u2600" : "\u263E"}
    </button>
  );
}

export function Toolbar({
  project,
  aiAvailable,
  zenMode,
  onOpenConnection,
  onOpenIdeation,
  onOpenReview,
  onOpenProjects,
  onOpenBatch,
  onOpenScaffold,
  onOpenReference,
  onToggleZen,
}: ToolbarProps) {
  const projectSubtitle = project
    ? `${project.genre} · 第 ${project.currentChapter} 章`
    : "尚未创建项目";

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-brand-name">Webnovel Writer</span>
      </div>

      {project && (
        <ProjectDropdown
          currentProjectTitle={project.title}
          currentProjectSubtitle={projectSubtitle}
          onManageProjects={onOpenProjects}
        />
      )}

      <div className="toolbar-spacer" />

      <button
        type="button"
        className="toolbar-status"
        onClick={onOpenConnection}
        title="AI 连接配置"
      >
        <span className={`connection-dot ${aiAvailable ? "connected" : "disconnected"}`} />
        <span>{aiAvailable ? "AI 就绪" : "AI 未连接"}</span>
      </button>

      {project && (
        <>
          <button type="button" className="toolbar-btn" onClick={onOpenIdeation}>
            立项
          </button>
          <button type="button" className="toolbar-btn" onClick={onOpenReview}>
            审查
          </button>
          {aiAvailable && (
            <>
              <button type="button" className="toolbar-btn" onClick={onOpenReference} title="分析热门小说的结构机制，提炼可复用的创作方法论">
                参考借鉴
              </button>
              <button type="button" className="toolbar-btn" onClick={onOpenScaffold} title="一键生成世界观、主角卡、反派、总纲、卷大纲">
                一键生成
              </button>
              <button type="button" className="toolbar-btn" onClick={onOpenBatch} title="批量生成多个章节">
                批量生成
              </button>
            </>
          )}
        </>
      )}

      {onToggleZen && project && (
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={onToggleZen}
          title={zenMode ? "退出专注模式" : "进入专注模式"}
        >
          {zenMode ? "\u2716" : "\u26F6"}
        </button>
      )}

      <ThemeToggle />

      <button
        type="button"
        className="toolbar-icon-btn"
        onClick={onOpenConnection}
        title="设置"
      >
        &#9881;
      </button>
    </header>
  );
}
