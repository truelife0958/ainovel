"use client";

import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/modal";
import { ProjectWorkspacePanel } from "@/components/project-workspace-panel";
import { useModalResource } from "@/lib/api/use-modal-resource";
import type { ProjectWorkspace } from "@/types/project";

type ProjectsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ProjectsModal({ open, onClose }: ProjectsModalProps) {
  const { data: workspace, loading, error, retry } = useModalResource<ProjectWorkspace>(
    "/api/projects",
    open,
  );
  const router = useRouter();

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
          <button type="button" className="action-button compact" onClick={retry}>重试</button>
        </div>
      ) : workspace ? (
        <ProjectWorkspacePanel initialWorkspace={workspace} />
      ) : null}
    </Modal>
  );
}
