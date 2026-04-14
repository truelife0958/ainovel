"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { buildProjectWorkspaceRowFocus } from "@/lib/projects/focus.js";
import type { ProjectWorkspace } from "@/types/project";

type ProjectWorkspacePanelProps = {
  initialWorkspace: ProjectWorkspace;
};

type CreateProjectForm = {
  title: string;
  folderName: string;
  genre: string;
  targetWords: string;
  targetChapters: string;
  targetReader: string;
};

const emptyForm: CreateProjectForm = {
  title: "",
  folderName: "",
  genre: "",
  targetWords: "500000",
  targetChapters: "120",
  targetReader: "通用网文读者",
};

export function ProjectWorkspacePanel({ initialWorkspace }: ProjectWorkspacePanelProps) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<ProjectWorkspace>(initialWorkspace);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateField(field: keyof CreateProjectForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          setMessage(payload.error || "创建项目失败");
          return;
        }

        setWorkspace(payload.data.workspace);
        setForm(emptyForm);
        setMessage(`已创建并切换到《${payload.data.project.title}》`);
        router.refresh();
      } catch {
        setMessage("网络错误，创建项目失败，请重试。");
      }
    });
  }

  function handleSwitch(projectId: string) {
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/projects/current", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ projectId }),
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          setMessage(payload.error || "切换项目失败");
          return;
        }

        setWorkspace(payload.data.workspace);
        setMessage(`当前项目已切换为《${payload.data.project.title}》`);
        router.refresh();
      } catch {
        setMessage("网络错误，切换项目失败，请重试。");
      }
    });
  }

  return (
    <div className="workspace-grid workspace-grid--projects">
      <div className="list-card">
        <p className="eyebrow">项目工作区</p>
        <div className="project-list">
          {workspace.projects.length ? (
            workspace.projects.map((project) => {
              const isCurrent = workspace.currentProjectId === project.id;
              const projectFocus = buildProjectWorkspaceRowFocus(project);

              return (
                <article key={project.id} className="project-row">
                  <div>
                    <div className="row-head">
                      <strong>{project.title}</strong>
                      {isCurrent ? (
                        <span className="status-chip active">当前项目</span>
                      ) : null}
                    </div>
                    <p className="muted">{projectFocus.progressLabel}</p>
                    <p className="muted">{projectFocus.directoryLabel}</p>
                  </div>
                  <button
                    type="button"
                    className="action-button secondary"
                    onClick={() => handleSwitch(project.id)}
                    disabled={isPending || isCurrent}
                  >
                    {isCurrent ? "已选中" : "切换"}
                  </button>
                </article>
              );
            })
          ) : (
            <EmptyState
              variant="card"
              message="还没有检测到兼容项目。可以先在右侧创建一个。"
            />
          )}
        </div>
      </div>

      <form className="list-card form-card" onSubmit={handleCreate}>
        <p className="eyebrow">创建兼容项目</p>
        <div className="form-grid">
          <label>
            <span>作品标题</span>
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="例如：灰雾账本"
              required
            />
          </label>
          <label>
            <span>目录名</span>
            <input
              value={form.folderName}
              onChange={(event) => updateField("folderName", event.target.value)}
              placeholder="可留空，默认跟随标题"
            />
          </label>
          <label>
            <span>题材方向</span>
            <input
              value={form.genre}
              onChange={(event) => updateField("genre", event.target.value)}
              placeholder="都市脑洞 / 玄幻升级 / 规则怪谈"
            />
          </label>
          <label>
            <span>目标读者</span>
            <input
              value={form.targetReader}
              onChange={(event) => updateField("targetReader", event.target.value)}
              placeholder="通用网文读者"
            />
          </label>
          <label>
            <span>目标字数</span>
            <input
              type="number"
              min="0"
              value={form.targetWords}
              onChange={(event) => updateField("targetWords", event.target.value)}
            />
          </label>
          <label>
            <span>目标章节</span>
            <input
              type="number"
              min="0"
              value={form.targetChapters}
              onChange={(event) => updateField("targetChapters", event.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="action-button" disabled={isPending}>
            {isPending
              ? "处理中..."
              : "创建并设为当前项目"}
          </button>
          <p className="muted">
            {message || "会生成兼容目录和基础项目文件。"}
          </p>
        </div>
      </form>
    </div>
  );
}
