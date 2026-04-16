"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { IdeationForm } from "@/components/ideation-form";
import type { ProjectIdeation } from "@/types/ideation";

type IdeationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function IdeationModal({ open, onClose }: IdeationModalProps) {
  const [ideation, setIdeation] = useState<ProjectIdeation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setIdeation(null);
    setLoading(true);
    setError(false);
    fetch("/api/projects/current/ideation", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) setIdeation(payload.data);
        else setError(true);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open]);

  function handleRetry() {
    setError(false);
    setLoading(true);
    fetch("/api/projects/current/ideation")
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) setIdeation(payload.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  return (
    <Modal open={open} onClose={onClose} title="立项" eyebrow="作品核心" variant="wide">
      {loading ? (
        <div className="modal-loading">
          <span className="ai-spinner" />{" "}
          <p className="muted">加载中…</p>
        </div>
      ) : error ? (
        <div className="modal-loading">
          <p className="modal-error">无法加载立项数据。</p>
          <button type="button" className="action-button compact" onClick={handleRetry}>重试</button>
        </div>
      ) : ideation ? (
        <IdeationForm initialIdeation={ideation} onClose={onClose} />
      ) : null}
    </Modal>
  );
}
