"use client";

import { useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";

type ScaffoldItem = {
  id: string;
  label: string;
  kind: "setting" | "outline";
  mode: string;
  title: string;
  checked: boolean;
  status: "waiting" | "running" | "done" | "error";
  error?: string;
};

const DEFAULT_ITEMS: Omit<ScaffoldItem, "status">[] = [
  { id: "worldview", label: "世界观设定", kind: "setting", mode: "setting_worldview", title: "世界观", checked: true },
  { id: "protagonist", label: "主角卡", kind: "setting", mode: "setting_protagonist", title: "主角卡", checked: true },
  { id: "antagonist", label: "反派设计", kind: "setting", mode: "setting_antagonist", title: "反派设计", checked: true },
  { id: "synopsis", label: "总纲", kind: "outline", mode: "setting_synopsis", title: "总纲", checked: true },
  { id: "volume", label: "第一卷大纲", kind: "outline", mode: "setting_volume", title: "第1卷大纲", checked: true },
];

type ScaffoldGenerateModalProps = {
  open: boolean;
  onClose: () => void;
  genre: string;
  protagonistName: string;
  goldenFingerName: string;
};

function statusIcon(status: ScaffoldItem["status"]) {
  if (status === "done") return "\u2705";
  if (status === "running") return "\uD83D\uDD04";
  if (status === "error") return "\u274C";
  return "\u23F3";
}

export function ScaffoldGenerateModal({
  open,
  onClose,
  genre,
  protagonistName,
  goldenFingerName,
}: ScaffoldGenerateModalProps) {
  const [items, setItems] = useState<ScaffoldItem[]>(() =>
    DEFAULT_ITEMS.map(d => ({ ...d, status: "waiting" as const }))
  );
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const stopRef = useRef(false);

  function toggleItem(id: string) {
    if (status !== "idle") return;
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  }

  function updateItem(id: string, patch: Partial<ScaffoldItem>) {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...patch } : item
    ));
  }

  async function startGeneration() {
    stopRef.current = false;
    setStatus("running");

    // Reset statuses
    setItems(prev => prev.map(item => ({
      ...item,
      status: "waiting" as const,
      error: undefined,
    })));

    const checkedItems = items.filter(i => i.checked);

    for (const item of checkedItems) {
      if (stopRef.current) break;

      updateItem(item.id, { status: "running" });

      try {
        // Step 1: Create document
        const createRes = await fetch("/api/projects/current/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: item.kind, title: item.title }),
        });
        const createPayload = await createRes.json();
        if (!createRes.ok || !createPayload.ok) {
          throw new Error(createPayload.error || "创建文档失败");
        }

        if (stopRef.current) break;

        // Step 2: Generate content
        const fileName = createPayload.data.document.fileName;
        const actionRes = await fetch("/api/projects/current/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: item.kind,
            fileName,
            mode: item.mode,
            userRequest: "",
            applyMode: "replace",
          }),
        });
        const actionPayload = await actionRes.json();
        if (!actionRes.ok || !actionPayload.ok) {
          throw new Error(actionPayload.error || "AI 生成失败");
        }

        updateItem(item.id, { status: "done" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        updateItem(item.id, { status: "error", error: msg });
      }
    }

    setStatus(stopRef.current ? "idle" : "completed");
  }

  function handleStop() {
    stopRef.current = true;
  }

  function handleClose() {
    if (status === "running") stopRef.current = true;
    setStatus("idle");
    setItems(DEFAULT_ITEMS.map(d => ({ ...d, status: "waiting" as const })));
    onClose();
  }

  const checkedCount = items.filter(i => i.checked).length;
  const doneCount = items.filter(i => i.status === "done").length;
  const isRunning = status === "running";
  const progressPct = checkedCount > 0 ? Math.round((doneCount / checkedCount) * 100) : 0;

  return (
    <Modal open={open} onClose={handleClose} title="一键生成项目骨架" eyebrow="快速搭建" variant="standard">
      <div className="form-card">
        <p className="muted">
          基于立项信息自动生成设定和大纲，一键搭建项目骨架。
        </p>

        {genre && (
          <div style={{ padding: "8px 14px", borderRadius: 12, background: "var(--panel)", border: "1px solid var(--line)", fontSize: 13, color: "var(--muted)" }}>
            基于立项：{genre}{protagonistName ? ` | ${protagonistName}` : ""}{goldenFingerName ? ` | ${goldenFingerName}` : ""}
          </div>
        )}

        {/* Checklist */}
        <div className="gen-progress-list">
          {items.map(item => (
            <div
              key={item.id}
              className={`gen-progress-item ${item.status === "running" ? "active" : ""} ${item.status === "done" ? "done" : ""} ${item.status === "error" ? "error" : ""}`}
            >
              {status === "idle" ? (
                <label className="checkbox-row" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleItem(item.id)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ color: "var(--ink)" }}>{item.label}</span>
                </label>
              ) : (
                <>
                  <span className="gen-progress-icon">{statusIcon(item.status)}</span>
                  <span style={{ flex: 1 }}>
                    {item.label}
                    {item.status === "running" && " 生成中..."}
                    {item.status === "error" && item.error ? ` - ${item.error}` : ""}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {(isRunning || status === "completed") && (
          <>
            <div className="gen-progress-bar">
              <div className="gen-progress-bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="muted" style={{ textAlign: "center", margin: "4px 0 0" }}>
              {status === "completed"
                ? `全部完成！已生成 ${doneCount} 项`
                : `${doneCount} / ${checkedCount} 完成`}
            </p>
          </>
        )}

        {/* Controls */}
        <div className="gen-controls">
          {status === "idle" && (
            <button
              type="button"
              className="action-button"
              onClick={startGeneration}
              disabled={checkedCount === 0}
            >
              开始生成 ({checkedCount} 项)
            </button>
          )}
          {isRunning && (
            <button type="button" className="action-button secondary" onClick={handleStop}>
              停止
            </button>
          )}
          {status === "completed" && (
            <button type="button" className="action-button" onClick={handleClose}>
              完成
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
