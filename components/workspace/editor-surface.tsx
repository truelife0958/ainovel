"use client";

import { type RefObject } from "react";

import { EditorToolbar, type EditorViewMode } from "@/components/editor-toolbar";
import { EmptyState } from "@/components/empty-state";
import { MarkdownPreview } from "@/components/markdown-preview";
import { WordCountRing } from "@/components/word-count-ring";
import { typeLabel } from "@/lib/utils.js";
import type { ProjectDocument, ProjectDocumentKind } from "@/types/documents";
import type { ProjectSummary } from "@/types/project";

type EditorSurfaceProps = {
  hasSelectedDocument: boolean;
  selectedDocument: ProjectDocument | null;
  selectedType: ProjectDocumentKind;
  project: ProjectSummary | null;
  editorContent: string;
  wordCount: number;
  autoSaved: boolean;
  viewMode: EditorViewMode;
  onViewModeChange: (mode: EditorViewMode) => void;
  onContentChange: (value: string) => void;
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  disabled: boolean;
  emptyMessage: string;
  aiRunning: boolean;
  onCancelAi: () => void;
  downgradeNotice: string;
  message: string;
  messageClass: string;
};

export function EditorSurface({
  hasSelectedDocument,
  selectedDocument,
  selectedType,
  project,
  editorContent,
  wordCount,
  autoSaved,
  viewMode,
  onViewModeChange,
  onContentChange,
  onEditorKeyDown,
  textareaRef,
  disabled,
  emptyMessage,
  aiRunning,
  onCancelAi,
  downgradeNotice,
  message,
  messageClass,
}: EditorSurfaceProps) {
  const showRing = selectedType === "chapter"
    && (project?.targetWords ?? 0) > 0
    && (project?.targetChapters ?? 0) > 0;
  const ringTarget = showRing
    ? Math.round((project?.targetWords ?? 0) / Math.max(1, project?.targetChapters ?? 1))
    : 0;

  return (
    <div className="creation-editor-area">
      {hasSelectedDocument ? (
        <>
          <div className="creation-editor-meta">
            <h3 className="creation-editor-title">{selectedDocument?.title ?? ""}</h3>
            {showRing && <WordCountRing current={wordCount} target={ringTarget} />}
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
            onChange={onContentChange}
            disabled={disabled}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
          <div className={`editor-body view-${viewMode}`}>
            {(viewMode === "edit" || viewMode === "split") && (
              <textarea
                ref={textareaRef}
                value={editorContent}
                onChange={(e) => onContentChange(e.target.value)}
                onKeyDown={onEditorKeyDown}
                spellCheck={false}
                aria-label={`${typeLabel(selectedType)}编辑区`}
                placeholder={`在此开始${typeLabel(selectedType)}写作…`}
              />
            )}
            {(viewMode === "split" || viewMode === "preview") && (
              <MarkdownPreview content={editorContent} />
            )}
          </div>
        </>
      ) : (
        <EmptyState message={emptyMessage} />
      )}

      {aiRunning && (
        <div className="ai-loading-overlay">
          <span className="ai-spinner" />
          <span>AI 正在处理中，请稍候…</span>
          <button
            type="button"
            className="ai-cancel-btn"
            onClick={onCancelAi}
            aria-label="取消 AI 操作"
          >取消</button>
        </div>
      )}
      {downgradeNotice && !aiRunning && (
        <div className="downgrade-notice" role="status">{downgradeNotice}</div>
      )}
      {message && !aiRunning && (
        <p className={`creation-editor-message ${messageClass}`}>{message}</p>
      )}
    </div>
  );
}
