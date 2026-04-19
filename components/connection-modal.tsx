"use client";

import { useRef } from "react";

import { Modal } from "@/components/ui/modal";
import { ConnectionWizard } from "@/components/connection-wizard";
import { useModalResource } from "@/lib/api/use-modal-resource";
import type { ProviderConfigSummary } from "@/types/settings";

type ConnectionModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ConnectionModal({ open, onClose }: ConnectionModalProps) {
  const { data: config, loading, error, retry } = useModalResource<ProviderConfigSummary>(
    "/api/settings/providers",
    open,
  );
  const dirtyRef = useRef(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI 连接"
      eyebrow="设置"
      variant="standard"
      confirmCloseIfDirty={() => dirtyRef.current}
    >
      {loading ? (
        <div className="modal-loading">
          <span className="ai-spinner" />{" "}
          <p className="muted">加载配置中…</p>
        </div>
      ) : error ? (
        <div className="modal-loading">
          <p className="modal-error">无法加载配置。</p>
          <button type="button" className="action-button compact" onClick={retry}>重试</button>
        </div>
      ) : config ? (
        <ConnectionWizard
          initialConfig={config}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
        />
      ) : null}
    </Modal>
  );
}
