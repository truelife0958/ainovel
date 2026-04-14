# Frontend Workspace Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the large frontend workspace components into shared document-workspace primitives plus writing-specific sidecars, while removing duplicated request/state logic and preserving existing API behavior.

**Architecture:** Move workflow-heavy logic into testable `lib/workspace/*.js` and `lib/writing/*.js` helpers, then keep the React layer thin: a shared document controller hook for generic document CRUD + AI actions, shared workspace presentation components, and writing-only hooks/panels for brief/context/repair behavior. This keeps the reusable document flow in one place without forcing chapter-only rules into the generic layer.

**Tech Stack:** Next.js App Router, React 19, TypeScript TSX components, strict `.d.ts` companions for JS helpers, Node built-in test runner (`node --test`)

---

> **Repository note:** `D:\ebak\webnovel-writer-master` is not currently a Git worktree. During execution, use local checkpoints instead of commit steps. If `.git` is restored before implementation, turn each checkpoint into a real commit.

## File Structure

- `lib/workspace/controller.js`: Pure request helpers and state-reconciliation helpers for generic document workspace actions.
- `lib/workspace/controller.d.ts`: Type surface for the shared controller helpers consumed by TSX files.
- `tests/workspace/controller.test.mjs`: TDD coverage for generic document select/create/save/AI behavior.
- `components/workspace/use-project-document-controller.ts`: Thin React hook that wires controller helpers into state and transitions.
- `components/workspace/document-sidebar.tsx`: Shared left rail for create + select document flows.
- `components/workspace/document-editor-shell.tsx`: Shared editor card shell for header/save/footer framing.
- `components/workspace/document-assistant-panel.tsx`: Generic assistant UI for non-writing workspaces.
- `lib/document-workspace/focus.js`: Existing focus/copy helpers, updated for the normalized copy pass.
- `lib/document-workspace/focus.d.ts`: Updated types for the focus helper output.
- `tests/document-workspace/focus.test.mjs`: Regression tests for the generic workspace copy contract.
- `lib/writing/workspace.js`: Pure writing-sidecar helpers for brief/context loading, brief saving, initial assistant request reuse, repair-action dedupe, and AI status messaging.
- `lib/writing/workspace.d.ts`: Type surface for writing-sidecar helpers.
- `tests/writing/workspace.test.mjs`: TDD coverage for the writing-sidecar helper module.
- `components/writing-studio/use-writing-sidecars.ts`: Thin React hook for brief/context synchronization and brief saving.
- `components/writing-studio/brief-panel.tsx`: Chapter brief editor + diagnostic panel.
- `components/writing-studio/assistant-panel.tsx`: Chapter assistant controls, write guard, and repair actions.
- `components/writing-studio/context-panel.tsx`: Chapter context display panel.
- `components/document-workspace.tsx`: Refactored to a small composition layer on top of the shared controller/components.
- `components/writing-studio.tsx`: Refactored to compose the shared controller with writing-sidecar helpers and chapter-specific panels.

### Task 1: Extract and Test the Shared Workspace Controller Core

**Files:**
- Create: `lib/workspace/controller.js`
- Create: `lib/workspace/controller.d.ts`
- Test: `tests/workspace/controller.test.mjs`

- [ ] **Step 1: Write the failing controller-core test**

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  createWorkspaceDocument,
  reconcileWorkspaceState,
  runWorkspaceAiAction,
  saveWorkspaceDocument,
  selectWorkspaceDocument,
} from "../../lib/workspace/controller.js";

function jsonResponse(payload, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    },
  };
}

const outlineDocument = {
  kind: "outline",
  directory: "outlines",
  fileName: "master-outline.md",
  title: "Master Outline",
  relativePath: "outlines/master-outline.md",
  updatedAt: "2026-03-31 10:00:00",
  preview: "Volume one enters the city",
  content: "# Master Outline\n\n- Volume one enters the city",
};

const outlineDocuments = [
  {
    kind: "outline",
    directory: "outlines",
    fileName: "master-outline.md",
    title: "Master Outline",
    relativePath: "outlines/master-outline.md",
    updatedAt: "2026-03-31 10:00:00",
    preview: "Volume one enters the city",
  },
];

test("selectWorkspaceDocument reads the selected file", async () => {
  const calls = [];

  const document = await selectWorkspaceDocument({
    kind: "outline",
    fileName: "master-outline.md",
    fetchImpl: async (input) => {
      calls.push(String(input));
      return jsonResponse({ ok: true, data: outlineDocument });
    },
  });

  assert.equal(
    calls[0],
    "/api/projects/current/documents?kind=outline&file=master-outline.md",
  );
  assert.equal(document.title, "Master Outline");
});

test("createWorkspaceDocument posts the title and returns a normalized message", async () => {
  const calls = [];

  const result = await createWorkspaceDocument({
    kind: "outline",
    title: "Volume One",
    fetchImpl: async (input, init) => {
      calls.push({ input: String(input), init });
      return jsonResponse({
        ok: true,
        data: {
          document: { ...outlineDocument, title: "Volume One" },
          documents: outlineDocuments,
        },
      });
    },
  });

  assert.equal(calls[0].input, "/api/projects/current/documents");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    kind: "outline",
    title: "Volume One",
  });
  assert.equal(result.message, "已创建《Volume One》");
});

test("saveWorkspaceDocument posts the content and returns a normalized message", async () => {
  const calls = [];

  const result = await saveWorkspaceDocument({
    kind: "outline",
    fileName: "master-outline.md",
    content: "# Updated Outline",
    fetchImpl: async (input, init) => {
      calls.push({ input: String(input), init });
      return jsonResponse({
        ok: true,
        data: {
          document: { ...outlineDocument, content: "# Updated Outline" },
          documents: outlineDocuments,
        },
      });
    },
  });

  assert.equal(calls[0].init.method, "PUT");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    kind: "outline",
    fileName: "master-outline.md",
    content: "# Updated Outline",
  });
  assert.equal(result.message, "已保存《Master Outline》");
});

test("runWorkspaceAiAction returns the AI result plus a normalized status message", async () => {
  const result = await runWorkspaceAiAction({
    kind: "outline",
    fileName: "master-outline.md",
    mode: "outline_plan",
    userRequest: "Tighten the hook chain",
    applyMode: "replace",
    fetchImpl: async () =>
      jsonResponse({
        ok: true,
        data: {
          target: "document",
          provider: "openai",
          model: "gpt-5-mini",
          role: "outlining",
          generatedText: "# Sharper Outline",
          document: { ...outlineDocument, content: "# Sharper Outline" },
          documents: outlineDocuments,
          briefValidation: null,
        },
      }),
  });

  assert.equal(result.message, "已使用 openai / gpt-5-mini 更新《Master Outline》");
  assert.equal(result.result.target, "document");
});

test("reconcileWorkspaceState keeps the current document when AI updates a brief target", () => {
  const next = reconcileWorkspaceState(outlineDocument, {
    target: "brief",
    provider: "openai",
    model: "gpt-5-mini",
    role: "outlining",
    generatedText: "- Goal: tighten the trap",
    document: {
      chapterNumber: 6,
      title: "Chapter 006 Brief",
      fileName: "chapter-006.md",
      relativePath: ".webnovel/briefs/chapter-006.md",
      content: "- Goal: tighten the trap",
      updatedAt: "2026-03-31 10:10:00",
    },
    documents: outlineDocuments,
    briefValidation: {
      missingFields: ["Hook"],
      warnings: [],
    },
  });

  assert.equal(next.selectedDocument?.title, "Master Outline");
  assert.equal(next.draftContent, outlineDocument.content);
});

test("saveWorkspaceDocument throws the route error message on failure", async () => {
  await assert.rejects(
    () =>
      saveWorkspaceDocument({
        kind: "outline",
        fileName: "master-outline.md",
        content: "# Broken",
        fetchImpl: async () => jsonResponse({ ok: false, error: "Unable to save document" }, false),
      }),
    /Unable to save document/,
  );
});
```

- [ ] **Step 2: Run the targeted test to confirm the red state**

Run: `node --test tests/workspace/controller.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../../lib/workspace/controller.js`.

- [ ] **Step 3: Implement the shared controller helper module and types**

```js
// lib/workspace/controller.js
function jsonHeaders() {
  return {
    "Content-Type": "application/json",
  };
}

async function readApiData(response, fallbackError) {
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || fallbackError);
  }
  return payload.data;
}

export function buildWorkspaceMutationMessage({ type, title, provider = "", model = "" }) {
  const safeTitle = String(title || "").trim();
  if (type === "create") {
    return `已创建《${safeTitle}》`;
  }
  if (type === "save") {
    return `已保存《${safeTitle}》`;
  }
  if (type === "ai") {
    return `已使用 ${provider} / ${model} 更新《${safeTitle}》`;
  }
  return "";
}

export function reconcileWorkspaceState(currentDocument, payload) {
  if (payload?.target === "document") {
    return {
      documents: payload.documents,
      selectedDocument: payload.document,
      draftContent: payload.document.content,
    };
  }

  if (payload?.target === "brief") {
    return {
      documents: payload.documents,
      selectedDocument: currentDocument,
      draftContent: currentDocument?.content || "",
    };
  }

  return {
    documents: payload.documents,
    selectedDocument: payload.document,
    draftContent: payload.document.content,
  };
}

export async function selectWorkspaceDocument({ kind, fileName, fetchImpl = fetch }) {
  const query = new URLSearchParams({ kind, file: fileName });
  const response = await fetchImpl(`/api/projects/current/documents?${query.toString()}`);
  return readApiData(response, "Unable to load document");
}

export async function createWorkspaceDocument({ kind, title, fetchImpl = fetch }) {
  const response = await fetchImpl("/api/projects/current/documents", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ kind, title }),
  });
  const data = await readApiData(response, "Unable to create document");
  return {
    ...data,
    message: buildWorkspaceMutationMessage({ type: "create", title: data.document.title }),
  };
}

export async function saveWorkspaceDocument({ kind, fileName, content, fetchImpl = fetch }) {
  const response = await fetchImpl("/api/projects/current/documents", {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify({ kind, fileName, content }),
  });
  const data = await readApiData(response, "Unable to save document");
  return {
    ...data,
    message: buildWorkspaceMutationMessage({ type: "save", title: data.document.title }),
  };
}

export async function runWorkspaceAiAction({
  kind,
  fileName,
  mode,
  userRequest,
  applyMode,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl("/api/projects/current/actions", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ kind, fileName, mode, userRequest, applyMode }),
  });
  const result = await readApiData(response, "Unable to run AI action");
  return {
    result,
    message: buildWorkspaceMutationMessage({
      type: "ai",
      title: result.document.title,
      provider: result.provider,
      model: result.model,
    }),
  };
}
```

```ts
// lib/workspace/controller.d.ts
import type { DocumentAiApplyMode, DocumentAiMode, DocumentAiResult } from "@/types/ai";
import type { ProjectDocument, ProjectDocumentKind, ProjectDocumentMeta } from "@/types/documents";

export type WorkspaceFetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  json(): Promise<any>;
}>;

export type WorkspaceDocumentMutation = {
  document: ProjectDocument;
  documents: ProjectDocumentMeta[];
  message: string;
};

export type WorkspaceStateSlice = {
  documents: ProjectDocumentMeta[];
  selectedDocument: ProjectDocument | null;
  draftContent: string;
};

export function buildWorkspaceMutationMessage(input: {
  type: "create" | "save" | "ai";
  title: string;
  provider?: string;
  model?: string;
}): string;

export function reconcileWorkspaceState(
  currentDocument: ProjectDocument | null,
  payload: { document: ProjectDocument; documents: ProjectDocumentMeta[] } | DocumentAiResult,
): WorkspaceStateSlice;

export function selectWorkspaceDocument(input: {
  kind: ProjectDocumentKind;
  fileName: string;
  fetchImpl?: WorkspaceFetchLike;
}): Promise<ProjectDocument>;

export function createWorkspaceDocument(input: {
  kind: ProjectDocumentKind;
  title: string;
  fetchImpl?: WorkspaceFetchLike;
}): Promise<WorkspaceDocumentMutation>;

export function saveWorkspaceDocument(input: {
  kind: ProjectDocumentKind;
  fileName: string;
  content: string;
  fetchImpl?: WorkspaceFetchLike;
}): Promise<WorkspaceDocumentMutation>;

export function runWorkspaceAiAction(input: {
  kind: ProjectDocumentKind;
  fileName: string;
  mode: DocumentAiMode;
  userRequest: string;
  applyMode: DocumentAiApplyMode;
  fetchImpl?: WorkspaceFetchLike;
}): Promise<{
  result: DocumentAiResult;
  message: string;
}>;
```

- [ ] **Step 4: Run the targeted test to confirm green**

Run: `node --test tests/workspace/controller.test.mjs`
Expected: PASS with 6 passing tests and 0 failures.

- [ ] **Step 5: Create a local checkpoint**

Checkpoint: `shared workspace controller core extracted and covered by node tests`

### Task 2: Refactor `DocumentWorkspace` onto Shared Hook and UI Primitives

**Files:**
- Create: `components/workspace/use-project-document-controller.ts`
- Create: `components/workspace/document-sidebar.tsx`
- Create: `components/workspace/document-editor-shell.tsx`
- Create: `components/workspace/document-assistant-panel.tsx`
- Modify: `components/document-workspace.tsx`
- Modify: `lib/document-workspace/focus.js`
- Modify: `lib/document-workspace/focus.d.ts`
- Test: `tests/document-workspace/focus.test.mjs`

- [ ] **Step 1: Write the failing copy-regression test for the generic workspace helper layer**

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDocumentWorkspaceAssistantFocus,
  buildDocumentWorkspaceFooterNote,
  buildDocumentWorkspaceSidebarFocus,
} from "../../lib/document-workspace/focus.js";

test("buildDocumentWorkspaceSidebarFocus prefers the selected document title", () => {
  const focus = buildDocumentWorkspaceSidebarFocus({
    documentsCount: 3,
    selectedTitle: "Volume One",
    emptyMessage: "No outline files yet.",
  });

  assert.equal(focus.countLabel, "3 份文档");
  assert.equal(focus.summaryText, "当前：Volume One");
});

test("buildDocumentWorkspaceAssistantFocus uses the tightened placeholders", () => {
  const available = buildDocumentWorkspaceAssistantFocus({
    assistantAvailable: true,
    hasSelectedDocument: true,
    assistantStatusMessage: "AI 已就绪：OpenAI / gpt-5-mini",
    statusMessage: "已使用 OpenAI / gpt-5-mini 更新《Volume One》",
  });
  const unavailable = buildDocumentWorkspaceAssistantFocus({
    assistantAvailable: false,
    hasSelectedDocument: true,
    assistantStatusMessage: "",
    statusMessage: "",
  });
  const noSelection = buildDocumentWorkspaceAssistantFocus({
    assistantAvailable: true,
    hasSelectedDocument: false,
    assistantStatusMessage: "",
    statusMessage: "",
  });

  assert.equal(
    available.placeholder,
    "补充这次想强化的方向，例如：提高结尾钩子、补强冲突链、压缩解释段。",
  );
  assert.equal(unavailable.placeholder, "先在设置页配置 API Key，再启用 AI 规划。");
  assert.equal(noSelection.placeholder, "先选择文档，再补充本次规划或改写意图。");
});

test("buildDocumentWorkspaceFooterNote keeps the markdown fallback compact", () => {
  assert.equal(
    buildDocumentWorkspaceFooterNote({
      hasAssistantActions: false,
      statusMessage: "",
      itemLabel: "设定",
    }),
    "当前内容保存为 Markdown，可继续维护设定内容。",
  );
});
```

- [ ] **Step 2: Run the focused regression test and confirm it fails on the old copy**

Run: `node --test tests/document-workspace/focus.test.mjs`
Expected: FAIL because the current placeholder/footer strings still match the old copy.

- [ ] **Step 3: Update the focus helper copy contract**

```js
// lib/document-workspace/focus.js
function compactLines(items) {
  return items.map((item) => String(item || "").trim()).filter(Boolean);
}

export function buildDocumentWorkspaceSidebarFocus({
  documentsCount,
  selectedTitle,
  emptyMessage,
}) {
  return {
    countLabel: `${documentsCount} 份文档`,
    summaryText: selectedTitle ? `当前：${selectedTitle}` : emptyMessage,
  };
}

export function buildDocumentWorkspaceAssistantFocus({
  assistantAvailable,
  hasSelectedDocument,
  assistantStatusMessage,
  statusMessage,
}) {
  let placeholder = "先选择文档，再补充本次规划或改写意图。";
  if (!assistantAvailable) {
    placeholder = "先在设置页配置 API Key，再启用 AI 规划。";
  } else if (hasSelectedDocument) {
    placeholder = "补充这次想强化的方向，例如：提高结尾钩子、补强冲突链、压缩解释段。";
  }

  return {
    placeholder,
    notes: compactLines([assistantStatusMessage, statusMessage]),
  };
}

export function buildDocumentWorkspaceFooterNote({
  hasAssistantActions,
  statusMessage,
  itemLabel,
}) {
  if (hasAssistantActions) {
    return "";
  }

  return String(statusMessage || "").trim() || `当前内容保存为 Markdown，可继续维护${itemLabel}内容。`;
}
```

```ts
// lib/document-workspace/focus.d.ts
export type DocumentWorkspaceSidebarFocus = {
  countLabel: string;
  summaryText: string;
};

export type DocumentWorkspaceAssistantFocus = {
  placeholder: string;
  notes: string[];
};

export function buildDocumentWorkspaceSidebarFocus(input: {
  documentsCount: number;
  selectedTitle: string;
  emptyMessage: string;
}): DocumentWorkspaceSidebarFocus;

export function buildDocumentWorkspaceAssistantFocus(input: {
  assistantAvailable: boolean;
  hasSelectedDocument: boolean;
  assistantStatusMessage: string;
  statusMessage: string;
}): DocumentWorkspaceAssistantFocus;

export function buildDocumentWorkspaceFooterNote(input: {
  hasAssistantActions: boolean;
  statusMessage: string;
  itemLabel: string;
}): string;
```

- [ ] **Step 4: Create the shared React controller/components and slim down `DocumentWorkspace`**

```ts
// components/workspace/use-project-document-controller.ts
"use client";

import { useEffect, useState, useTransition } from "react";

import {
  createWorkspaceDocument,
  reconcileWorkspaceState,
  runWorkspaceAiAction,
  saveWorkspaceDocument,
  selectWorkspaceDocument,
} from "@/lib/workspace/controller.js";
import type { DocumentAiApplyMode, DocumentAiMode, DocumentAiResult } from "@/types/ai";
import type { ProjectDocument, ProjectDocumentKind, ProjectDocumentMeta } from "@/types/documents";

type ControllerInput = {
  kind: ProjectDocumentKind;
  initialDocuments: ProjectDocumentMeta[];
  initialDocument: ProjectDocument | null;
  initialAssistantRequest?: string;
};

export function useProjectDocumentController({
  kind,
  initialDocuments,
  initialDocument,
  initialAssistantRequest = "",
}: ControllerInput) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(initialDocument);
  const [draftContent, setDraftContent] = useState(initialDocument?.content ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [assistantRequest, setAssistantRequest] = useState(initialAssistantRequest);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraftContent(selectedDocument?.content ?? "");
  }, [selectedDocument]);

  function runTask(task: () => Promise<void>) {
    setMessage("");
    startTransition(async () => {
      try {
        await task();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败");
      }
    });
  }

  function applyMutation(payload: { document: ProjectDocument; documents: ProjectDocumentMeta[] } | DocumentAiResult) {
    const next = reconcileWorkspaceState(selectedDocument, payload);
    setDocuments(next.documents);
    setSelectedDocument(next.selectedDocument);
    setDraftContent(next.draftContent);
  }

  function selectDocument(fileName: string) {
    if (selectedDocument?.fileName === fileName) {
      return;
    }
    runTask(async () => {
      const document = await selectWorkspaceDocument({ kind, fileName });
      setSelectedDocument(document);
    });
  }

  function createDocument() {
    if (!newTitle.trim()) {
      return;
    }
    runTask(async () => {
      const result = await createWorkspaceDocument({ kind, title: newTitle.trim() });
      applyMutation(result);
      setNewTitle("");
      setMessage(result.message);
    });
  }

  function saveDocument() {
    if (!selectedDocument) {
      return;
    }
    runTask(async () => {
      const result = await saveWorkspaceDocument({
        kind,
        fileName: selectedDocument.fileName,
        content: draftContent,
      });
      applyMutation(result);
      setMessage(result.message);
    });
  }

  async function runAiAction(input: {
    mode: DocumentAiMode;
    userRequest: string;
    applyMode: DocumentAiApplyMode;
  }) {
    if (!selectedDocument) {
      throw new Error("必须先选择文档");
    }
    const { result, message: nextMessage } = await runWorkspaceAiAction({
      kind,
      fileName: selectedDocument.fileName,
      mode: input.mode,
      userRequest: input.userRequest,
      applyMode: input.applyMode,
    });
    applyMutation(result);
    setMessage(nextMessage);
    return result;
  }

  return {
    documents,
    selectedDocument,
    draftContent,
    newTitle,
    assistantRequest,
    message,
    isPending,
    setDraftContent,
    setNewTitle,
    setAssistantRequest,
    setMessage,
    runTask,
    applyMutation,
    selectDocument,
    createDocument,
    saveDocument,
    runAiAction,
  };
}
```

```tsx
// components/workspace/document-sidebar.tsx
"use client";

import type { FormEvent, ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import type { ProjectDocument, ProjectDocumentMeta } from "@/types/documents";

type DocumentSidebarProps = {
  helper?: ReactNode;
  createLabel: string;
  createPlaceholder: string;
  emptyMessage: string;
  newTitle: string;
  isPending: boolean;
  documents: ProjectDocumentMeta[];
  selectedDocument: ProjectDocument | null;
  onNewTitleChange: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: (fileName: string) => void;
};

export function DocumentSidebar({
  helper,
  createLabel,
  createPlaceholder,
  emptyMessage,
  newTitle,
  isPending,
  documents,
  selectedDocument,
  onNewTitleChange,
  onCreate,
  onSelect,
}: DocumentSidebarProps) {
  return (
    <aside className="document-sidebar">
      {helper}
      <form className="create-row" onSubmit={onCreate}>
        <input
          value={newTitle}
          onChange={(event) => onNewTitleChange(event.target.value)}
          placeholder={createPlaceholder}
        />
        <button type="submit" className="action-button" disabled={isPending || !newTitle.trim()}>
          {createLabel}
        </button>
      </form>
      <div className="document-list">
        {documents.length ? (
          documents.map((document) => {
            const isSelected = selectedDocument?.fileName === document.fileName;
            return (
              <button
                key={document.fileName}
                type="button"
                className={isSelected ? "document-item active" : "document-item"}
                onClick={() => onSelect(document.fileName)}
                disabled={isPending}
              >
                <strong>{document.title}</strong>
                <span>{document.preview || "空白文档"}</span>
              </button>
            );
          })
        ) : (
          <EmptyState variant="card" message={emptyMessage} />
        )}
      </div>
    </aside>
  );
}
```

```tsx
// components/workspace/document-editor-shell.tsx
"use client";

import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";

type DocumentEditorShellProps = {
  hasSelection: boolean;
  eyebrow: string;
  title: string;
  pathLabel?: string;
  saveLabel: string;
  isPending: boolean;
  emptyMessage: string;
  footerNote?: string;
  onSave: () => void;
  children: ReactNode;
};

export function DocumentEditorShell({
  hasSelection,
  eyebrow,
  title,
  pathLabel,
  saveLabel,
  isPending,
  emptyMessage,
  footerNote,
  onSave,
  children,
}: DocumentEditorShellProps) {
  return (
    <div className="editor-card">
      {hasSelection ? (
        <>
          <div className="editor-toolbar">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <strong>{title}</strong>
              {pathLabel ? <p className="muted">{pathLabel}</p> : null}
            </div>
            <button type="button" className="action-button" disabled={isPending} onClick={onSave}>
              {isPending ? "处理中..." : saveLabel}
            </button>
          </div>
          {children}
        </>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
      {footerNote ? <p className="muted">{footerNote}</p> : null}
    </div>
  );
}
```

```tsx
// components/workspace/document-assistant-panel.tsx
"use client";

import type { DocumentAiApplyMode, DocumentAiMode } from "@/types/ai";

type AssistantAction = {
  mode: DocumentAiMode;
  label: string;
  description: string;
  applyMode: DocumentAiApplyMode;
};

type DocumentAssistantPanelProps = {
  title: string;
  description: string;
  assistantRequest: string;
  placeholder: string;
  notes: string[];
  assistantAvailable: boolean;
  isPending: boolean;
  actions: AssistantAction[];
  onAssistantRequestChange: (value: string) => void;
  onRunAction: (action: AssistantAction) => void;
};

export function DocumentAssistantPanel({
  title,
  description,
  assistantRequest,
  placeholder,
  notes,
  assistantAvailable,
  isPending,
  actions,
  onAssistantRequestChange,
  onRunAction,
}: DocumentAssistantPanelProps) {
  return (
    <div className="assistant-panel">
      <div>
        <p className="eyebrow">{title}</p>
        <p className="muted">{description}</p>
      </div>
      <textarea
        rows={4}
        value={assistantRequest}
        onChange={(event) => onAssistantRequestChange(event.target.value)}
        placeholder={placeholder}
        disabled={!assistantAvailable}
      />
      <div className="assistant-actions">
        {actions.map((action) => (
          <button
            key={`${action.mode}:${action.applyMode}`}
            type="button"
            className="action-button secondary"
            disabled={isPending || !assistantAvailable}
            onClick={() => onRunAction(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="assistant-notes">
        {notes.map((note) => (
          <p key={note} className="muted">
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// components/document-workspace.tsx
"use client";

import type { FormEvent } from "react";

import { DocumentAssistantPanel } from "@/components/workspace/document-assistant-panel";
import { DocumentEditorShell } from "@/components/workspace/document-editor-shell";
import { DocumentSidebar } from "@/components/workspace/document-sidebar";
import { useProjectDocumentController } from "@/components/workspace/use-project-document-controller";
import {
  buildDocumentWorkspaceAssistantFocus,
  buildDocumentWorkspaceFooterNote,
  buildDocumentWorkspaceSidebarFocus,
} from "@/lib/document-workspace/focus.js";
import type { ProjectDocument, ProjectDocumentKind, ProjectDocumentMeta } from "@/types/documents";
import type { ProviderRuntimeStatus } from "@/types/settings";

export function DocumentWorkspace({
  kind,
  initialDocuments,
  initialDocument,
  createLabel,
  createPlaceholder,
  emptyMessage,
  assistantActions,
  assistantStatus,
}: {
  kind: ProjectDocumentKind;
  initialDocuments: ProjectDocumentMeta[];
  initialDocument: ProjectDocument | null;
  createLabel: string;
  createPlaceholder: string;
  emptyMessage: string;
  assistantActions?: {
    title: string;
    description: string;
    actions: Array<{
      mode: "outline_plan" | "chapter_plan" | "chapter_write";
      label: string;
      description: string;
      applyMode: "replace" | "append";
    }>;
  };
  assistantStatus?: ProviderRuntimeStatus;
}) {
  const controller = useProjectDocumentController({
    kind,
    initialDocuments,
    initialDocument,
  });
  const hasSelectedDocument = Boolean(controller.selectedDocument);
  const assistantAvailable = assistantStatus?.available ?? true;
  const sidebarFocus = buildDocumentWorkspaceSidebarFocus({
    documentsCount: controller.documents.length,
    selectedTitle: controller.selectedDocument?.title ?? "",
    emptyMessage,
  });
  const assistantFocus = buildDocumentWorkspaceAssistantFocus({
    assistantAvailable,
    hasSelectedDocument,
    assistantStatusMessage: assistantStatus?.message ?? "",
    statusMessage: controller.message,
  });
  const footerNote = buildDocumentWorkspaceFooterNote({
    hasAssistantActions: Boolean(assistantActions),
    statusMessage: controller.message,
    itemLabel: kind === "setting" ? "设定" : kind === "outline" ? "大纲" : "章节",
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    controller.createDocument();
  }

  return (
    <div className="document-workspace">
      <DocumentSidebar
        helper={(
          <div className="list-card helper-card">
            <p className="eyebrow">文档列表</p>
            <strong>{sidebarFocus.countLabel}</strong>
            <p className="muted">{sidebarFocus.summaryText}</p>
          </div>
        )}
        createLabel={createLabel}
        createPlaceholder={createPlaceholder}
        emptyMessage={emptyMessage}
        newTitle={controller.newTitle}
        isPending={controller.isPending}
        documents={controller.documents}
        selectedDocument={controller.selectedDocument}
        onNewTitleChange={controller.setNewTitle}
        onCreate={handleCreate}
        onSelect={controller.selectDocument}
      />
      <DocumentEditorShell
        hasSelection={hasSelectedDocument}
        eyebrow="当前文档"
        title={controller.selectedDocument?.title ?? "未选择文档"}
        pathLabel={controller.selectedDocument?.relativePath ?? ""}
        saveLabel="保存"
        isPending={controller.isPending}
        emptyMessage={emptyMessage}
        footerNote={footerNote}
        onSave={controller.saveDocument}
      >
        {assistantActions ? (
          <DocumentAssistantPanel
            title={assistantActions.title}
            description={assistantActions.description}
            assistantRequest={controller.assistantRequest}
            placeholder={assistantFocus.placeholder}
            notes={assistantFocus.notes}
            assistantAvailable={assistantAvailable}
            isPending={controller.isPending}
            actions={assistantActions.actions}
            onAssistantRequestChange={controller.setAssistantRequest}
            onRunAction={(action) => {
              controller.runTask(async () => {
                await controller.runAiAction({
                  mode: action.mode,
                  userRequest: controller.assistantRequest,
                  applyMode: action.applyMode,
                });
              });
            }}
          />
        ) : null}
        <textarea
          className="editor-area"
          value={controller.draftContent}
          onChange={(event) => controller.setDraftContent(event.target.value)}
          spellCheck={false}
        />
      </DocumentEditorShell>
    </div>
  );
}
```

- [ ] **Step 5: Verify the generic workspace refactor compiles**

Run: `npm run build`
Expected: PASS with no unresolved import errors and no TypeScript errors from `components/document-workspace.tsx` or `components/workspace/*`.

- [ ] **Step 6: Create a local checkpoint**

Checkpoint: `DocumentWorkspace now uses shared controller and shared sidebar/editor/assistant components`

### Task 3: Extract and Test the Writing-Sidecar Helper Core

**Files:**
- Create: `lib/writing/workspace.js`
- Create: `lib/writing/workspace.d.ts`
- Test: `tests/writing/workspace.test.mjs`

- [ ] **Step 1: Write the failing writing-sidecar helper test**

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSecondaryRepairActions,
  buildWritingAiStatusMessage,
  loadWritingSidecars,
  resolveInitialAssistantRequest,
  saveWritingBrief,
} from "../../lib/writing/workspace.js";

function jsonResponse(payload, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    },
  };
}

test("loadWritingSidecars reads both brief and context for the selected chapter", async () => {
  const calls = [];

  const result = await loadWritingSidecars({
    fileName: "chapter-006.md",
    fetchImpl: async (input) => {
      calls.push(String(input));
      if (String(input).startsWith("/api/projects/current/briefs")) {
        return jsonResponse({
          ok: true,
          data: {
            chapterNumber: 6,
            title: "Chapter 006 Brief",
            fileName: "chapter-006.md",
            relativePath: ".webnovel/briefs/chapter-006.md",
            content: "- Goal: escape the trap",
            updatedAt: "2026-03-31 11:00:00",
          },
        });
      }
      return jsonResponse({
        ok: true,
        data: {
          chapterNumber: 6,
          outline: "The trap closes.",
          previousSummaries: ["The hero enters the store."],
          stateSummary: "Debt to the artifact remains unpaid.",
          guidanceItems: ["Enter late", "Exit on a cliffhanger"],
          error: "",
        },
      });
    },
  });

  assert.deepEqual(calls, [
    "/api/projects/current/briefs?file=chapter-006.md",
    "/api/projects/current/context?file=chapter-006.md",
  ]);
  assert.equal(result.brief.chapterNumber, 6);
  assert.equal(result.context.guidanceItems[1], "Exit on a cliffhanger");
});

test("saveWritingBrief posts content and returns the saved brief", async () => {
  const calls = [];

  const brief = await saveWritingBrief({
    fileName: "chapter-006.md",
    content: "- Goal: escape the trap\n- Hook: the debt collector arrives",
    fetchImpl: async (input, init) => {
      calls.push({ input: String(input), init });
      return jsonResponse({
        ok: true,
        data: {
          chapterNumber: 6,
          title: "Chapter 006 Brief",
          fileName: "chapter-006.md",
          relativePath: ".webnovel/briefs/chapter-006.md",
          content: "- Goal: escape the trap\n- Hook: the debt collector arrives",
          updatedAt: "2026-03-31 11:05:00",
        },
      });
    },
  });

  assert.equal(calls[0].input, "/api/projects/current/briefs");
  assert.equal(calls[0].init.method, "PUT");
  assert.equal(JSON.parse(calls[0].init.body).fileName, "chapter-006.md");
  assert.match(brief.content, /Hook/);
});

test("resolveInitialAssistantRequest only reuses the linked request once", () => {
  assert.deepEqual(
    resolveInitialAssistantRequest({
      selectedFileName: "chapter-006.md",
      initialDocumentFileName: "chapter-006.md",
      initialAssistantRequest: "Only sharpen the hook.",
      hasAppliedInitialRequest: false,
    }),
    {
      assistantRequest: "Only sharpen the hook.",
      hasAppliedInitialRequest: true,
    },
  );

  assert.deepEqual(
    resolveInitialAssistantRequest({
      selectedFileName: "chapter-007.md",
      initialDocumentFileName: "chapter-006.md",
      initialAssistantRequest: "Only sharpen the hook.",
      hasAppliedInitialRequest: true,
    }),
    {
      assistantRequest: "",
      hasAppliedInitialRequest: true,
    },
  );
});

test("buildSecondaryRepairActions removes null entries and duplicate keys", () => {
  const actions = buildSecondaryRepairActions({
    primaryRepair: {
      label: "AI 补全任务书",
      request: "Patch the missing fields only.",
    },
    secondaryActions: [
      { key: "ending", label: "补钩子链", request: "Focus on hook and end question." },
      { key: "ending", label: "补钩子链", request: "Duplicate should disappear." },
      null,
    ],
  });

  assert.equal(actions.length, 2);
  assert.equal(actions[1].key, "ending");
});

test("buildWritingAiStatusMessage prioritizes missing fields, then warnings, then success", () => {
  const missingFieldsMessage = buildWritingAiStatusMessage({
    provider: "openai",
    model: "gpt-5-mini",
    target: "brief",
    briefValidation: {
      missingFields: ["目标", "钩子"],
      warnings: [],
    },
  });
  const warningMessage = buildWritingAiStatusMessage({
    provider: "openai",
    model: "gpt-5-mini",
    target: "brief",
    briefValidation: {
      missingFields: [],
      warnings: [{ code: "hook_without_end_question", severity: "high", message: "Hook lacks an end question." }],
    },
  });
  const successMessage = buildWritingAiStatusMessage({
    provider: "openai",
    model: "gpt-5-mini",
    target: "document",
    briefValidation: null,
  });

  assert.match(missingFieldsMessage, /缺 2 项/);
  assert.match(warningMessage, /有 1 条结构提醒/);
  assert.equal(successMessage, "已使用 openai / gpt-5-mini 执行 chapter_write");
});
```

- [ ] **Step 2: Run the targeted writing-sidecar test to confirm the red state**

Run: `node --test tests/writing/workspace.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../../lib/writing/workspace.js`.

- [ ] **Step 3: Implement the pure writing-sidecar helpers and types**

```js
// lib/writing/workspace.js
import { buildChapterRepairAdvice } from "../ai/repair-request.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function readApiData(response, fallbackError) {
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || fallbackError);
  }
  return payload.data;
}

export async function loadWritingSidecars({ fileName, fetchImpl = fetch }) {
  const encodedFileName = encodeURIComponent(fileName);
  const [briefResponse, contextResponse] = await Promise.all([
    fetchImpl(`/api/projects/current/briefs?file=${encodedFileName}`),
    fetchImpl(`/api/projects/current/context?file=${encodedFileName}`),
  ]);

  const brief = await readApiData(briefResponse, "Unable to load chapter brief");
  const context = await readApiData(contextResponse, "Unable to load chapter context");
  return { brief, context };
}

export async function saveWritingBrief({ fileName, content, fetchImpl = fetch }) {
  const response = await fetchImpl("/api/projects/current/briefs", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileName, content }),
  });
  return readApiData(response, "Unable to save chapter brief");
}

export function resolveInitialAssistantRequest({
  selectedFileName,
  initialDocumentFileName,
  initialAssistantRequest,
  hasAppliedInitialRequest,
}) {
  if (!selectedFileName) {
    return {
      assistantRequest: "",
      hasAppliedInitialRequest: false,
    };
  }

  const isLinkedSelection =
    Boolean(initialAssistantRequest) && selectedFileName === initialDocumentFileName;

  if (isLinkedSelection && !hasAppliedInitialRequest) {
    return {
      assistantRequest: initialAssistantRequest,
      hasAppliedInitialRequest: true,
    };
  }

  return {
    assistantRequest: isLinkedSelection ? initialAssistantRequest : "",
    hasAppliedInitialRequest,
  };
}

export function buildSecondaryRepairActions({ primaryRepair, secondaryActions }) {
  const candidates = [primaryRepair, ...asArray(secondaryActions)].filter(Boolean);
  const seen = new Set();

  return candidates.filter((action) => {
    const key = action.key || action.label;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildWritingAiStatusMessage(result) {
  const validation = result?.briefValidation;
  const repairAdvice = buildChapterRepairAdvice(validation);
  if (!validation) {
    return `已使用 ${result.provider} / ${result.model} 执行 ${result.target === "brief" ? "chapter_plan" : "chapter_write"}`;
  }

  if (validation.missingFields.length > 0) {
    return `已生成内容，但任务书仍缺 ${validation.missingFields.length} 项：${validation.missingFields.slice(0, 3).join("、")}。${repairAdvice}`;
  }

  if (validation.warnings.length > 0) {
    return `已生成内容，但任务书有 ${validation.warnings.length} 条结构提醒。${repairAdvice}`;
  }

  return `已使用 ${result.provider} / ${result.model} 执行 ${result.target === "brief" ? "chapter_plan" : "chapter_write"}，任务书结构通过`;
}
```

```ts
// lib/writing/workspace.d.ts
import type { DocumentAiResult } from "@/types/ai";
import type { ChapterBrief } from "@/types/briefs";
import type { ChapterContext } from "@/types/context";

export type WritingFetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  json(): Promise<any>;
}>;

export type WritingRepairAction = {
  key?: string;
  label: string;
  request: string;
};

export function loadWritingSidecars(input: {
  fileName: string;
  fetchImpl?: WritingFetchLike;
}): Promise<{
  brief: ChapterBrief;
  context: ChapterContext;
}>;

export function saveWritingBrief(input: {
  fileName: string;
  content: string;
  fetchImpl?: WritingFetchLike;
}): Promise<ChapterBrief>;

export function resolveInitialAssistantRequest(input: {
  selectedFileName: string;
  initialDocumentFileName: string;
  initialAssistantRequest: string;
  hasAppliedInitialRequest: boolean;
}): {
  assistantRequest: string;
  hasAppliedInitialRequest: boolean;
};

export function buildSecondaryRepairActions(input: {
  primaryRepair: WritingRepairAction | null;
  secondaryActions: Array<WritingRepairAction | null | undefined>;
}): WritingRepairAction[];

export function buildWritingAiStatusMessage(result: Pick<
  DocumentAiResult,
  "provider" | "model" | "target" | "briefValidation"
>): string;
```

- [ ] **Step 4: Run the targeted writing-sidecar test to confirm green**

Run: `node --test tests/writing/workspace.test.mjs`
Expected: PASS with 5 passing tests and 0 failures.

- [ ] **Step 5: Create a local checkpoint**

Checkpoint: `writing-sidecar helper logic extracted and covered by node tests`

### Task 4: Refactor `WritingStudio` into Sidecar Hook + Chapter Panels

**Files:**
- Create: `components/writing-studio/use-writing-sidecars.ts`
- Create: `components/writing-studio/brief-panel.tsx`
- Create: `components/writing-studio/assistant-panel.tsx`
- Create: `components/writing-studio/context-panel.tsx`
- Modify: `components/writing-studio.tsx`

- [ ] **Step 1: Add the writing-sidecar hook around the tested helper layer**

```ts
// components/writing-studio/use-writing-sidecars.ts
"use client";

import { useEffect, useRef, useState } from "react";

import { loadWritingSidecars, resolveInitialAssistantRequest, saveWritingBrief } from "@/lib/writing/workspace.js";
import type { ChapterBrief } from "@/types/briefs";
import type { ChapterContext } from "@/types/context";

type UseWritingSidecarsInput = {
  selectedFileName: string;
  initialDocumentFileName: string;
  initialBrief: ChapterBrief | null;
  initialContext: ChapterContext | null;
  initialAssistantRequest: string;
  setAssistantRequest: (value: string) => void;
  setMessage: (value: string) => void;
  runTask: (task: () => Promise<void>) => void;
};

export function useWritingSidecars({
  selectedFileName,
  initialDocumentFileName,
  initialBrief,
  initialContext,
  initialAssistantRequest,
  setAssistantRequest,
  setMessage,
  runTask,
}: UseWritingSidecarsInput) {
  const [brief, setBrief] = useState<ChapterBrief | null>(initialBrief);
  const [briefContent, setBriefContent] = useState(initialBrief?.content ?? "");
  const [context, setContext] = useState<ChapterContext | null>(initialContext);
  const [writeGuardArmed, setWriteGuardArmed] = useState(false);
  const [selectedSecondaryRepair, setSelectedSecondaryRepair] = useState("");
  const hasAppliedInitialRequest = useRef(false);
  const skipInitialSelectionLoad = useRef(Boolean(initialBrief || initialContext));

  useEffect(() => {
    setBriefContent(brief?.content ?? "");
  }, [brief]);

  useEffect(() => {
    setWriteGuardArmed(false);
    setSelectedSecondaryRepair("");
  }, [selectedFileName, briefContent]);

  useEffect(() => {
    const next = resolveInitialAssistantRequest({
      selectedFileName,
      initialDocumentFileName,
      initialAssistantRequest,
      hasAppliedInitialRequest: hasAppliedInitialRequest.current,
    });
    hasAppliedInitialRequest.current = next.hasAppliedInitialRequest;
    setAssistantRequest(next.assistantRequest);
  }, [initialAssistantRequest, initialDocumentFileName, selectedFileName, setAssistantRequest]);

  useEffect(() => {
    if (!selectedFileName) {
      setBrief(null);
      setContext(null);
      return;
    }
    if (selectedFileName === initialDocumentFileName && skipInitialSelectionLoad.current) {
      skipInitialSelectionLoad.current = false;
      return;
    }

    let cancelled = false;
    loadWritingSidecars({ fileName: selectedFileName })
      .then((sidecars) => {
        if (cancelled) {
          return;
        }
        setBrief(sidecars.brief);
        setContext(sidecars.context);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取章节辅助数据失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialDocumentFileName, selectedFileName, setMessage]);

  function refreshSidecars() {
    if (!selectedFileName) {
      return Promise.resolve(null);
    }
    return loadWritingSidecars({ fileName: selectedFileName }).then((sidecars) => {
      setBrief(sidecars.brief);
      setContext(sidecars.context);
      return sidecars;
    });
  }

  function saveBrief() {
    if (!selectedFileName) {
      return;
    }
    runTask(async () => {
      const nextBrief = await saveWritingBrief({
        fileName: selectedFileName,
        content: briefContent,
      });
      setBrief(nextBrief);
      setMessage(`已保存第 ${nextBrief.chapterNumber} 章任务书`);
    });
  }

  return {
    brief,
    briefContent,
    context,
    writeGuardArmed,
    selectedSecondaryRepair,
    setBrief,
    setBriefContent,
    setContext,
    setWriteGuardArmed,
    setSelectedSecondaryRepair,
    refreshSidecars,
    saveBrief,
  };
}
```

- [ ] **Step 2: Add the chapter-only panels and rewrite the studio composition layer**

```tsx
// components/writing-studio/brief-panel.tsx
"use client";

import { EmptyState } from "@/components/empty-state";
import type { ChapterBriefValidation, ParsedChapterBrief } from "@/types/briefs";

type BriefPanelProps = {
  hasSelection: boolean;
  title: string;
  briefContent: string;
  parsedBrief: ParsedChapterBrief;
  validation: ChapterBriefValidation;
  isPending: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
};

export function BriefPanel({
  hasSelection,
  title,
  briefContent,
  parsedBrief,
  validation,
  isPending,
  onChange,
  onSave,
}: BriefPanelProps) {
  const previewItems = [
    ["目标", parsedBrief.goal],
    ["阻力", parsedBrief.obstacle],
    ["代价", parsedBrief.cost],
    ["爽点", parsedBrief.rawCoolpoint],
    ["Strand", parsedBrief.strand],
    ["反派层级", parsedBrief.antagonistTier],
    ["视角/主角", parsedBrief.pov],
    ["关键实体", parsedBrief.keyEntities.join(" / ")],
    ["本章变化", parsedBrief.change],
    ["章末未闭合问题", parsedBrief.endQuestion],
    ["钩子", parsedBrief.hook || parsedBrief.rawHook],
  ];

  return (
    <section className="editor-card">
      <div className="editor-toolbar">
        <div>
          <p className="eyebrow">章节任务书</p>
          <strong>{title}</strong>
        </div>
        <button type="button" className="action-button secondary" disabled={isPending || !hasSelection} onClick={onSave}>
          保存任务书
        </button>
      </div>
      {hasSelection ? (
        <>
          <textarea className="editor-area compact-area" value={briefContent} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
          <div className="context-grid compact-grid">
            <div className="list-card inner-card">
              <p className="eyebrow">任务书速览</p>
              <ul>
                {previewItems.map(([label, value]) => (
                  <li key={label}>{label}：{value || "未填写"}</li>
                ))}
              </ul>
            </div>
            <div className="list-card inner-card">
              <p className="eyebrow">结构诊断</p>
              {validation.missingFields.length ? (
                <ul className="warning-list">
                  {validation.missingFields.map((field) => <li key={field}>缺：{field}</li>)}
                </ul>
              ) : (
                <p className="muted">必填字段已补齐。</p>
              )}
              {validation.warnings.length ? (
                <ul className="warning-list">
                  {validation.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}
                </ul>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <EmptyState message="先创建或选择章节，再编辑任务书。" />
      )}
    </section>
  );
}
```

```tsx
// components/writing-studio/assistant-panel.tsx
"use client";

import type { ProviderRuntimeStatus } from "@/types/settings";
import type { WritingRepairAction } from "@/lib/writing/workspace.js";

type WritingAssistantPanelProps = {
  hasSelection: boolean;
  assistantStatus: ProviderRuntimeStatus;
  assistantRequest: string;
  notes: string[];
  fallback: string;
  isPending: boolean;
  writeButtonLabel: string;
  selectedSecondaryRepair: string;
  secondaryActions: WritingRepairAction[];
  onAssistantRequestChange: (value: string) => void;
  onRunPlan: () => void;
  onRunPrimaryRepair: (() => void) | null;
  onRunWrite: () => void;
  onSelectSecondaryRepair: (value: string) => void;
  onRunSecondaryRepair: () => void;
  primaryRepairLabel?: string;
};

export function AssistantPanel({
  hasSelection,
  assistantStatus,
  assistantRequest,
  notes,
  fallback,
  isPending,
  writeButtonLabel,
  selectedSecondaryRepair,
  secondaryActions,
  onAssistantRequestChange,
  onRunPlan,
  onRunPrimaryRepair,
  onRunWrite,
  onSelectSecondaryRepair,
  onRunSecondaryRepair,
  primaryRepairLabel,
}: WritingAssistantPanelProps) {
  const assistantAvailable = assistantStatus.available;
  return (
    <section className="editor-card">
      <div className="editor-toolbar">
        <div>
          <p className="eyebrow">AI 输入区</p>
          <strong>{hasSelection ? "当前章节" : "未选择章节"}</strong>
        </div>
      </div>
      <textarea
        rows={4}
        value={assistantRequest}
        onChange={(event) => onAssistantRequestChange(event.target.value)}
        placeholder={assistantAvailable ? "补充这次想强化的目标，例如：加强章节结尾、压缩解释段、固定 Strand。" : "先在设置页配置 API Key，再启用 AI。"}
        disabled={!hasSelection || !assistantAvailable}
      />
      <div className="assistant-actions primary-actions">
        <button type="button" className="action-button secondary" disabled={isPending || !hasSelection || !assistantAvailable} onClick={onRunPlan}>
          AI 规划本章
        </button>
        {onRunPrimaryRepair && primaryRepairLabel ? (
          <button type="button" className="action-button" disabled={isPending || !hasSelection || !assistantAvailable} onClick={onRunPrimaryRepair}>
            推荐：{primaryRepairLabel}
          </button>
        ) : null}
        <button type="button" className="action-button secondary" disabled={isPending || !hasSelection || !assistantAvailable} onClick={onRunWrite}>
          {writeButtonLabel}
        </button>
      </div>
      {secondaryActions.length ? (
        <div className="assistant-secondary-row">
          <select value={selectedSecondaryRepair} onChange={(event) => onSelectSecondaryRepair(event.target.value)} disabled={isPending || !hasSelection || !assistantAvailable}>
            {secondaryActions.map((action) => (
              <option key={action.key || action.label} value={action.request}>
                {action.label}
              </option>
            ))}
          </select>
          <button type="button" className="action-button secondary" disabled={isPending || !hasSelection || !assistantAvailable || !selectedSecondaryRepair} onClick={onRunSecondaryRepair}>
            执行修补动作
          </button>
        </div>
      ) : null}
      <div className="assistant-notes">
        {notes.length ? notes.map((note) => <p key={note} className="muted">{note}</p>) : <p className="muted">{fallback}</p>}
      </div>
    </section>
  );
}
```

```tsx
// components/writing-studio/context-panel.tsx
"use client";

import { EmptyState } from "@/components/empty-state";
import type { WritingContextFocus } from "@/lib/writing/focus.js";

type ContextPanelProps = {
  hasSelection: boolean;
  chapterNumber: number;
  focus: WritingContextFocus;
};

export function ContextPanel({ hasSelection, chapterNumber, focus }: ContextPanelProps) {
  return (
    <section className="editor-card">
      <div className="editor-toolbar">
        <div>
          <p className="eyebrow">章节上下文</p>
          <strong>第 {chapterNumber} 章上下文</strong>
        </div>
      </div>
      {hasSelection ? (
        <div className="context-grid">
          <div className="list-card inner-card">
            <p className="eyebrow">本章大纲</p>
            <p className="muted context-pre">{focus.outlineText}</p>
          </div>
          <div className="list-card inner-card">
            <p className="eyebrow">前文摘要</p>
            <p className="muted context-pre">{focus.previousSummaryText}</p>
          </div>
          <div className="list-card inner-card">
            <p className="eyebrow">状态摘要</p>
            <p className="muted context-pre">{focus.stateSummaryText}</p>
          </div>
          <div className="list-card inner-card">
            <p className="eyebrow">执行建议</p>
            <ul>
              {focus.guidanceItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      ) : (
        <EmptyState message="章节选定后，这里会显示桥接上下文与执行建议。" />
      )}
    </section>
  );
}
```
```tsx
// components/writing-studio.tsx
"use client";

import { FormEvent, useEffect } from "react";

import { buildChapterRepairRecommendation, buildChapterRepairRequest } from "@/lib/ai/repair-request.js";
import { evaluateChapterWriteGuard } from "@/lib/ai/write-guard.js";
import { parseChapterBriefContent, validateChapterBrief } from "@/lib/projects/brief-format.js";
import { buildWritingAssistantFocus, buildWritingContextFocus } from "@/lib/writing/focus.js";
import {
  buildSecondaryRepairActions,
  buildWritingAiStatusMessage,
} from "@/lib/writing/workspace.js";
import { AssistantPanel } from "@/components/writing-studio/assistant-panel";
import { BriefPanel } from "@/components/writing-studio/brief-panel";
import { ContextPanel } from "@/components/writing-studio/context-panel";
import { useWritingSidecars } from "@/components/writing-studio/use-writing-sidecars";
import { DocumentEditorShell } from "@/components/workspace/document-editor-shell";
import { DocumentSidebar } from "@/components/workspace/document-sidebar";
import { useProjectDocumentController } from "@/components/workspace/use-project-document-controller";
import type { ChapterBrief } from "@/types/briefs";
import type { ChapterContext } from "@/types/context";
import type { ProjectDocument, ProjectDocumentMeta } from "@/types/documents";
import type { ProjectSummary } from "@/types/project";
import type { ProviderRuntimeStatus } from "@/types/settings";

export function WritingStudio({
  project,
  assistantStatus,
  initialDocuments,
  initialDocument,
  initialBrief,
  initialContext,
  initialAssistantRequest,
}: {
  project: ProjectSummary | null;
  assistantStatus: ProviderRuntimeStatus;
  initialDocuments: ProjectDocumentMeta[];
  initialDocument: ProjectDocument | null;
  initialBrief: ChapterBrief | null;
  initialContext: ChapterContext | null;
  initialAssistantRequest?: string;
}) {
  const controller = useProjectDocumentController({
    kind: "chapter",
    initialDocuments,
    initialDocument,
    initialAssistantRequest,
  });
  const sidecars = useWritingSidecars({
    selectedFileName: controller.selectedDocument?.fileName ?? "",
    initialDocumentFileName: initialDocument?.fileName ?? "",
    initialBrief,
    initialContext,
    initialAssistantRequest: initialAssistantRequest ?? "",
    setAssistantRequest: controller.setAssistantRequest,
    setMessage: controller.setMessage,
    runTask: controller.runTask,
  });
  const hasSelection = Boolean(controller.selectedDocument);
  const parsedBrief = parseChapterBriefContent(sidecars.briefContent);
  const briefValidation = validateChapterBrief(parsedBrief);
  const writeGuard = evaluateChapterWriteGuard(briefValidation);
  const primaryRepair = buildChapterRepairRequest(briefValidation);
  const recommendation = buildChapterRepairRecommendation(briefValidation);
  const secondaryActions = buildSecondaryRepairActions({
    primaryRepair,
    secondaryActions: recommendation.secondaryActions,
  });
  const assistantFocus = buildWritingAssistantFocus({
    recommendationSummary: recommendation.summary,
    assistantMessage: assistantStatus.message,
    statusMessage: controller.message,
    projectTitle: project?.title ?? "",
    documentCount: controller.documents.length,
  });
  const contextFocus = buildWritingContextFocus(sidecars.context);

  useEffect(() => {
    sidecars.setSelectedSecondaryRepair(secondaryActions[0]?.request || "");
  }, [controller.selectedDocument?.fileName, secondaryActions, sidecars.setSelectedSecondaryRepair]);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    controller.createDocument();
  }

  function handleRunPlan(request = controller.assistantRequest) {
    controller.runTask(async () => {
      const result = await controller.runAiAction({
        mode: "chapter_plan",
        userRequest: request,
        applyMode: "replace",
      });
      if (result.target === "brief") {
        sidecars.setBrief(result.document);
        sidecars.setBriefContent(result.document.content);
      }
      await sidecars.refreshSidecars();
      controller.setMessage(buildWritingAiStatusMessage(result));
    });
  }

  function handleRunWrite() {
    if (writeGuard.requiresConfirmation && !sidecars.writeGuardArmed) {
      sidecars.setWriteGuardArmed(true);
      controller.setMessage(writeGuard.summary);
      return;
    }
    controller.runTask(async () => {
      const result = await controller.runAiAction({
        mode: "chapter_write",
        userRequest: controller.assistantRequest,
        applyMode: "append",
      });
      sidecars.setWriteGuardArmed(false);
      await sidecars.refreshSidecars();
      controller.setMessage(buildWritingAiStatusMessage(result));
    });
  }

  return (
    <div className="writing-grid">
      <DocumentSidebar
        createLabel="新建章节"
        createPlaceholder="例如：第006章 / 第6章 反手封门"
        emptyMessage="当前项目还没有章节，可以先创建第一个章节。"
        newTitle={controller.newTitle}
        isPending={controller.isPending}
        documents={controller.documents}
        selectedDocument={controller.selectedDocument}
        onNewTitleChange={controller.setNewTitle}
        onCreate={handleCreate}
        onSelect={controller.selectDocument}
      />
      <div className="writing-stack">
        <BriefPanel
          hasSelection={hasSelection}
          title={sidecars.brief?.title ?? "未选择章节"}
          briefContent={sidecars.briefContent}
          parsedBrief={parsedBrief}
          validation={briefValidation}
          isPending={controller.isPending}
          onChange={sidecars.setBriefContent}
          onSave={sidecars.saveBrief}
        />
        <AssistantPanel
          hasSelection={hasSelection}
          assistantStatus={assistantStatus}
          assistantRequest={controller.assistantRequest}
          notes={assistantFocus.notes}
          fallback={assistantFocus.fallback}
          isPending={controller.isPending}
          writeButtonLabel={sidecars.writeGuardArmed && writeGuard.requiresConfirmation ? writeGuard.buttonLabel : "AI 生成正文"}
          selectedSecondaryRepair={sidecars.selectedSecondaryRepair}
          secondaryActions={secondaryActions}
          onAssistantRequestChange={controller.setAssistantRequest}
          onRunPlan={() => handleRunPlan()}
          onRunPrimaryRepair={recommendation.primaryAction ? () => handleRunPlan(recommendation.primaryAction.request) : null}
          onRunWrite={handleRunWrite}
          onSelectSecondaryRepair={sidecars.setSelectedSecondaryRepair}
          onRunSecondaryRepair={() => handleRunPlan(sidecars.selectedSecondaryRepair)}
          primaryRepairLabel={recommendation.primaryAction?.label}
        />
        <ContextPanel
          hasSelection={hasSelection}
          chapterNumber={sidecars.context?.chapterNumber ?? 0}
          focus={contextFocus}
        />
        <DocumentEditorShell
          hasSelection={hasSelection}
          eyebrow="正文编辑器"
          title={controller.selectedDocument?.title ?? "未选择章节"}
          pathLabel={controller.selectedDocument?.relativePath ?? ""}
          saveLabel="保存正文"
          isPending={controller.isPending}
          emptyMessage="先创建章节，再开始正文写作与人工润色。"
          onSave={controller.saveDocument}
        >
          <textarea
            className="editor-area"
            value={controller.draftContent}
            onChange={(event) => controller.setDraftContent(event.target.value)}
            spellCheck={false}
          />
        </DocumentEditorShell>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the writing-studio refactor compiles cleanly**

Run: `npm run build`
Expected: PASS with no TypeScript or bundling errors from `components/writing-studio.tsx`, `components/writing-studio/*`, or the shared workspace imports.

- [ ] **Step 4: Perform a manual route smoke check for the three affected pages**

Run: `npm run dev`
Expected:
- `/library` loads and can create/select/save a setting document.
- `/outline` loads and can run the generic AI action panel.
- `/writing` loads with the split brief/context/assistant/editor panels and still supports chapter selection, task-brief save, and chapter AI actions.

- [ ] **Step 5: Create a local checkpoint**

Checkpoint: `WritingStudio now composes shared controller primitives plus writing-specific sidecars/panels`

### Task 5: Full Verification and Scope Review

**Files:**
- Modify: `components/document-workspace.tsx` as needed for final integration fixes
- Modify: `components/writing-studio.tsx` as needed for final integration fixes
- Modify: any newly created helper/component files only if verification reveals regressions

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS with all existing tests plus the new `tests/workspace/controller.test.mjs` and `tests/writing/workspace.test.mjs` green.

- [ ] **Step 2: Run the production build verification**

Run: `npm run build`
Expected: PASS with a successful Next.js production build.

- [ ] **Step 3: Re-check the approved spec against the implementation**

Use this checklist and do not mark the refactor complete until every line is true:

```md
- Shared document workflow lives in one reusable controller/helper path.
- `components/document-workspace.tsx` is a thin composition layer.
- `components/writing-studio.tsx` no longer owns generic CRUD + AI request duplication.
- Chapter sidecars remain outside the generic shared controller.
- Minor copy cleanup is consistent across generic workspaces.
- Existing API route contracts were preserved.
```

Expected: every checklist item is satisfied without needing additional architectural drift.

- [ ] **Step 4: Create the final local checkpoint**

Checkpoint: `frontend workspace refactor verified against tests, build, and approved spec`


