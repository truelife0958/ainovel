"use client";

type ChapterStep = "create" | "plan" | "write";

export type ChapterProgress = {
  chapter: number;
  status: "waiting" | "running" | "done" | "error" | "skipped";
  step?: ChapterStep;
  wordCount?: number;
  error?: string;
};

export type BatchStatus = "idle" | "running" | "paused" | "completed" | "error";

type BatchProgressSectionProps = {
  status: BatchStatus;
  chapters: ChapterProgress[];
  total: number;
  doneCount: number;
  totalWords: number;
  progressPct: number;
  waitSec: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose: () => void;
};

function stepLabel(step?: ChapterStep) {
  if (step === "create") return "创建中";
  if (step === "plan") return "规划中";
  if (step === "write") return "写作中";
  return "";
}

function statusIcon(status: ChapterProgress["status"]) {
  if (status === "done") return "\u2705";
  if (status === "running") return "\uD83D\uDD04";
  if (status === "error") return "\u274C";
  if (status === "skipped") return "\u23ED";
  return "\u23F3";
}

export function BatchProgressSection({
  status,
  chapters,
  total,
  doneCount,
  totalWords,
  progressPct,
  waitSec,
  onPause,
  onResume,
  onStop,
  onClose,
}: BatchProgressSectionProps) {
  return (
    <div className="form-card">
      <div className="gen-progress-bar">
        <div className="gen-progress-bar-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="muted" style={{ textAlign: "center", margin: "8px 0" }}>
        {status === "completed"
          ? `全部完成！共 ${doneCount} 章，${totalWords} 字`
          : status === "error"
          ? `连续错误已暂停。已完成 ${doneCount} / ${total} 章`
          : `${doneCount} / ${total} 章完成 · ${totalWords} 字`}
        {status === "paused" && " · 已暂停"}
      </p>

      {waitSec > 0 && (
        <p className="muted" style={{ textAlign: "center", margin: "4px 0" }} role="status">
          已触发限流，等待 {waitSec}s 后继续…
        </p>
      )}

      <div className="gen-progress-list">
        {chapters.map((ch, i) => (
          <div
            key={i}
            className={`gen-progress-item ${ch.status === "running" ? "active" : ""} ${ch.status === "done" ? "done" : ""} ${ch.status === "error" ? "error" : ""}`}
          >
            <span className="gen-progress-icon">{statusIcon(ch.status)}</span>
            <span style={{ flex: 1 }}>
              第{ch.chapter}章
              {ch.status === "running" && ` ${stepLabel(ch.step)}...`}
              {ch.status === "done" && ch.wordCount ? ` (${ch.wordCount}字)` : ""}
              {ch.status === "error" && ch.error ? ` - ${ch.error}` : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="gen-controls">
        {status === "running" && (
          <>
            <button type="button" className="action-button secondary" onClick={onPause}>
              暂停
            </button>
            <button type="button" className="action-button secondary" onClick={onStop}>
              停止
            </button>
          </>
        )}
        {status === "paused" && (
          <>
            <button type="button" className="action-button" onClick={onResume}>
              继续
            </button>
            <button type="button" className="action-button secondary" onClick={onStop}>
              停止
            </button>
          </>
        )}
        {(status === "completed" || status === "error") && (
          <button type="button" className="action-button" onClick={onClose}>
            关闭
          </button>
        )}
      </div>
    </div>
  );
}
