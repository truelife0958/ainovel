"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Dropdown } from "@/components/ui/dropdown";
import type { ProjectWorkspace } from "@/types/project";

type ProjectDropdownProps = {
  currentProjectTitle: string;
  currentProjectSubtitle: string;
  onManageProjects: () => void;
};

export function ProjectDropdown({
  currentProjectTitle,
  currentProjectSubtitle,
  onManageProjects,
}: ProjectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (open && !workspace) {
      const controller = new AbortController();
      setError(false);
      fetch("/api/projects", { signal: controller.signal })
        .then((r) => r.json())
        .then((payload) => {
          if (payload.ok) setWorkspace(payload.data);
          else setError(true);
        })
        .catch((e) => { if (e.name !== "AbortError") setError(true); });
      return () => controller.abort();
    }
  }, [open, workspace]);

  function handleSwitch(projectId: string) {
    setSwitching(projectId);
    fetch("/api/projects/current", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) {
          setOpen(false);
          setWorkspace(null);
          router.refresh();
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setSwitching(null));
  }

  const projects = workspace?.projects ?? [];

  return (
    <Dropdown
      open={open}
      onClose={() => setOpen(false)}
      align="left"
      trigger={
        <button
          type="button"
          className="toolbar-project-trigger"
          onClick={() => setOpen(!open)}
        >
          <div>
            <div className="toolbar-project-title">{currentProjectTitle}</div>
            <div className="toolbar-project-subtitle">{currentProjectSubtitle}</div>
          </div>
          <span className="toolbar-project-arrow">&#9662;</span>
        </button>
      }
    >
      {error && (
        <div className="dropdown-item" style={{ color: "var(--error-text)", fontSize: 13 }}>
          加载失败，请关闭后重试
        </div>
      )}
      {projects.map((project) => {
        const isCurrent = project.id === workspace?.currentProjectId;
        return (
          <button
            key={project.id}
            type="button"
            className={`dropdown-item${isCurrent ? " active" : ""}`}
            disabled={isCurrent || switching === project.id}
            onClick={() => !isCurrent && handleSwitch(project.id)}
          >
            <div className="dropdown-project-info">
              <strong className="dropdown-project-title">{project.title}</strong>
              <p className="dropdown-project-subtitle">
                {project.genre} · 第 {project.currentChapter} 章
              </p>
            </div>
            {isCurrent && <span className="dropdown-project-badge">当前</span>}
            {switching === project.id && <span className="dropdown-project-switching">切换中...</span>}
          </button>
        );
      })}
      <div className="dropdown-divider" />
      <button
        type="button"
        className="dropdown-item"
        onClick={() => { setOpen(false); onManageProjects(); }}
      >
        <span className="dropdown-manage-link">+ 管理项目…</span>
      </button>
    </Dropdown>
  );
}
