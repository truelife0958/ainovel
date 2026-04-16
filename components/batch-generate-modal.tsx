"use client";

import { useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";

type BatchStatus = "idle" | "running" | "paused" | "completed" | "error";
type ChapterStep = "create" | "plan" | "write";

type ChapterProgress = {
  chapter: number;
  status: "waiting" | "running" | "done" | "error" | "skipped";
  step?: ChapterStep;
  wordCount?: number;
  error?: string;
};

type BatchGenerateModalProps = {
  open: boolean;
  onClose: () => void;
  targetChapters: number;
  currentChapter: number;
  existingChapterCount: number;
};

function chapterFileName(n: number) {
  return `第${String(n).padStart(4, "0")}章.md`;
}

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

async function apiCreateChapter(chapter: number) {
  const res = await fetch("/api/projects/current/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "chapter", title: `第${chapter}章` }),
  });
  const payload = await res.json();
  if (!res.ok || !payload.ok) throw new Error(payload.error || "创建章节失败");
  return payload.data;
}

async function apiRunAi(chapter: number, mode: "chapter_plan" | "chapter_write") {
  const fileName = chapterFileName(chapter);
  const res = await fetch("/api/projects/current/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "chapter",
      fileName,
      mode,
      userRequest: "",
      applyMode: mode === "chapter_write" ? "append" : "replace",
    }),
  });
  const payload = await res.json();
  if (!res.ok || !payload.ok) throw new Error(payload.error || "AI 操作失败");
  return payload.data;
}

export function BatchGenerateModal({
  open,
  onClose,
  targetChapters,
  currentChapter,
  existingChapterCount,
}: BatchGenerateModalProps) {
  const [status, setStatus] = useState<BatchStatus>("idle");
  const [startChapter, setStartChapter] = useState(Math.max(currentChapter, 1));
  const [endChapter, setEndChapter] = useState(targetChapters || 10);
  const [chapters, setChapters] = useState<ChapterProgress[]>([]);
  const [totalWords, setTotalWords] = useState(0);

  const pauseRef = useRef(false);
  const stopRef = useRef(false);

  function updateChapter(idx: number, patch: Partial<ChapterProgress>) {
    setChapters(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }

  async function waitForResume() {
    while (pauseRef.current) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  async function startGeneration() {
    const total = endChapter - startChapter + 1;
    if (total <= 0) return;

    pauseRef.current = false;
    stopRef.current = false;
    setStatus("running");
    setTotalWords(0);

    const initial: ChapterProgress[] = Array.from({ length: total }, (_, i) => ({
      chapter: startChapter + i,
      status: "waiting" as const,
    }));
    setChapters(initial);

    for (let i = 0; i < total; i++) {
      if (stopRef.current) break;
      await waitForResume();
      if (stopRef.current) break;

      const chapterNum = startChapter + i;
      updateChapter(i, { status: "running", step: "create" });

      try {
        // Step 1: Create chapter if needed
        const needsCreate = chapterNum > existingChapterCount;
        if (needsCreate) {
          await apiCreateChapter(chapterNum);
        }

        if (stopRef.current) break;
        await waitForResume();

        // Step 2: Plan
        updateChapter(i, { step: "plan" });
        await apiRunAi(chapterNum, "chapter_plan");

        if (stopRef.current) break;
        await waitForResume();

        // Step 3: Write
        updateChapter(i, { step: "write" });
        const result = await apiRunAi(chapterNum, "chapter_write");

        const wc = result.document?.content?.length ?? 0;
        updateChapter(i, { status: "done", wordCount: wc });
        setTotalWords(prev => prev + wc);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        updateChapter(i, { status: "error", error: msg });
        // Continue to next chapter on error
      }
    }

    setStatus(stopRef.current ? "idle" : "completed");
  }

  function handlePause() {
    pauseRef.current = true;
    setStatus("paused");
  }

  function handleResume() {
    pauseRef.current = false;
    setStatus("running");
  }

  function handleStop() {
    stopRef.current = true;
    pauseRef.current = false;
    setStatus("idle");
  }

  function handleClose() {
    if (status === "running" || status === "paused") {
      stopRef.current = true;
      pauseRef.current = false;
    }
    setStatus("idle");
    onClose();
  }

  const total = endChapter - startChapter + 1;
  const doneCount = chapters.filter(c => c.status === "done").length;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const isRunning = status === "running" || status === "paused";

  return (
    <Modal open={open} onClose={handleClose} title="AI 批量生成" eyebrow="章节批量创作" variant="standard">
      {/* Config section */}
      {!isRunning && status !== "completed" && (
        <div className="form-card">
          <p className="muted">按顺序为每章执行：创建 → AI 规划 → AI 写作。支持暂停和停止。</p>
          <div className="form-grid compact">
            <label>
              <span>起始章节</span>
              <input
                type="number"
                min={1}
                max={9999}
                value={startChapter}
                onChange={e => setStartChapter(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <label>
              <span>结束章节</span>
              <input
                type="number"
                min={startChapter}
                max={9999}
                value={endChapter}
                onChange={e => setEndChapter(Math.max(startChapter, Number(e.target.value)))}
              />
            </label>
          </div>
          <p className="muted">
            共 {total} 章 · 已有 {existingChapterCount} 章 · 预计需要较长时间
          </p>
          <div className="gen-controls">
            <button
              type="button"
              className="action-button"
              onClick={startGeneration}
              disabled={total <= 0}
            >
              开始生成
            </button>
          </div>
        </div>
      )}

      {/* Progress section */}
      {(isRunning || status === "completed") && (
        <div className="form-card">
          <div className="gen-progress-bar">
            <div className="gen-progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="muted" style={{ textAlign: "center", margin: "8px 0" }}>
            {status === "completed"
              ? `全部完成！共 ${doneCount} 章，${totalWords} 字`
              : `${doneCount} / ${total} 章完成 · ${totalWords} 字`}
            {status === "paused" && " · 已暂停"}
          </p>

          <div className="gen-progress-list">
            {chapters.map((ch, i) => (
              <div key={i} className={`gen-progress-item ${ch.status === "running" ? "active" : ""} ${ch.status === "done" ? "done" : ""} ${ch.status === "error" ? "error" : ""}`}>
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
                <button type="button" className="action-button secondary" onClick={handlePause}>
                  暂停
                </button>
                <button type="button" className="action-button secondary" onClick={handleStop}>
                  停止
                </button>
              </>
            )}
            {status === "paused" && (
              <>
                <button type="button" className="action-button" onClick={handleResume}>
                  继续
                </button>
                <button type="button" className="action-button secondary" onClick={handleStop}>
                  停止
                </button>
              </>
            )}
            {status === "completed" && (
              <button type="button" className="action-button" onClick={handleClose}>
                关闭
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
