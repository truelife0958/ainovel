"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/modal";
import { ProjectWorkspacePanel } from "@/components/project-workspace-panel";
import type { ProjectWorkspace } from "@/types/project";

type ProjectsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ProjectsModal({ open, onClose }: ProjectsModalProps) {
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setWorkspace(null);
    setLoading(true);
    setError(false);
    fetch("/api/projects", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) setWorkspace(payload.data);
        else setError(true);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open]);

  function handleRetry() {
    setError(false);
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) setWorkspace(payload.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  function handleClose() {
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={handleClose} title="项目管理" eyebrow="创建、切换与管理作品" variant="wide">
      {loading ? (
        <div className="modal-loading">
          <span className="ai-spinner" />{" "}
          <p className="muted">加载中…</p>
        </div>
      ) : error ? (
        <div className="modal-loading">
          <p className="modal-error">无法加载项目列表。</p>
          <button type="button" className="action-button compact" onClick={handleRetry}>重试</button>
        </div>
      ) : workspace ? (
        <ProjectWorkspacePanel initialWorkspace={workspace} />
      ) : null}
    </Modal>
  );
}
