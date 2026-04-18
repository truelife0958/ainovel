# Polish Tier 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate five classes of user-visible fragility (silent auto-save failures, batch-generation rate-limit avalanche, focus trap escape, silent apply-mode downgrade, error-boundary gap) while tightening one brittle save path and three minor defects.

**Architecture:** Pure-function changes land first with unit tests, then component-level changes with RTL, then integration changes spanning API routes. Every user-visible change is driven by a failing test. No new runtime deps; RTL/linkedom are devDeps.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, node:test, `@testing-library/react`, `linkedom` (new devDeps), Playwright (for batch E2E, reused).

---

## File Structure

**New files (production):**
- `lib/api/use-abortable-fetch.ts` — React hook that auto-aborts in-flight fetches on cleanup / manual trigger
- `lib/ai/batch-scheduler.ts` — pure runBatch() that honors `Retry-After`, pauses on repeated failure, accepts external AbortSignal
- `components/error-boundary.tsx` — class-based boundary with fallback UI + copyable error ID

**New files (testing infra):**
- `tests/setup/dom.mjs` — linkedom-based DOM shim (exposes `document`, `window`, `HTMLElement`, `requestAnimationFrame`)
- `tests/setup/react.mjs` — thin wrapper around `@testing-library/react` exporting `render`, `screen`, `userEvent`
- `tests/components/_smoke.test.mjs` — proves the env works
- `tests/components/modal-focus-trap.test.mjs`
- `tests/components/modal-dirty-close.test.mjs`
- `tests/components/creative-workspace-autosave.test.mjs`
- `tests/components/error-boundary.test.mjs`
- `tests/components/connection-wizard-test-btn.test.mjs`
- `tests/ai/batch-scheduler.test.mjs`
- `tests/ai/apply-result.test.mjs`

**Modified files (production):**
- `components/creative-workspace.tsx` — unify save path, wire autosave retry + downgrade toast + abort hook
- `components/ui/modal.tsx` — focus trap + focus return + dirty-close confirm hook
- `components/batch-generate-modal.tsx` — delegate to `runBatch`
- `components/scaffold-generate-modal.tsx` — remove no-op conditional
- `components/connection-wizard.tsx` — loading state on test button
- `components/ideation-modal.tsx` — pass dirty flag to Modal
- `components/connection-modal.tsx` — pass dirty flag to Modal
- `app/page.tsx` — wrap with ErrorBoundary
- `app/globals.css` — action-toast variant + loading button variant
- `lib/ai/actions.js` — applyResult returns `{ content, downgraded }`; propagate to API
- `app/api/projects/current/actions/route.ts` — include `downgraded` + `applyModeUsed` in response
- `package.json` — devDeps + test script with DOM import

---

### Task 1: T1.0 · Set up RTL / linkedom test environment

**Files:**
- Create: `tests/setup/dom.mjs`
- Create: `tests/setup/react.mjs`
- Create: `tests/components/_smoke.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add devDeps**

```bash
npm install --save-dev @testing-library/react@^16 @testing-library/dom@^10 @testing-library/user-event@^14 linkedom@^0.18
```

Expected: `package.json` devDependencies gains four new lines; lockfile updates.

- [ ] **Step 2: Write the DOM shim**

Create `tests/setup/dom.mjs`:

```js
import { parseHTML } from "linkedom";

const { window, document, HTMLElement, Event, CustomEvent, Node, Element } =
  parseHTML("<!doctype html><html><head></head><body></body></html>");

globalThis.window = window;
globalThis.document = document;
globalThis.HTMLElement = HTMLElement;
globalThis.Element = Element;
globalThis.Node = Node;
globalThis.Event = Event;
globalThis.CustomEvent = CustomEvent;
globalThis.navigator = window.navigator;
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.matchMedia = () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
});
```

- [ ] **Step 3: Write the React helper**

Create `tests/setup/react.mjs`:

```js
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export { render, screen, fireEvent, cleanup, waitFor, userEvent };
```

- [ ] **Step 4: Write smoke test**

Create `tests/components/_smoke.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "../setup/react.mjs";
import React from "react";

test("RTL env renders a div", () => {
  render(React.createElement("div", {}, "hello"));
  assert.equal(screen.getByText("hello").tagName, "DIV");
  cleanup();
});
```

- [ ] **Step 5: Wire test script**

Modify `package.json` `scripts.test`:

```json
"test": "node --import=./tests/setup/dom.mjs --test tests/**/*.test.mjs"
```

- [ ] **Step 6: Run and verify**

```bash
npm test 2>&1 | tail -10
```

Expected: `tests 63` (62 original + 1 new smoke), all pass.

- [ ] **Step 7: Commit**

```bash
git add tests/setup/ tests/components/_smoke.test.mjs package.json package-lock.json
git commit -m "test: wire up @testing-library/react via linkedom DOM shim"
```

---

### Task 2: T1.9 · Remove scaffold-modal no-op conditional

**Files:**
- Modify: `components/scaffold-generate-modal.tsx:72-76`

- [ ] **Step 1: Write regression test**

Create `tests/components/scaffold-reset.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { render, screen, cleanup } from "../setup/react.mjs";
import React from "react";
import { ScaffoldGenerateModal } from "../../components/scaffold-generate-modal.tsx";

test("scaffold modal initial render shows all default items as waiting", () => {
  render(React.createElement(ScaffoldGenerateModal, {
    open: true, onClose: () => {}, genre: "玄幻", protagonistName: "", goldenFingerName: "",
  }));
  assert.equal(screen.getAllByText(/生成中|等待|世界观|主角|反派|总纲|大纲/).length > 0, true);
  cleanup();
});
```

Run: `npm test -- --test-name-pattern=scaffold` — expected FAIL (component import may fail on .tsx)

> Note: node:test reads `.mjs` only. If TS/.tsx import is an issue here, the test must use a compiled path or we rely on Next's build. For this refactor the functional guarantee is observational; skip the component test for this task and keep the change code-review only.

- [ ] **Step 2: Apply the fix**

Modify `components/scaffold-generate-modal.tsx` lines 72-76:

```tsx
// Before:
setItems(prev => prev.map(item => ({
  ...item,
  status: item.checked ? "waiting" as const : "waiting" as const,
  error: undefined,
})));

// After:
setItems(prev => prev.map(item => ({
  ...item,
  status: "waiting" as const,
  error: undefined,
})));
```

- [ ] **Step 3: Verify tsc + tests**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: 0 errors, all tests green.

- [ ] **Step 4: Commit**

```bash
git add components/scaffold-generate-modal.tsx
git commit -m "refactor(scaffold): remove no-op conditional in status reset"
```

---

### Task 3: T1.5 · `applyResult` returns downgrade signal

**Files:**
- Modify: `lib/ai/actions.js`
- Modify: `app/api/projects/current/actions/route.ts`
- Create: `tests/ai/apply-result.test.mjs`

- [ ] **Step 1: Write failing test**

Create `tests/ai/apply-result.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyResult } from "../../lib/ai/actions.js";

test("applyResult append under limit returns content unchanged + downgraded false", () => {
  const r = applyResult("hello", "world", "append");
  assert.equal(r.downgraded, false);
  assert.equal(r.content.endsWith("world"), true);
});

test("applyResult append over 30KB flips to replace and signals downgraded", () => {
  const big = "x".repeat(31000);
  const r = applyResult(big, "new chapter", "append");
  assert.equal(r.downgraded, true);
  assert.equal(r.content, "new chapter");
});

test("applyResult replace is never downgraded", () => {
  const r = applyResult("hello", "world", "replace");
  assert.equal(r.downgraded, false);
  assert.equal(r.content, "world");
});
```

Run: `npm test -- --test-name-pattern=applyResult` — expected FAIL (function not exported / returns string).

- [ ] **Step 2: Export and refactor `applyResult`**

Modify `lib/ai/actions.js`:

```js
// Before:
function applyResult(originalContent, generatedText, applyMode) {
  const original = String(originalContent ?? "");
  if (applyMode === "append" && original.length > MAX_CHAPTER_CONTENT_FOR_APPEND) {
    return String(generatedText ?? "").trim();
  }
  return applyMode === "append"
    ? `${original.replace(/\s*$/, "")}\n\n${String(generatedText ?? "").trim()}\n`
    : String(generatedText ?? "").trim();
}

// After:
export function applyResult(originalContent, generatedText, applyMode) {
  const original = String(originalContent ?? "");
  const generated = String(generatedText ?? "").trim();
  if (applyMode === "append" && original.length > MAX_CHAPTER_CONTENT_FOR_APPEND) {
    return { content: generated, downgraded: true };
  }
  const content = applyMode === "append"
    ? `${original.replace(/\s*$/, "")}\n\n${generated}\n`
    : generated;
  return { content, downgraded: false };
}
```

- [ ] **Step 3: Update consumer**

In `runDocumentAiAction`, replace:

```js
const nextContent = applyResult(..., generatedText, input.applyMode);
```

with:

```js
const applied = applyResult(
  target === "brief" ? brief?.content || "" : document.content,
  generatedText,
  input.applyMode,
);
const nextContent = applied.content;
const downgraded = applied.downgraded;
```

Add `downgraded` and `applyModeUsed` to the return:

```js
return {
  target,
  provider,
  model: invocation.model,
  role,
  generatedText,
  document: savedDocument,
  documents,
  briefValidation,
  downgraded,
  applyModeUsed: downgraded ? "replace" : input.applyMode,
};
```

- [ ] **Step 4: Surface in API response**

`app/api/projects/current/actions/route.ts` already spreads `result` into `truncatedResult` — no change needed; `downgraded` flows through.

- [ ] **Step 5: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all pass (new 3 + existing 62).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/actions.js tests/ai/apply-result.test.mjs
git commit -m "fix(ai): surface applyResult downgrade when chapter exceeds 30KB"
```

---

### Task 4: T1.5 (UI) · Show downgrade toast

**Files:**
- Modify: `components/creative-workspace.tsx`

- [ ] **Step 1: Add state + effect**

In `CreativeWorkspace`, near other useState:

```tsx
const [downgradeNotice, setDowngradeNotice] = useState("");

useEffect(() => {
  if (!downgradeNotice) return;
  const t = setTimeout(() => setDowngradeNotice(""), 5000);
  return () => clearTimeout(t);
}, [downgradeNotice]);
```

- [ ] **Step 2: Set on runAi success**

In `runAi` after `payload.ok` check, before `setToast("AI 操作已完成")`:

```tsx
if (payload.data.downgraded) {
  setDowngradeNotice("原稿超 30KB，本次使用替换模式。");
}
```

- [ ] **Step 3: Render banner**

Add JSX before `{aiRunning && ...}`:

```tsx
{downgradeNotice && (
  <div className="downgrade-notice" role="status">{downgradeNotice}</div>
)}
```

- [ ] **Step 4: Add CSS**

Append to `app/globals.css`:

```css
.downgrade-notice {
  margin: 8px 16px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--warning-bg);
  color: var(--warning-text);
  border: 1px solid var(--warning);
  font-size: 13px;
}
```

- [ ] **Step 5: tsc + test**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add components/creative-workspace.tsx app/globals.css
git commit -m "feat(ui): show toast when AI downgrades append to replace"
```

---

### Task 5: T1.2 · Unify saveDocument path

**Files:**
- Modify: `components/creative-workspace.tsx`

- [ ] **Step 1: Remove saveDocumentImpl and saveRef pattern**

Find and replace the existing save block (lines ~118-180):

```tsx
// Remove saveDocumentImpl, saveRef, and the standalone function saveDocument.
// Replace with:
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

const saveRef = useRef(saveDocument);
useEffect(() => { saveRef.current = saveDocument; }, [saveDocument]);
```

- [ ] **Step 2: Update Ctrl+S handler**

```tsx
useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
      event.preventDefault();
      if (hasSelectedDocument && !isPendingRef.current) {
        startTransition(() => { saveRef.current(); });
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "b" && selectedType === "chapter") {
      event.preventDefault();
      setBriefPanelOpen(prev => !prev);
    }
    if (event.key === "Escape" && briefPanelOpen) setBriefPanelOpen(false);
  }
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [hasSelectedDocument, selectedType, briefPanelOpen]);
```

- [ ] **Step 3: Update auto-save effect to use silent**

```tsx
autoSaveTimerRef.current = setTimeout(() => {
  startTransition(async () => {
    const doc = await saveRef.current({ silent: true });
    if (doc) {
      setAutoSaved(true);
      if (autoSavedTimerRef.current) clearTimeout(autoSavedTimerRef.current);
      autoSavedTimerRef.current = setTimeout(() => setAutoSaved(false), 2000);
    }
  });
}, AUTOSAVE_DELAY);
```

- [ ] **Step 4: Remove old `saveDocument` function declaration**

Delete the old `function saveDocument() { ... }` block around line 264.

- [ ] **Step 5: tsc + existing tests**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: green. Manually verify: open app, Ctrl+S still saves; auto-save still fires after 30s.

- [ ] **Step 6: Commit**

```bash
git add components/creative-workspace.tsx
git commit -m "refactor(workspace): unify saveDocument into single useCallback path"
```

---

### Task 6: T1.1 · Auto-save retry with exponential backoff

**Files:**
- Modify: `components/creative-workspace.tsx`
- Modify: `app/globals.css`
- Create: `tests/components/creative-workspace-autosave.test.mjs`

- [ ] **Step 1: Write failing test**

Create `tests/components/creative-workspace-autosave.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import React, { useState } from "react";
import { render, screen, cleanup, waitFor } from "../setup/react.mjs";

// Mock fetch factory
function makeFetch(sequence) {
  let i = 0;
  return async () => {
    const item = sequence[Math.min(i++, sequence.length - 1)];
    if (item === "fail") throw new Error("net");
    return { ok: true, json: async () => ({ ok: true, data: { document: item, documents: [item] } }) };
  };
}

// Minimal harness: we test auto-save retry state machine via a lightweight hook.
// Full CreativeWorkspace rendering requires Next/server helpers; instead
// we test the backoff helper extracted in Step 2.

import { computeNextBackoffMs } from "../../components/creative-workspace-autosave.js";

test("backoff schedule is 30s → 60s → 120s → 300s (cap)", () => {
  assert.equal(computeNextBackoffMs(0), 30000);
  assert.equal(computeNextBackoffMs(1), 60000);
  assert.equal(computeNextBackoffMs(2), 120000);
  assert.equal(computeNextBackoffMs(3), 300000);
  assert.equal(computeNextBackoffMs(4), 300000);
});
```

Run: `npm test -- --test-name-pattern=backoff` — FAIL (file not found).

- [ ] **Step 2: Extract backoff helper**

Create `components/creative-workspace-autosave.js`:

```js
export function computeNextBackoffMs(failures) {
  const table = [30000, 60000, 120000, 300000];
  const idx = Math.min(failures, table.length - 1);
  return table[idx];
}
```

- [ ] **Step 3: Wire into workspace**

In `CreativeWorkspace`:

```tsx
import { computeNextBackoffMs } from "@/components/creative-workspace-autosave.js";

const [autoSaveFailures, setAutoSaveFailures] = useState(0);
const [autoSaveError, setAutoSaveError] = useState<string | null>(null);

// Replace auto-save effect:
useEffect(() => {
  if (!chapterDirty || !hasSelectedDocument || isPending || aiRunning) return;
  const delay = autoSaveFailures > 0 ? computeNextBackoffMs(autoSaveFailures - 1) : AUTOSAVE_DELAY;
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
```

- [ ] **Step 4: Render error toast with retry**

Near `{message && !aiRunning && ...}`:

```tsx
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
```

- [ ] **Step 5: Add CSS**

Append to `app/globals.css`:

```css
.autosave-error-toast {
  position: fixed;
  bottom: 92px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  background: var(--error-bg);
  color: var(--error-text);
  border: 1px solid var(--error-border);
  box-shadow: var(--shadow);
  z-index: 50;
}

.autosave-retry-btn {
  background: transparent;
  border: 1px solid var(--error-text);
  color: var(--error-text);
  padding: 4px 10px;
  border-radius: 10px;
  cursor: pointer;
}

.autosave-retry-btn:hover { background: rgba(248, 113, 113, 0.1); }
```

- [ ] **Step 6: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: +5 new backoff tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/creative-workspace.tsx components/creative-workspace-autosave.js tests/components/creative-workspace-autosave.test.mjs app/globals.css
git commit -m "feat(autosave): exponential backoff + visible retry toast on failure"
```

---

### Task 7: T1.3 · AbortController hook + wire into workspace

**Files:**
- Create: `lib/api/use-abortable-fetch.ts`
- Modify: `components/creative-workspace.tsx`

- [ ] **Step 1: Create the hook**

Create `lib/api/use-abortable-fetch.ts`:

```ts
import { useEffect, useRef } from "react";

export function useAbortableFetch() {
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { ctrlRef.current?.abort(); };
  }, []);

  function run(url: RequestInfo, init: RequestInit = {}) {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    return fetch(url, { ...init, signal: ctrl.signal });
  }

  function abort() {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
  }

  return { run, abort };
}
```

- [ ] **Step 2: Wire into selectDocument only (scoped change)**

In `CreativeWorkspace`:

```tsx
import { useAbortableFetch } from "@/lib/api/use-abortable-fetch";

const selectFetcher = useAbortableFetch();

function selectDocument(type: ProjectDocumentKind, fileName: string) {
  // ... existing logic but replace Promise.all fetches with selectFetcher.run
  const [docRes, briefRes, ctxRes] = await Promise.all([
    selectFetcher.run(`/api/projects/current/documents?kind=chapter&file=${encodeURIComponent(fileName)}`),
    selectFetcher.run(`/api/projects/current/briefs?file=${encodeURIComponent(fileName)}`),
    selectFetcher.run(`/api/projects/current/context?file=${encodeURIComponent(fileName)}`),
  ]);
  // ...
}
```

Wrap the try/catch to swallow `AbortError`:

```tsx
} catch (err) {
  if ((err as Error).name === "AbortError") return;
  setMessage("网络错误，切换章节失败");
}
```

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add lib/api/use-abortable-fetch.ts components/creative-workspace.tsx
git commit -m "feat(api): useAbortableFetch hook; cancel in-flight chapter load on switch"
```

---

### Task 8: T1.6 · Modal focus trap + focus return

**Files:**
- Modify: `components/ui/modal.tsx`
- Create: `tests/components/modal-focus-trap.test.mjs`

- [ ] **Step 1: Write failing test**

Create `tests/components/modal-focus-trap.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, screen, cleanup, fireEvent } from "../setup/react.mjs";
import { Modal } from "../../components/ui/modal.tsx";

test("Modal focuses first tabbable element on open and returns focus on close", async () => {
  const trigger = document.createElement("button");
  trigger.textContent = "open";
  document.body.appendChild(trigger);
  trigger.focus();
  assert.equal(document.activeElement, trigger);

  const { rerender } = render(
    React.createElement(Modal, { open: true, onClose: () => {}, title: "Test" },
      React.createElement("button", { type: "button" }, "Save"),
      React.createElement("button", { type: "button" }, "Cancel"),
    )
  );

  // First focusable inside the modal should be focused (close button or first content button)
  const focused = document.activeElement;
  assert.notEqual(focused, trigger, "focus should have moved into modal");

  rerender(
    React.createElement(Modal, { open: false, onClose: () => {}, title: "Test" },
      React.createElement("button", { type: "button" }, "Save"),
    )
  );

  assert.equal(document.activeElement, trigger, "focus should return to trigger");
  document.body.removeChild(trigger);
  cleanup();
});
```

Run: FAIL (no focus trap yet).

- [ ] **Step 2: Implement focus trap in modal**

Replace the existing `useEffect` in `components/ui/modal.tsx`:

```tsx
useEffect(() => {
  if (!open) return;
  const count = parseInt(document.body.dataset.overlayCount || "0", 10);
  document.body.dataset.overlayCount = String(count + 1);
  document.body.style.overflow = "hidden";

  const previousFocus = document.activeElement as HTMLElement | null;

  function focusables(): HTMLElement[] {
    const dialog = dialogRef.current;
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
  }

  // Focus first interactive element (not the dialog itself)
  queueMicrotask(() => {
    const items = focusables();
    items[0]?.focus();
  });

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Escape") { onClose(); return; }
    if (event.key !== "Tab") return;
    const items = focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) { last.focus(); event.preventDefault(); }
    else if (!event.shiftKey && active === last) { first.focus(); event.preventDefault(); }
  }

  document.addEventListener("keydown", handleKey);

  return () => {
    const next = parseInt(document.body.dataset.overlayCount || "1", 10) - 1;
    document.body.dataset.overlayCount = String(next);
    if (next <= 0) {
      document.body.style.overflow = "";
      delete document.body.dataset.overlayCount;
    }
    document.removeEventListener("keydown", handleKey);
    previousFocus?.focus?.();
  };
}, [open, onClose]);
```

- [ ] **Step 3: Run test**

```bash
npm test -- --test-name-pattern=focus 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/ui/modal.tsx tests/components/modal-focus-trap.test.mjs
git commit -m "fix(a11y): trap focus inside modal + return focus to trigger on close"
```

---

### Task 9: T1.7 · Dirty-close confirmation for form modals

**Files:**
- Modify: `components/ui/modal.tsx`
- Modify: `components/ideation-modal.tsx`
- Modify: `components/connection-modal.tsx`
- Create: `tests/components/modal-dirty-close.test.mjs`

- [ ] **Step 1: Extend Modal API**

Modify `components/ui/modal.tsx`:

```tsx
type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  variant?: ModalVariant;
  confirmCloseIfDirty?: () => boolean;  // returns true → dirty → confirm
  children: ReactNode;
};

export function Modal({
  open, onClose, title, eyebrow, variant = "standard",
  confirmCloseIfDirty, children,
}: ModalProps) {
  // ...
  function requestClose() {
    if (confirmCloseIfDirty?.() && !confirm("有未保存的更改，确定放弃吗？")) return;
    onClose();
  }

  // Replace all onClose direct calls (overlay click, ESC in handleKey, close button) with requestClose.
}
```

Update overlay onClick and ESC handler to call `requestClose()`; close button stays `onClose` (explicit X is intent to discard? We'll make it also confirm for consistency — use `requestClose`).

- [ ] **Step 2: Wire from IdeationModal**

In `components/ideation-modal.tsx`, track dirty state (compare initial vs current values). If the modal already has an internal form, add:

```tsx
const [dirty, setDirty] = useState(false);
// pass to Modal
<Modal open={open} onClose={onClose} confirmCloseIfDirty={() => dirty} ... />
```

- [ ] **Step 3: Same for ConnectionModal**

Analogous change in `components/connection-modal.tsx`.

- [ ] **Step 4: Write test**

Create `tests/components/modal-dirty-close.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, screen, cleanup, fireEvent } from "../setup/react.mjs";
import { Modal } from "../../components/ui/modal.tsx";

test("Modal with dirty=true requires confirm on ESC", () => {
  let closed = false;
  const originalConfirm = globalThis.confirm;
  let confirmCalled = false;
  globalThis.confirm = () => { confirmCalled = true; return false; };

  render(
    React.createElement(Modal, {
      open: true,
      onClose: () => { closed = true; },
      title: "T",
      confirmCloseIfDirty: () => true,
    }, React.createElement("input"))
  );

  fireEvent.keyDown(document, { key: "Escape" });
  assert.equal(confirmCalled, true);
  assert.equal(closed, false);

  globalThis.confirm = originalConfirm;
  cleanup();
});
```

- [ ] **Step 5: Run**

```bash
npm test 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add components/ui/modal.tsx components/ideation-modal.tsx components/connection-modal.tsx tests/components/modal-dirty-close.test.mjs
git commit -m "feat(modal): confirm before discarding dirty form data"
```

---

### Task 10: T1.8 · Error boundary

**Files:**
- Create: `components/error-boundary.tsx`
- Modify: `app/page.tsx`
- Create: `tests/components/error-boundary.test.mjs`

- [ ] **Step 1: Write failing test**

Create `tests/components/error-boundary.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, screen, cleanup } from "../setup/react.mjs";
import { ErrorBoundary } from "../../components/error-boundary.tsx";

function Boom() { throw new Error("kaboom"); }

test("ErrorBoundary renders fallback and shows error id", () => {
  // Suppress React error log for this test
  const originalError = console.error;
  console.error = () => {};
  try {
    render(React.createElement(ErrorBoundary, {}, React.createElement(Boom)));
    assert.ok(screen.getByText(/复制错误 ID/));
    assert.ok(screen.getByText(/出错了/));
  } finally {
    console.error = originalError;
    cleanup();
  }
});
```

- [ ] **Step 2: Implement ErrorBoundary**

Create `components/error-boundary.tsx`:

```tsx
"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: (info: { errorId: string; retry: () => void; }) => ReactNode };
type State = { errorId: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { errorId: null };

  static getDerivedStateFromError(): State {
    return { errorId: null }; // id set in componentDidCatch
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const errorId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : String(Date.now());
    this.setState({ errorId });
    // Minimal logging (Tier 3 replaces with structured log)
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary]", errorId, error, info.componentStack);
    }
  }

  retry = () => this.setState({ errorId: null });

  render() {
    if (this.state.errorId) {
      if (this.props.fallback) return this.props.fallback({ errorId: this.state.errorId, retry: this.retry });
      return (
        <div className="error-boundary-fallback" role="alert">
          <h3>出错了</h3>
          <p>页面渲染遇到异常。你可以点击下方按钮重试，或复制错误 ID 反馈问题。</p>
          <div className="error-boundary-actions">
            <button type="button" onClick={this.retry}>重试</button>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(this.state.errorId || "")}
            >复制错误 ID</button>
          </div>
          <code>{this.state.errorId}</code>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 3: Add fallback CSS**

Append to `app/globals.css`:

```css
.error-boundary-fallback {
  margin: 40px auto;
  max-width: 520px;
  padding: 24px;
  border-radius: var(--radius-md);
  background: var(--panel);
  border: 1px solid var(--error-border);
  text-align: center;
}
.error-boundary-fallback code {
  display: block;
  margin-top: 12px;
  padding: 8px;
  background: var(--bg);
  border-radius: 8px;
  font-size: 12px;
  color: var(--muted);
  user-select: all;
}
.error-boundary-actions { display: flex; gap: 12px; justify-content: center; margin-top: 12px; }
.error-boundary-actions button {
  padding: 8px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel-strong);
  cursor: pointer;
}
.error-boundary-actions button:hover { background: var(--accent-soft); }
```

- [ ] **Step 4: Wrap root**

Modify `app/page.tsx` around the return:

```tsx
import { ErrorBoundary } from "@/components/error-boundary";

// Wrap the AppShell return:
return (
  <ErrorBoundary>
    <AppShell project={project} aiAvailable={assistantStatus.available}>
      <CreativeWorkspace ... />
    </AppShell>
  </ErrorBoundary>
);
```

Also wrap the `WelcomeShell` return path.

- [ ] **Step 5: Run tests**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -10
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add components/error-boundary.tsx app/page.tsx app/globals.css tests/components/error-boundary.test.mjs
git commit -m "feat(reliability): add root ErrorBoundary with copyable error id"
```

---

### Task 11: T1.10 · Connection wizard test-button loading state

**Files:**
- Modify: `components/connection-wizard.tsx`
- Modify: `app/globals.css`
- Create: `tests/components/connection-wizard-test-btn.test.mjs`

- [ ] **Step 1: Read existing wizard to find test button**

```bash
grep -n "test" components/connection-wizard.tsx | head -20
```

Locate the function invoked by the "测试连接" button. Likely a `testProvider` or similar. If not present, skip to Step 2 where we add one.

- [ ] **Step 2: Add loading state**

Add near other useState:

```tsx
const [testing, setTesting] = useState(false);
const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
```

Modify the test handler:

```tsx
async function handleTest() {
  setTesting(true);
  setTestResult(null);
  try {
    const res = await fetch(`/api/settings/providers/test?provider=${activeProvider}`);
    const payload = await res.json();
    setTestResult({ ok: res.ok && payload.ok, message: payload.ok ? "连接成功" : (payload.error || "连接失败") });
  } catch {
    setTestResult({ ok: false, message: "网络错误" });
  } finally {
    setTesting(false);
  }
}
```

- [ ] **Step 3: Render loading + result**

```tsx
<button type="button" className="action-button" onClick={handleTest} disabled={testing}>
  {testing ? (<><span className="btn-spinner" />测试中...</>) : "测试连接"}
</button>
{testResult && (
  <p className={`test-result ${testResult.ok ? "success" : "error"}`} role="status">
    {testResult.message}
  </p>
)}
```

- [ ] **Step 4: Add CSS**

Append to `app/globals.css`:

```css
.btn-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 8px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

.test-result { margin-top: 8px; padding: 8px 12px; border-radius: 10px; font-size: 13px; }
.test-result.success { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-border); }
.test-result.error { background: var(--error-bg); color: var(--error-text); border: 1px solid var(--error-border); }
```

- [ ] **Step 5: Write test**

Create `tests/components/connection-wizard-test-btn.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "../setup/react.mjs";
import { ConnectionWizard } from "../../components/connection-wizard.tsx";

test("test button enters loading state and shows success on OK", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });

  render(React.createElement(ConnectionWizard, {}));
  const btn = screen.getByRole("button", { name: /测试连接/ });
  fireEvent.click(btn);

  await waitFor(() => {
    assert.ok(screen.getByText(/连接成功|测试中/));
  });

  globalThis.fetch = originalFetch;
  cleanup();
});
```

> Note: `ConnectionWizard` may have required props; if so, mock them in the test. If the wizard is complex, convert this to a Playwright E2E in Tier 3 and skip component test here.

- [ ] **Step 6: Run + commit**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -10
git add components/connection-wizard.tsx app/globals.css tests/components/connection-wizard-test-btn.test.mjs
git commit -m "feat(ui): show loading + color-coded result on connection test button"
```

---

### Task 12: T1.4 · Batch scheduler with rate-limit awareness

**Files:**
- Create: `lib/ai/batch-scheduler.ts`
- Modify: `components/batch-generate-modal.tsx`
- Create: `tests/ai/batch-scheduler.test.mjs`

- [ ] **Step 1: Write failing test**

Create `tests/ai/batch-scheduler.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { runBatch } from "../../lib/ai/batch-scheduler.js";

function make429(retryAfter = 1) {
  const err = new Error("429");
  err.status = 429;
  err.retryAfterSeconds = retryAfter;
  return err;
}

test("runBatch completes all tasks when all succeed", async () => {
  const results = [];
  await runBatch([
    () => Promise.resolve(results.push("a")),
    () => Promise.resolve(results.push("b")),
    () => Promise.resolve(results.push("c")),
  ], { onProgress: () => {}, onWait: () => {}, sleep: () => Promise.resolve() });
  assert.deepEqual(results, [1, 2, 3]);
});

test("runBatch waits on 429 and retries same task", async () => {
  const waitCalls = [];
  let triedFirst = 0;
  await runBatch([
    async () => { triedFirst++; if (triedFirst === 1) throw make429(2); return "ok"; },
    async () => "ok2",
  ], {
    onProgress: () => {},
    onWait: (sec) => waitCalls.push(sec),
    sleep: () => Promise.resolve(),
  });
  assert.equal(triedFirst, 2);
  assert.deepEqual(waitCalls, [2]);
});

test("runBatch aborts when signal is triggered", async () => {
  const ctrl = new AbortController();
  const run = runBatch([
    async () => { ctrl.abort(); return "ok"; },
    async () => { throw new Error("should not run"); },
  ], { onProgress: () => {}, onWait: () => {}, sleep: () => Promise.resolve(), signal: ctrl.signal });
  await run; // should not throw — just stop early
});

test("runBatch pauses after 3 consecutive non-429 errors", async () => {
  let i = 0;
  const paused = [];
  await runBatch([
    async () => { i++; throw new Error("boom"); },
    async () => { i++; throw new Error("boom"); },
    async () => { i++; throw new Error("boom"); },
    async () => { throw new Error("should not run"); },
  ], {
    onProgress: () => {},
    onWait: () => {},
    sleep: () => Promise.resolve(),
    onPause: (reason) => paused.push(reason),
  });
  assert.equal(i, 3);
  assert.equal(paused.length, 1);
});
```

Run: FAIL (module not found).

- [ ] **Step 2: Implement runBatch**

Create `lib/ai/batch-scheduler.ts`:

```ts
export type BatchTaskResult = { ok: boolean; error?: Error; value?: unknown };

export type BatchTask = () => Promise<unknown>;

export type BatchOpts = {
  onProgress: (index: number, result: BatchTaskResult) => void;
  onWait: (seconds: number) => void;
  onPause?: (reason: string) => void;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
  maxConsecutiveErrors?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runBatch(tasks: BatchTask[], opts: BatchOpts): Promise<void> {
  const sleep = opts.sleep ?? defaultSleep;
  const maxConsecutive = opts.maxConsecutiveErrors ?? 3;
  let consecutiveErrors = 0;

  for (let i = 0; i < tasks.length; i++) {
    if (opts.signal?.aborted) return;

    // Retry the same task on 429
    while (true) {
      if (opts.signal?.aborted) return;
      try {
        const value = await tasks[i]();
        opts.onProgress(i, { ok: true, value });
        consecutiveErrors = 0;
        break;
      } catch (err) {
        const e = err as Error & { status?: number; retryAfterSeconds?: number };
        if (e.status === 429) {
          const sec = Math.max(1, e.retryAfterSeconds ?? 30);
          opts.onWait(sec);
          await sleep(sec * 1000);
          continue; // retry same task
        }
        opts.onProgress(i, { ok: false, error: e });
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutive) {
          opts.onPause?.(`连续 ${maxConsecutive} 次失败，已暂停`);
          return;
        }
        break; // move to next task
      }
    }
  }
}
```

Since this is TS and our test is `.mjs`, we need JS output. The repo uses `.js`-suffix tests against `.js` sources in `lib/`. Mirror the pattern: write the source as `.ts` and import compiled via tsconfig's `allowImportingTsExtensions`? Check project convention first:

```bash
grep -r "lib/ai/" tests/ai/ | head -3
```

If existing tests import from `lib/ai/*.js` (not `.ts`), **write this as `lib/ai/batch-scheduler.js`** (plain JS with JSDoc types).

Actual file to create — `lib/ai/batch-scheduler.js`:

```js
/**
 * @typedef {{ ok: boolean, error?: Error, value?: unknown }} BatchTaskResult
 * @typedef {() => Promise<unknown>} BatchTask
 * @typedef {{
 *   onProgress: (index: number, result: BatchTaskResult) => void,
 *   onWait: (seconds: number) => void,
 *   onPause?: (reason: string) => void,
 *   signal?: AbortSignal,
 *   sleep?: (ms: number) => Promise<void>,
 *   maxConsecutiveErrors?: number,
 * }} BatchOpts
 */

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {BatchTask[]} tasks
 * @param {BatchOpts} opts
 */
export async function runBatch(tasks, opts) {
  const sleep = opts.sleep ?? defaultSleep;
  const maxConsecutive = opts.maxConsecutiveErrors ?? 3;
  let consecutiveErrors = 0;

  for (let i = 0; i < tasks.length; i++) {
    if (opts.signal?.aborted) return;

    while (true) {
      if (opts.signal?.aborted) return;
      try {
        const value = await tasks[i]();
        opts.onProgress(i, { ok: true, value });
        consecutiveErrors = 0;
        break;
      } catch (err) {
        if (err?.status === 429) {
          const sec = Math.max(1, err.retryAfterSeconds ?? 30);
          opts.onWait(sec);
          await sleep(sec * 1000);
          continue;
        }
        opts.onProgress(i, { ok: false, error: err });
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutive) {
          opts.onPause?.(`连续 ${maxConsecutive} 次失败，已暂停`);
          return;
        }
        break;
      }
    }
  }
}
```

Add a matching `lib/ai/batch-scheduler.d.ts` for type exports if needed. Leave for now; the modal imports via `@/lib/ai/batch-scheduler`.

- [ ] **Step 3: Update test imports**

Change the test imports to `lib/ai/batch-scheduler.js`. Also fix `results.push` assertion — push returns new length. Rewrite to:

```js
const results = [];
await runBatch([
  () => { results.push("a"); return Promise.resolve(); },
  () => { results.push("b"); return Promise.resolve(); },
  () => { results.push("c"); return Promise.resolve(); },
], ...);
assert.deepEqual(results, ["a", "b", "c"]);
```

- [ ] **Step 4: Wire into batch-generate-modal**

Refactor `components/batch-generate-modal.tsx` `startGeneration` to delegate to `runBatch`:

```tsx
import { runBatch } from "@/lib/ai/batch-scheduler";

// Parse Retry-After from a 429 response into an Error with status/retryAfterSeconds:
async function safeFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "30", 10);
    const err: Error & { status?: number; retryAfterSeconds?: number } = new Error("rate limited");
    err.status = 429;
    err.retryAfterSeconds = isNaN(retryAfter) ? 30 : retryAfter;
    throw err;
  }
  return res;
}

// In startGeneration:
const ctrl = new AbortController();
stopRef.current = ctrl;
const [waitSec, setWaitSec] = ... // add state above

const tasks = Array.from({ length: total }, (_, i) => async () => {
  const chapterNum = startChapter + i;
  updateChapter(i, { status: "running", step: "create" });
  const needsCreate = chapterNum > existingChapterCount;
  if (needsCreate) await apiCreateChapter(chapterNum);
  updateChapter(i, { step: "plan" });
  await apiRunAiSafe(chapterNum, "chapter_plan");
  updateChapter(i, { step: "write" });
  const result = await apiRunAiSafe(chapterNum, "chapter_write");
  const wc = result.document?.content?.length ?? 0;
  updateChapter(i, { status: "done", wordCount: wc });
  setTotalWords(prev => prev + wc);
});

await runBatch(tasks, {
  signal: ctrl.signal,
  onProgress: () => {},
  onWait: (sec) => setWaitSec(sec),
  onPause: (reason) => setStatus("error"),
});
setWaitSec(0);
```

Where `apiRunAiSafe` is `apiRunAi` using `safeFetch`.

- [ ] **Step 5: UI for wait state**

Add near the progress bar:

```tsx
{waitSec > 0 && (
  <p className="muted" style={{ textAlign: "center" }}>
    已触发限流，等待 {waitSec}s 后继续...
  </p>
)}
```

- [ ] **Step 6: Run tests**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -10
```

Expected: all pass including 4 new batch-scheduler tests.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/batch-scheduler.js components/batch-generate-modal.tsx tests/ai/batch-scheduler.test.mjs
git commit -m "feat(batch): rate-limit-aware scheduler with 429 backoff and auto-pause"
```

---

### Task 13: Tier 1 final verification

**Files:**
- No code changes; verification + tag

- [ ] **Step 1: Full test run**

```bash
npm test 2>&1 | tail -15
```

Expected: all tests pass; count ≥ 77 (62 baseline + 15 new).

- [ ] **Step 2: TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -15
```

Expected: "✓ Compiled successfully" and all pages pre-rendered.

- [ ] **Step 4: Manual smoke (dev server)**

```bash
npm run dev &
sleep 5
```

- Open http://localhost:3000
- Verify: Tab through modal cycles only within modal
- Verify: Close modal returns focus to trigger
- Verify: ESC on dirty ideation modal confirms before closing
- Verify: Edit chapter, toggle network offline (DevTools), wait 30s, confirm "自动保存失败" toast with Retry button

Kill dev server:

```bash
pkill -f "next dev" 2>/dev/null || true
```

- [ ] **Step 5: Tag**

```bash
git tag polish-tier-1 -m "Tier 1 polish: correctness & resilience"
```

- [ ] **Step 6: Final commit / push decision**

Do NOT push yet. Report completion to user for review before push.

---

## Self-Review

**Spec coverage:**
- T1.0 ✓ Task 1
- T1.1 ✓ Task 6
- T1.2 ✓ Task 5
- T1.3 ✓ Task 7 (scoped to `selectDocument` only; additional wiring to other fetches can be added as needed — scope intentional to stay bite-sized)
- T1.4 ✓ Task 12
- T1.5 ✓ Tasks 3 + 4 (lib + UI)
- T1.6 ✓ Task 8
- T1.7 ✓ Task 9
- T1.8 ✓ Task 10
- T1.9 ✓ Task 2
- T1.10 ✓ Task 11

**Placeholder scan:** Task 11 Step 6 is terse. Task 3 has a note about `applyResult` export path — the step shows the correct implementation. Task 12 Step 2 has a pattern-discovery step; if `.ts` sources are fine in `lib/ai/`, use `.ts`; otherwise use `.js` with JSDoc (default to `.js` as existing lib/ai/* is `.js`).

**Type consistency:** `saveRef.current({ silent: true })` — `saveDocument` returns `Promise<ProjectDocument | undefined>`. Consumers in Task 5/6 use the return; type flows match. `applyResult` return `{ content, downgraded }` consistent across Tasks 3/4. `runBatch` `BatchTask` `= () => Promise<unknown>` — consumers in Task 12 conform.

**Scope check:** 13 tasks over ~25-30 minutes of work per task ≈ 5-7 hours of focused execution. Matches Tier 1 estimate in the design.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-polish-tier-1-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
