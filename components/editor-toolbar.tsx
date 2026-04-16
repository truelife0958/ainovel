"use client";

import { type RefObject } from "react";

type EditorToolbarProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type FormatAction =
  | { type: "wrap"; before: string; after: string }
  | { type: "prefix"; prefix: string }
  | { type: "insert"; text: string };

const FORMAT_ACTIONS: Record<string, FormatAction> = {
  bold: { type: "wrap", before: "**", after: "**" },
  italic: { type: "wrap", before: "*", after: "*" },
  h1: { type: "prefix", prefix: "# " },
  h2: { type: "prefix", prefix: "## " },
  h3: { type: "prefix", prefix: "### " },
  list: { type: "prefix", prefix: "- " },
  ordered: { type: "prefix", prefix: "1. " },
  quote: { type: "prefix", prefix: "> " },
  divider: { type: "insert", text: "\n---\n" },
};

function applyFormat(textarea: HTMLTextAreaElement, action: FormatAction): string {
  const { value, selectionStart, selectionEnd } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);

  let newValue: string;
  let cursorPos: number;

  if (action.type === "wrap") {
    const wrapped = `${action.before}${selected || "文本"}${action.after}`;
    newValue = value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);
    cursorPos = selected
      ? selectionStart + wrapped.length
      : selectionStart + action.before.length;
  } else if (action.type === "prefix") {
    // Find the start of the current line
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const lineContent = value.slice(lineStart, selectionEnd);

    // Toggle: if already has prefix, remove it
    if (lineContent.startsWith(action.prefix)) {
      newValue = value.slice(0, lineStart) + lineContent.slice(action.prefix.length) + value.slice(selectionEnd);
      cursorPos = selectionEnd - action.prefix.length;
    } else {
      newValue = value.slice(0, lineStart) + action.prefix + value.slice(lineStart);
      cursorPos = selectionEnd + action.prefix.length;
    }
  } else {
    newValue = value.slice(0, selectionStart) + action.text + value.slice(selectionEnd);
    cursorPos = selectionStart + action.text.length;
  }

  // Use native setter to work with React controlled input
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype, "value",
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(textarea, newValue);
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.setSelectionRange(cursorPos, cursorPos);
  textarea.focus();

  return newValue;
}

type ToolbarButton = {
  key: string;
  label: string;
  title: string;
};

const BUTTONS: (ToolbarButton | "divider")[] = [
  { key: "bold", label: "B", title: "粗体 (Ctrl+B 不可用时)" },
  { key: "italic", label: "I", title: "斜体" },
  "divider",
  { key: "h1", label: "H1", title: "一级标题" },
  { key: "h2", label: "H2", title: "二级标题" },
  { key: "h3", label: "H3", title: "三级标题" },
  "divider",
  { key: "list", label: "•", title: "无序列表" },
  { key: "ordered", label: "1.", title: "有序列表" },
  { key: "quote", label: "\u201C", title: "引用" },
  "divider",
  { key: "divider", label: "\u2014", title: "分割线" },
];

export function EditorToolbar({ textareaRef, onChange, disabled }: EditorToolbarProps) {
  function handleClick(key: string) {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const action = FORMAT_ACTIONS[key];
    if (!action) return;
    const newValue = applyFormat(textarea, action);
    onChange(newValue);
  }

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="文本格式工具栏">
      {BUTTONS.map((btn, i) => {
        if (btn === "divider") {
          return <span key={`div-${i}`} className="editor-toolbar-divider" />;
        }
        return (
          <button
            key={btn.key}
            type="button"
            className="editor-toolbar-btn"
            title={btn.title}
            disabled={disabled}
            onClick={() => handleClick(btn.key)}
          >
            {btn.label}
          </button>
        );
      })}
    </div>
  );
}
