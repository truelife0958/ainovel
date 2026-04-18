"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { EditorToolbar } from "@/components/editor-toolbar";
import { EmptyState } from "@/components/empty-state";
import { evaluateChapterWriteGuard } from "@/lib/ai/write-guard.js";
import { parseChapterBriefContent, validateChapterBrief } from "@/lib/projects/brief-format.js";
import { typeLabel } from "@/lib/utils.js";
import { computeNextBackoffMs } from "@/components/creative-workspace-autosave.js";
import { useAbortableFetch, isAbortError } from "@/lib/api/use-abortable-fetch";
import { ChapterBriefEditor } from "@/components/workspace/chapter-brief-editor";
import { BottomBar } from "@/components/bottom-bar";
import { BottomPanel } from "@/components/ui/bottom-panel";
import type { ChapterBrief, ChapterBriefValidation, ParsedChapterBrief } from "@/types/briefs";
import type { ChapterContext } from "@/types/context";
import type { ProjectDocument, ProjectDocumentMeta, ProjectDocumentKind } from "@/types/documents";
import type { ProjectSummary } from "@/types/project";
import type { ProviderRuntimeStatus } from "@/types/settings";

type CreativeWorkspaceProps = {
  project: ProjectSummary | null;
  assistantStatus: ProviderRuntimeStatus;
  settings: ProjectDocumentMeta[];
  outlines: ProjectDocumentMeta[];
  chapters: ProjectDocumentMeta[];
  initialDocument: ProjectDocument | null;
  initialBrief: ChapterBrief | null;
  initialContext: ChapterContext | null;
  initialAssistantRequest?: string;
  initialType: ProjectDocumentKind;
};

function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const textarea = event.currentTarget;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const newValue = value.slice(0, start) + "\t" + value.slice(end);
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype, "value",
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(textarea, newValue);
  }
  textarea.setSelectionRange(start + 1, start + 1);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

const AUTOSAVE_DELAY = 30000; // 30s autosave

export function CreativeWorkspace({
  project,
  assistantStatus,
  settings,
  outlines,
  chapters,
  initialDocument,
  initialBrief,
  initialContext,
  initialAssistantRequest,
  initialType,
}: CreativeWorkspaceProps) {
  const [selectedType, setSelectedType] = useState<ProjectDocumentKind>(initialType);
  const [chapterDocs, setChapterDocs] = useState(chapters);
  const [settingDocs] = useState(settings);
  const [outlineDocs] = useState(outlines);
  const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(initialDocument);
  const [chapterContent, setChapterContent] = useState(initialDocument?.content ?? "");
  const [assetContent, setAssetContent] = useState("");
  const [brief, setBrief] = useState<ChapterBrief | null>(initialBrief);
  const [briefContent, setBriefContent] = useState(initialBrief?.content ?? "");
  const [context, setContext] = useState<ChapterContext | null>(initialContext);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "error" | "success">("info");
  const [toast, setToast] = useState("");
  const [writeGuardArmed, setWriteGuardArmed] = useState(false);
  const [briefPanelOpen, setBriefPanelOpen] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [autoSaveFailures, setAutoSaveFailures] = useState(0);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [downgradeNotice, setDowngradeNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const isPendingRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoSavedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectFetcher = useAbortableFetch();
  const aiAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isPendingRef.current = isPending;
  }, [isPending]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3000);
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, [toast]);

  // Downgrade notice auto-dismiss (5s)
  useEffect(() => {
    if (!downgradeNotice) return;
    const t = setTimeout(() => setDowngradeNotice(""), 5000);
    return () => clearTimeout(t);
  }, [downgradeNotice]);

  // Sync content on document change
  useEffect(() => { setChapterContent(selectedDocument?.content ?? ""); }, [selectedDocument]);
  useEffect(() => { setBriefContent(brief?.content ?? ""); }, [brief]);
  useEffect(() => { setWriteGuardArmed(false); }, [selectedDocument?.fileName, briefContent]);

  // Derived state
  const hasSelectedDocument = Boolean(selectedDocument);
  const chapterDirty = selectedType === "chapter"
    ? chapterContent !== (selectedDocument?.content ?? "")
    : assetContent !== (selectedDocument?.content ?? "");
  const briefDirty = briefContent !== (brief?.content ?? "");
  const editorContent = selectedType === "chapter" ? chapterContent : assetContent;
  const wordCount = editorContent.length;

  const parsedBrief: ParsedChapterBrief = parseChapterBriefContent(briefContent);
  const briefValidation: ChapterBriefValidation = validateChapterBrief(parsedBrief);
  const writeGuard = evaluateChapterWriteGuard(briefValidation);

  // Save function (unified: handles both explicit save and silent auto-save)
  const saveDocument = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!selectedDocument) return undefined;
    if (!silent) setMessage("");
    try {
      const res = await fetch("/api/projects/current/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: selectedType === "chapter" ? "chapter" : selectedType,
          fileName: selectedDocument.fileName,
          content: selectedType === "chapter" ? chapterContent : assetContent,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        if (!silent) setMessage(payload.error || "保存失败");
        return undefined;
      }
      if (selectedType === "chapter") setChapterDocs(payload.data.documents);
      setSelectedDocument(payload.data.document);
      if (!silent) setToast(`已保存《${payload.data.document.title}》`);
      return payload.data.document;
    } catch {
      if (!silent) setMessage("网络错误，保存失败");
      return undefined;
    }
  }, [selectedDocument, selectedType, chapterContent, assetContent]);

  // Ref to latest saveDocument so keyboard effect doesn't re-subscribe on every keystroke
  const saveRef = useRef(saveDocument);
  useEffect(() => { saveRef.current = saveDocument; }, [saveDocument]);

  // Ctrl+S / Ctrl+B shortcut handler
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (hasSelectedDocument && !isPendingRef.current) {
          startTransition(() => { void saveRef.current(); });
        }
      }
      // Ctrl+B to toggle brief panel
      if ((event.ctrlKey || event.metaKey) && event.key === "b" && selectedType === "chapter") {
        event.preventDefault();
        setBriefPanelOpen(prev => !prev);
      }
      // Escape to close brief panel
      if (event.key === "Escape" && briefPanelOpen) {
        setBriefPanelOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hasSelectedDocument, selectedType, briefPanelOpen]);

  // Auto-save with exponential backoff
  useEffect(() => {
    if (!chapterDirty || !hasSelectedDocument || isPending || aiRunning) return;

    const delay = autoSaveFailures > 0
      ? computeNextBackoffMs(autoSaveFailures - 1)
      : AUTOSAVE_DELAY;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      startTransition(async () => {
        const doc = await saveRef.current({ silent: true });
        if (doc) {
          setAutoSaveFailures(0);
          setAutoSaveError(null);
          setAutoSaved(true);
          if (autoSavedTimerRef.current) clearTimeout(autoSavedTimerRef.current);
          autoSavedTimerRef.current = setTimeout(() => setAutoSaved(false), 2000);
        } else {
          setAutoSaveFailures(n => n + 1);
          setAutoSaveError("自动保存失败，将自动重试");
        }
      });
    }, delay);

    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [chapterDirty, hasSelectedDocument, isPending, aiRunning, autoSaveFailures]);

  /* ===== Actions ===== */

  function showMessage(msg: string, type: "info" | "error" | "success" = "info") {
    setMessage(msg);
    setMessageType(type);
  }

  function handleSelectType(type: ProjectDocumentKind) {
    if (selectedType === type) return;
    setSelectedType(type);
    setSelectedDocument(null);
    setChapterContent("");
    setAssetContent("");
    setBriefPanelOpen(false);
    setMessage("");
  }

  function selectDocument(type: ProjectDocumentKind, fileName: string) {
    setSelectedType(type);
    setMessage("");

    if (type === "chapter") {
      const signal = selectFetcher.beginGeneration();
      startTransition(async () => {
        try {
          const [docRes, briefRes, ctxRes] = await Promise.all([
            fetch(`/api/projects/current/documents?kind=chapter&file=${encodeURIComponent(fileName)}`, { signal }),
            fetch(`/api/projects/current/briefs?file=${encodeURIComponent(fileName)}`, { signal }),
            fetch(`/api/projects/current/context?file=${encodeURIComponent(fileName)}`, { signal }),
          ]);
          const docPayload = await docRes.json();
          const briefPayload = await briefRes.json();
          const ctxPayload = await ctxRes.json();
          if (!docRes.ok || !docPayload.ok) { setMessage(docPayload.error || "读取章节失败"); return; }
          setSelectedDocument(docPayload.data);
          setBrief(briefRes.ok && briefPayload.ok ? briefPayload.data : null);
          setContext(ctxRes.ok && ctxPayload.ok ? ctxPayload.data : null);
        } catch (err) {
          if (isAbortError(err)) return;
          setMessage("网络错误，切换章节失败");
        }
      });
    } else {
      const signal = selectFetcher.beginGeneration();
      startTransition(async () => {
        try {
          const res = await fetch(`/api/projects/current/documents?kind=${type}&file=${encodeURIComponent(fileName)}`, { signal });
          const payload = await res.json();
          if (!res.ok || !payload.ok) { setMessage(payload.error || `读取${typeLabel(type)}失败`); return; }
          setSelectedDocument(payload.data);
          setAssetContent(payload.data.content);
        } catch (err) {
          if (isAbortError(err)) return;
          setMessage(`网络错误，读取${typeLabel(type)}失败`);
        }
      });
    }
  }

  function createDocument(kind: ProjectDocumentKind, title: string) {
    setMessage("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/projects/current/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, title }),
        });
        const payload = await res.json();
        if (!res.ok || !payload.ok) { setMessage(payload.error || "创建失败"); return; }
        const fileName = payload.data.document.fileName;
        if (selectedType === "chapter") {
          const [briefRes, ctxRes] = await Promise.all([
            fetch(`/api/projects/current/briefs?file=${encodeURIComponent(fileName)}`),
            fetch(`/api/projects/current/context?file=${encodeURIComponent(fileName)}`),
          ]);
          setChapterDocs(payload.data.documents);
          setSelectedDocument(payload.data.document);
          const briefPayload = await briefRes.json();
          const ctxPayload = await ctxRes.json();
          setBrief(briefRes.ok && briefPayload.ok ? briefPayload.data : null);
          setContext(ctxRes.ok && ctxPayload.ok ? ctxPayload.data : null);
        } else {
          setSelectedDocument(payload.data.document);
          setAssetContent(payload.data.document.content);
        }
        setMessage(`已创建《${payload.data.document.title}》`);
      } catch { setMessage("网络错误，创建失败"); }
    });
  }

  function saveBrief() {
    if (!selectedDocument) return;
    setMessage("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/projects/current/briefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: selectedDocument.fileName, content: briefContent }),
        });
        const payload = await res.json();
        if (!res.ok || !payload.ok) { setMessage(payload.error || "保存任务书失败"); return; }
        setBrief(payload.data);
        setToast(`已保存第 ${payload.data.chapterNumber} 章任务书`);
      } catch { setMessage("网络错误，保存任务书失败"); }
    });
  }

  function runAi(mode: "chapter_plan" | "chapter_write" | "outline_plan") {
    if (!selectedDocument) return;
    if (mode === "chapter_plan" && briefDirty) { setMessage("任务书有未保存的修改，请先保存。"); return; }
    if (mode === "chapter_write" && chapterDirty) { setMessage("正文有未保存的修改，请先保存。"); return; }
    if (mode === "chapter_write" && writeGuard.requiresConfirmation && !writeGuardArmed) {
      setWriteGuardArmed(true);
      setMessage(writeGuard.summary);
      return;
    }
    setMessage("");
    setAiRunning(true);
    aiAbortRef.current = new AbortController();
    const signal = aiAbortRef.current.signal;
    startTransition(async () => {
      try {
        const kind = mode === "outline_plan" ? selectedType : "chapter";
        const res = await fetch("/api/projects/current/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            fileName: selectedDocument.fileName,
            mode,
            userRequest: "",
            applyMode: mode === "chapter_write" ? "append" : "replace",
          }),
          signal,
        });
        if (signal.aborted) return;
        const payload = await res.json();
        if (!res.ok || !payload.ok) { setMessage(payload.error || "AI 执行失败"); return; }
        if (payload.data.downgraded) {
          setDowngradeNotice("原稿超 30KB，本次使用替换模式生成。");
        }
        if (payload.data.target === "brief") {
          setBrief(payload.data.document);
          setBriefContent(payload.data.document.content);
        } else {
          setSelectedDocument(payload.data.document);
          if (selectedType === "chapter") {
            setChapterContent(payload.data.document.content);
            setChapterDocs(payload.data.documents);
          } else {
            setAssetContent(payload.data.document.content);
          }
        }
        setWriteGuardArmed(false);
        setToast("AI 操作已完成");
      } catch (err) {
        if ((err as Error)?.name === "AbortError") { setToast("已取消"); return; }
        setMessage("网络错误，AI 操作失败");
      }
      finally {
        setAiRunning(false);
        aiAbortRef.current = null;
      }
    });
  }

  function cancelAi() {
    aiAbortRef.current?.abort();
  }

  /* ===== Render ===== */

  const currentDocs = selectedType === "setting" ? settingDocs
    : selectedType === "outline" ? outlineDocs : chapterDocs;
  const hasDocuments = currentDocs.length > 0;
  const emptyMessage = hasDocuments
    ? `在底部操作栏选择${typeLabel(selectedType)}，开始编辑。`
    : `在底部操作栏新建${typeLabel(selectedType)}，开始编辑。`;

  // Detect error messages for styling
  const isErrorMessage = message && (
    message.includes("失败") || message.includes("错误") || message.includes("未保存")
  );
  const isSuccessMessage = message && (
    message.includes("已创建") || message.includes("已完成")
  );
  const messageClass = isErrorMessage ? "error" : isSuccessMessage ? "success" : "";

  return (
    <>
      {/* Editor Area */}
      <div className="creation-editor-area">
        {hasSelectedDocument ? (
          <>
            <div className="creation-editor-meta">
              <h3 className="creation-editor-title">{selectedDocument?.title ?? ""}</h3>
              <span className="creation-editor-hint">
                Ctrl+S 保存 {selectedType === "chapter" ? "· Ctrl+B 任务书" : ""}
              </span>
              {autoSaved && (
                <span className="autosave-indicator visible">
                  <span className="autosave-dot" />
                  已自动保存
                </span>
              )}
            </div>
            <EditorToolbar
              textareaRef={textareaRef}
              onChange={(v) => {
                if (selectedType === "chapter") setChapterContent(v);
                else setAssetContent(v);
              }}
              disabled={isPending || aiRunning}
            />
            <textarea
              ref={textareaRef}
              value={editorContent}
              onChange={(e) => {
                if (selectedType === "chapter") setChapterContent(e.target.value);
                else setAssetContent(e.target.value);
              }}
              onKeyDown={handleEditorKeyDown}
              spellCheck={false}
              aria-label={`${typeLabel(selectedType)}编辑区`}
              placeholder={`在此开始${typeLabel(selectedType)}写作…`}
            />
          </>
        ) : (
          <EmptyState message={emptyMessage} />
        )}

        {/* Status message / AI loading */}
        {aiRunning && (
          <div className="ai-loading-overlay">
            <span className="ai-spinner" />
            <span>AI 正在处理中，请稍候…</span>
            <button
              type="button"
              className="ai-cancel-btn"
              onClick={cancelAi}
              aria-label="取消 AI 操作"
            >取消</button>
          </div>
        )}
        {downgradeNotice && !aiRunning && (
          <div className="downgrade-notice" role="status">{downgradeNotice}</div>
        )}
        {message && !aiRunning && <p className={`creation-editor-message ${messageClass}`}>{message}</p>}
      </div>

      {/* Auto-save retry toast (outside editor area so it stays visible) */}
      {autoSaveError && (
        <div className="autosave-error-toast" role="alert">
          <span>{autoSaveError}</span>
          <button
            type="button"
            className="autosave-retry-btn"
            onClick={() => {
              setAutoSaveError(null);
              startTransition(async () => {
                const doc = await saveRef.current({ silent: false });
                if (doc) setAutoSaveFailures(0);
              });
            }}
          >立即重试</button>
        </div>
      )}

      {/* Brief Bottom Panel (chapters only) */}
      {selectedType === "chapter" && (
        <BottomPanel
          open={briefPanelOpen}
          onClose={() => setBriefPanelOpen(false)}
          title={brief?.title ?? "章节任务书"}
          eyebrow="任务书编辑"
        >
          <ChapterBriefEditor
            brief={brief}
            briefContent={briefContent}
            parsedBrief={parsedBrief}
            briefValidation={briefValidation}
            disabled={isPending}
            onBriefContentChange={setBriefContent}
            onSave={saveBrief}
          />
        </BottomPanel>
      )}

      {/* Bottom Action Bar */}
      <BottomBar
        selectedType={selectedType}
        settings={settingDocs}
        outlines={outlineDocs}
        chapters={chapterDocs}
        selectedFileName={selectedDocument?.fileName ?? ""}
        documentTitle={selectedDocument?.title ?? ""}
        wordCount={wordCount}
        targetWords={project?.targetWords ?? 0}
        targetChapters={project?.targetChapters ?? 0}
        dirty={chapterDirty || briefDirty}
        aiAvailable={assistantStatus.available}
        aiRunning={aiRunning}
        disabled={isPending}
        briefOpen={briefPanelOpen}
        onSelectType={handleSelectType}
        onSelectDocument={selectDocument}
        onCreateDocument={createDocument}
        onSave={() => startTransition(() => { void saveDocument(); })}
        onToggleBrief={() => setBriefPanelOpen(!briefPanelOpen)}
        onRunAi={runAi}
      />

      {/* Toast */}
      <div className={`save-toast ${toast ? "visible" : ""}`} aria-live="polite">{toast}</div>
    </>
  );
}
