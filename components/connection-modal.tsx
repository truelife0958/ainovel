"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { ConnectionWizard } from "@/components/connection-wizard";
import type { ProviderConfigSummary } from "@/types/settings";

type ConnectionModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ConnectionModal({ open, onClose }: ConnectionModalProps) {
  const [config, setConfig] = useState<ProviderConfigSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch("/api/settings/providers", { signal: controller.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) setConfig(payload.data);
        else setError(true);
      })
      .catch((e) => { if (e.name !== "AbortError") setError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open]);

  function handleRetry() {
    setError(false);
    setLoading(true);
    fetch("/api/settings/providers")
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) setConfig(payload.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  return (
    <Modal open={open} onClose={onClose} title="AI 连接" eyebrow="设置" variant="standard">
      {loading ? (
        <div className="modal-loading">
          <span className="ai-spinner" />{" "}
          <p className="muted">加载配置中…</p>
        </div>
      ) : error ? (
        <div className="modal-loading">
          <p className="modal-error">无法加载配置。</p>
          <button type="button" className="action-button compact" onClick={handleRetry}>重试</button>
        </div>
      ) : config ? (
        <ConnectionWizard initialConfig={config} />
      ) : null}
    </Modal>
  );
}
