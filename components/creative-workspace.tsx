"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { type EditorViewMode } from "@/components/editor-toolbar";
import { EditorSurface } from "@/components/workspace/editor-surface";
import { useAutoSave } from "@/components/hooks/use-auto-save";
import { useAiRunner } from "@/components/hooks/use-ai-runner";
import { useKeyboardShortcuts } from "@/components/hooks/use-keyboard-shortcuts";
import { evaluateChapterWriteGuard } from "@/lib/ai/write-guard.js";
import { parseChapterBriefContent, validateChapterBrief } from "@/lib/projects/brief-format.js";
import { typeLabel } from "@/lib/utils.js";
import { useAbortableFetch, isAbortError } from "@/lib/api/use-abortable-fetch";
import { ChapterBriefEditor } from "@/components/workspace/chapter-brief-editor";
import { BottomBar } from "@/components/bottom-bar";
import { BottomPanel } from "@/components/ui/bottom-panel";
import type { ChapterBrief, ChapterBriefValidation, ParsedChapterBrief } from "@/types/briefs";
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

export function CreativeWorkspace({
  project,
  assistantStatus,
  settings,
  outlines,
  chapters,
  initialDocument,
  initialBrief,
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
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [writeGuardArmed, setWriteGuardArmed] = useState(false);
  const [briefPanelOpen, setBriefPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<EditorViewMode>("edit");
  const [isPending, startTransition] = useTransition();
  const isPendingRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectFetcher = useAbortableFetch();

  const { aiRunning, downgradeNotice, lastCall, runAi, cancelAi } = useAiRunner();

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

  // Ref to latest saveDocument so hooks can call the newest closure
  const saveRef = useRef(saveDocument);
  useEffect(() => { saveRef.current = saveDocument; }, [saveDocument]);

  // Auto-save with exponential backoff
  const autoSaveEnabled = chapterDirty && hasSelectedDocument && !isPending && !aiRunning;
  const {
    error: autoSaveError,
    justSaved: autoSaved,
    retry: retryAutoSave,
  } = useAutoSave({
    save: saveDocument,
    enabled: autoSaveEnabled,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: () => startTransition(() => { void saveRef.current(); }),
    onToggleBrief: () => setBriefPanelOpen((v) => !v),
    onCloseBrief: () => setBriefPanelOpen(false),
    canSave: hasSelectedDocument && !isPendingRef.current,
    briefPanelOpen,
    chapterContext: selectedType === "chapter",
  });

  /* ===== Actions ===== */

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
          const [docRes, briefRes] = await Promise.all([
            fetch(`/api/projects/current/documents?kind=chapter&file=${encodeURIComponent(fileName)}`, { signal }),
            fetch(`/api/projects/current/briefs?file=${encodeURIComponent(fileName)}`, { signal }),
          ]);
          const docPayload = await docRes.json();
          const briefPayload = await briefRes.json();
          if (!docRes.ok || !docPayload.ok) { setMessage(docPayload.error || "读取章节失败"); return; }
          setSelectedDocument(docPayload.data);
          setBrief(briefRes.ok && briefPayload.ok ? briefPayload.data : null);
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
          const briefRes = await fetch(`/api/projects/current/briefs?file=${encodeURIComponent(fileName)}`);
          setChapterDocs(payload.data.documents);
          setSelectedDocument(payload.data.document);
          const briefPayload = await briefRes.json();
          setBrief(briefRes.ok && briefPayload.ok ? briefPayload.data : null);
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

  function handleRunAi(mode: "chapter_plan" | "chapter_write" | "outline_plan") {
    if (!selectedDocument) return;
    if (mode === "chapter_plan" && briefDirty) { setMessage("任务书有未保存的修改，请先保存。"); return; }
    if (mode === "chapter_write" && chapterDirty) { setMessage("正文有未保存的修改，请先保存。"); return; }
    if (mode === "chapter_write" && writeGuard.requiresConfirmation && !writeGuardArmed) {
      setWriteGuardArmed(true);
      setMessage(writeGuard.summary);
      return;
    }
    setMessage("");
    const kind = mode === "outline_plan" ? selectedType : "chapter";
    startTransition(async () => {
      const result = await runAi({
        mode,
        kind,
        fileName: selectedDocument.fileName,
        applyMode: mode === "chapter_write" ? "append" : "replace",
      });
      if (!result) { setToast("已取消"); return; }
      if ("error" in result && result.error) { setMessage(result.error); return; }
      if (result.target === "brief") {
        setBrief(result.document as ChapterBrief);
        setBriefContent(result.document.content);
      } else {
        setSelectedDocument(result.document as ProjectDocument);
        if (selectedType === "chapter") {
          setChapterContent(result.document.content);
          if (result.documents) setChapterDocs(result.documents as ProjectDocumentMeta[]);
        } else {
          setAssetContent(result.document.content);
        }
      }
      setWriteGuardArmed(false);
      setToast("AI 操作已完成");
    });
  }

  /* ===== Render ===== */

  const currentDocs = selectedType === "setting" ? settingDocs
    : selectedType === "outline" ? outlineDocs : chapterDocs;
  const hasDocuments = currentDocs.length > 0;
  const emptyMessage = hasDocuments
    ? `在底部操作栏选择${typeLabel(selectedType)}，开始编辑。`
    : `在底部操作栏新建${typeLabel(selectedType)}，开始编辑。`;

  const isErrorMessage = message && (
    message.includes("失败") || message.includes("错误") || message.includes("未保存")
  );
  const isSuccessMessage = message && (
    message.includes("已创建") || message.includes("已完成")
  );
  const messageClass = isErrorMessage ? "error" : isSuccessMessage ? "success" : "";

  return (
    <>
      <EditorSurface
        hasSelectedDocument={hasSelectedDocument}
        selectedDocument={selectedDocument}
        selectedType={selectedType}
        project={project}
        editorContent={editorContent}
        wordCount={wordCount}
        autoSaved={autoSaved}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onContentChange={(v) => {
          if (selectedType === "chapter") setChapterContent(v);
          else setAssetContent(v);
        }}
        onEditorKeyDown={handleEditorKeyDown}
        textareaRef={textareaRef}
        disabled={isPending || aiRunning}
        emptyMessage={emptyMessage}
        aiRunning={aiRunning}
        onCancelAi={cancelAi}
        downgradeNotice={downgradeNotice}
        message={message}
        messageClass={messageClass}
      />

      {/* Auto-save retry toast (outside editor area so it stays visible) */}
      {autoSaveError && (
        <div className="autosave-error-toast" role="alert">
          <span>{autoSaveError}</span>
          <button
            type="button"
            className="autosave-retry-btn"
            onClick={retryAutoSave}
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
        lastCall={lastCall}
        onSelectType={handleSelectType}
        onSelectDocument={selectDocument}
        onCreateDocument={createDocument}
        onSave={() => startTransition(() => { void saveDocument(); })}
        onToggleBrief={() => setBriefPanelOpen(!briefPanelOpen)}
        onRunAi={handleRunAi}
      />

      {/* Toast */}
      <div className={`save-toast ${toast ? "visible" : ""}`} aria-live="polite">{toast}</div>
    </>
  );
}
