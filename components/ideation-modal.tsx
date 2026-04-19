"use client";

import { useRef } from "react";

import { Modal } from "@/components/ui/modal";
import { IdeationForm } from "@/components/ideation-form";
import { useModalResource } from "@/lib/api/use-modal-resource";
import type { ProjectIdeation } from "@/types/ideation";

type IdeationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function IdeationModal({ open, onClose }: IdeationModalProps) {
  const { data: ideation, loading, error, retry } = useModalResource<ProjectIdeation>(
    "/api/projects/current/ideation",
    open,
  );
  const dirtyRef = useRef(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="立项"
      eyebrow="作品核心"
      variant="wide"
      confirmCloseIfDirty={() => dirtyRef.current}
    >
      {loading ? (
        <div className="modal-loading">
          <span className="ai-spinner" />{" "}
          <p className="muted">加载中…</p>
        </div>
      ) : error ? (
        <div className="modal-loading">
          <p className="modal-error">无法加载立项数据。</p>
          <button type="button" className="action-button compact" onClick={retry}>重试</button>
        </div>
      ) : ideation ? (
        <IdeationForm
          initialIdeation={ideation}
          onClose={onClose}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
        />
      ) : null}
    </Modal>
  );
}
