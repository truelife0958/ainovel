"use client";

import { useState } from "react";

import { Dropdown } from "@/components/ui/dropdown";
import { AiStatusLine } from "@/components/ai-status-line";
import { typeLabel } from "@/lib/utils.js";
import type { ProjectDocumentMeta, ProjectDocumentKind } from "@/types/documents";

type BottomBarProps = {
  selectedType: ProjectDocumentKind;
  settings: ProjectDocumentMeta[];
  outlines: ProjectDocumentMeta[];
  chapters: ProjectDocumentMeta[];
  selectedFileName: string;
  documentTitle: string;
  wordCount: number;
  targetWords: number;
  targetChapters: number;
  dirty: boolean;
  aiAvailable: boolean;
  aiRunning: boolean;
  disabled: boolean;
  briefOpen: boolean;
  lastCall?: { latencyMs: number; usage: unknown } | null;
  onSelectType: (type: ProjectDocumentKind) => void;
  onSelectDocument: (type: ProjectDocumentKind, fileName: string) => void;
  onCreateDocument: (kind: ProjectDocumentKind, title: string) => void;
  onSave: () => void;
  onToggleBrief: () => void;
  onRunAi: (mode: "chapter_plan" | "chapter_write" | "outline_plan") => void;
};


export function BottomBar({
  selectedType,
  settings,
  outlines,
  chapters,
  selectedFileName,
  documentTitle,
  wordCount,
  targetWords,
  targetChapters,
  dirty,
  aiAvailable,
  aiRunning,
  disabled,
  briefOpen,
  lastCall,
  onSelectType,
  onSelectDocument,
  onCreateDocument,
  onSave,
  onToggleBrief,
  onRunAi,
}: BottomBarProps) {
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const currentDocs = selectedType === "setting" ? settings
    : selectedType === "outline" ? outlines : chapters;

  // Calculate per-chapter word target
  const chapterTarget = targetWords && targetChapters
    ? Math.round(targetWords / targetChapters)
    : 0;
  const progressPct = chapterTarget > 0
    ? Math.min(Math.round((wordCount / chapterTarget) * 100), 150)
    : 0;
  const progressComplete = chapterTarget > 0 && wordCount >= chapterTarget;
  const progressOver = chapterTarget > 0 && wordCount > chapterTarget * 1.2;

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const kind: ProjectDocumentKind = selectedType === "chapter" ? "chapter" : selectedType;
    onCreateDocument(kind, newTitle.trim());
    setNewTitle("");
    setFileDropdownOpen(false);
  }

  return (
    <footer className="bottom-bar">
      {/* Type tabs */}
      <div className="bottom-bar-type-tabs">
        {(["setting", "outline", "chapter"] as ProjectDocumentKind[]).map((type) => (
          <button
            key={type}
            type="button"
            className={`bottom-bar-tab${selectedType === type ? " active" : ""}`}
            onClick={() => onSelectType(type)}
          >
            {typeLabel(type)}
          </button>
        ))}
      </div>

      {/* File selector dropdown */}
      <Dropdown
        open={fileDropdownOpen}
        onClose={() => setFileDropdownOpen(false)}
        align="left"
        direction="up"
        trigger={
          <button
            type="button"
            className="bottom-bar-file-select"
            onClick={() => setFileDropdownOpen(!fileDropdownOpen)}
            title="选择文件"
          >
            {documentTitle || `选择${typeLabel(selectedType)}`} ({currentDocs.length}) &#9662;
          </button>
        }
      >
        {currentDocs.length === 0 && (
          <div className="dropdown-item" style={{ fontSize: 13, color: "var(--muted)", cursor: "default" }}>
            尚无文件，请在下方新建
          </div>
        )}
        {currentDocs.map((doc) => (
          <button
            key={doc.fileName}
            type="button"
            className={`dropdown-item${selectedFileName === doc.fileName ? " active" : ""}`}
            onClick={() => {
              onSelectDocument(selectedType, doc.fileName);
              setFileDropdownOpen(false);
            }}
          >
            <span>{doc.title}</span>
          </button>
        ))}
        <div className="dropdown-divider" />
        <form className="create-form" onSubmit={handleCreateSubmit}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={`新建${typeLabel(selectedType)}`}
            className="create-form-input"
          />
          <button type="submit" className="bottom-bar-btn" disabled={!newTitle.trim()}>
            新建
          </button>
        </form>
      </Dropdown>

      <div className="bottom-bar-divider" />

      {/* Brief toggle (chapters only) */}
      {selectedType === "chapter" && (
        <button
          type="button"
          className={`bottom-bar-btn${briefOpen ? " active" : ""}`}
          onClick={onToggleBrief}
          disabled={disabled}
          title="Ctrl+B"
        >
          任务书
        </button>
      )}

      {/* AI buttons */}
      {aiAvailable && selectedType === "chapter" && (
        <>
          <button
            type="button"
            className="bottom-bar-btn"
            onClick={() => onRunAi("chapter_plan")}
            disabled={disabled || aiRunning}
          >
            {aiRunning ? <span className="ai-spinner small" /> : null}
            AI 规划
          </button>
          <button
            type="button"
            className="bottom-bar-btn"
            onClick={() => onRunAi("chapter_write")}
            disabled={disabled || aiRunning}
          >
            {aiRunning ? <span className="ai-spinner small" /> : null}
            AI 生成
          </button>
        </>
      )}
      {aiAvailable && selectedType === "outline" && (
        <button
          type="button"
          className="bottom-bar-btn"
          onClick={() => onRunAi("outline_plan")}
          disabled={disabled || aiRunning}
        >
          {aiRunning ? <span className="ai-spinner small" /> : null}
          AI 规划增强
        </button>
      )}

      <div className="bottom-bar-spacer" />

      {/* Word count with progress */}
      <div className="wordcount-progress">
        {chapterTarget > 0 && selectedType === "chapter" && (
          <div className="wordcount-bar">
            <div
              className={`wordcount-bar-fill${progressComplete ? " complete" : ""}${progressOver ? " over" : ""}`}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        )}
        <span className={`bottom-bar-wordcount${dirty ? " dirty" : ""}`}>
          {wordCount} 字{chapterTarget > 0 && selectedType === "chapter" ? ` / ${chapterTarget}` : ""}{dirty ? " · 未保存" : ""}
        </span>
        <AiStatusLine lastCall={lastCall ?? null} />
      </div>

      <button
        type="button"
        className="bottom-bar-btn primary"
        onClick={onSave}
        disabled={disabled || !selectedFileName}
      >
        保存
      </button>
    </footer>
  );
}
