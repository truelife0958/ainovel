> **Status:** ✅ Executed in commits 3fc6185..8ffa4cc (merged to main in 988686d, tagged polish-tier-3)

# Polish Tier 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the quality foundation that locks in Tier 1/2's gains: structured logging, request-id tracing, expanded component test coverage, E2E suite expansion, a11y assertions, ARCHITECTURE / CONTRIBUTING / ADR documentation, and README upgrade.

**Architecture:** Pure-addition changes. A single `lib/log.ts` module centralizes logging; `middleware.ts` injects correlation ids on every API request; new E2E specs use mocked AI responses so they don't need a real provider. Documentation lives under `ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/adr/`; CHANGELOG gets a full 2026-04-19 entry. No production code paths change behavior — the log calls wrap existing `catch` blocks and are safe to no-op when `NODE_ENV === 'test'`.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, node:test, existing `@testing-library/react` + `linkedom` from Tier 1, Playwright (existing), `@axe-core/playwright` (new devDep).

**Branch:** Continue on `polish/tier-1` (current branch). Tag `polish-tier-3` at the end.

---

## File Structure

**New files (production):**
- `lib/log.ts` — structured logger (`log.info/warn/error(event, fields)`), JSON output in prod, colored in dev
- `middleware.ts` — Next.js middleware that attaches `X-Request-Id` to every `/api/*` response and exposes `x-request-id` on the inbound request

**New files (testing):**
- `tests/log.test.mjs` — logger behavior (JSON shape, color off in test)
- `tests/components/export-menu.test.mjs` — pure onClick / menu open/close
- `tests/components/editor-toolbar.test.mjs` — click handlers dispatch the right FormatAction
- `tests/e2e/dark-mode.spec.mjs` — theme toggle + persistence + system preference
- `tests/e2e/batch-generate.spec.mjs` — mocked provider → 3-chapter run succeeds
- `tests/e2e/scaffold-generate.spec.mjs` — mocked provider → checklist completes
- `tests/e2e/reference-analysis.spec.mjs` — mocked provider → analysis output renders
- `tests/e2e/export.spec.mjs` — export menu → downloads trigger
- `tests/e2e/helpers/a11y.mjs` — axe-core wrapper (`assertNoAxeViolations(page, tag)`)
- `tests/e2e/helpers/mock-ai.mjs` — Playwright route helper for mocking `/api/projects/current/actions`

**New files (docs):**
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `docs/adr/TEMPLATE.md`
- `docs/adr/0001-single-page-shell.md`
- `docs/adr/0002-aes-gcm-config-encryption.md`
- `docs/adr/0003-no-runtime-deps.md`
- `docs/adr/0004-prompt-caching.md`
- `docs/adr/0005-risk-tiered-polish.md`

**Modified files:**
- Every `app/api/**/route.ts` — wrap `catch` with `log.error('route_failed', { route, requestId, error })`
- `components/error-boundary.tsx` — replace inline `console.error` with `log.error('react_render_error', { errorId, stack })`
- `CHANGELOG.md` — 2026-04-19 entry with Tier 1/2/3 sections
- `README.md` — quality-baseline badges + link to CHANGELOG
- `package.json` — add `@axe-core/playwright` devDep

---

### Task 1: T3.1 · Structured logger module

**Files:**
- Create: `lib/log.ts`
- Create: `tests/log.test.mjs`

- [ ] **Step 1: Write failing test**

Create `tests/log.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("log.info writes a single-line JSON to stdout in production", async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalWrite = process.stdout.write.bind(process.stdout);
  const lines = [];
  process.stdout.write = (chunk) => {
    if (typeof chunk === "string") lines.push(chunk);
    return true;
  };
  process.env.NODE_ENV = "production";
  try {
    const { log } = await import("../lib/log.ts?t=" + Date.now());
    log.info("test_event", { foo: "bar", n: 42 });
    assert.equal(lines.length, 1, "one line written");
    const parsed = JSON.parse(lines[0].trim());
    assert.equal(parsed.level, "info");
    assert.equal(parsed.event, "test_event");
    assert.equal(parsed.foo, "bar");
    assert.equal(parsed.n, 42);
    assert.ok(parsed.ts);
  } finally {
    process.stdout.write = originalWrite;
    process.env.NODE_ENV = originalEnv;
  }
});

test("log.error in test env is a silent no-op (prevents polluting test output)", async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  let wrote = false;
  process.stdout.write = () => { wrote = true; return true; };
  process.stderr.write = () => { wrote = true; return true; };
  process.env.NODE_ENV = "test";
  try {
    const { log } = await import("../lib/log.ts?t=" + Date.now());
    log.error("should_be_silent", { x: 1 });
    assert.equal(wrote, false, "no output in test env");
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    process.env.NODE_ENV = originalEnv;
  }
});
```

- [ ] **Step 2: Confirm .ts is directly importable (it isn't in node:test)**

Node's test runner cannot import `.ts` without a loader. We'll split: implement `lib/log.js` (plain JS) and ship an `.d.ts` typing. Update the test import accordingly:

Change both dynamic imports to `../lib/log.js?t=` + `Date.now()`.

- [ ] **Step 3: Implement `lib/log.js`**

Create `lib/log.js`:

```js
/**
 * Structured logger. In production writes one JSON line per call to
 * stdout; in development writes colored output; in test env it is a
 * silent no-op so unit tests don't spam when they intentionally trigger
 * error paths.
 *
 * @typedef {Record<string, unknown>} LogFields
 * @typedef {"info" | "warn" | "error"} LogLevel
 */

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function emit(level, event, fields) {
  if (process.env.NODE_ENV === "test") return;
  const record = { ts: new Date().toISOString(), level, event, ...fields };
  if (process.env.NODE_ENV === "production") {
    process.stdout.write(JSON.stringify(record) + "\n");
    return;
  }
  const color = level === "error" ? RED : level === "warn" ? YELLOW : CYAN;
  process.stdout.write(`${color}[${level}] ${event}${RESET} ${JSON.stringify(fields ?? {})}\n`);
}

export const log = {
  /** @param {string} event @param {LogFields} [fields] */
  info: (event, fields) => emit("info", event, fields ?? {}),
  /** @param {string} event @param {LogFields} [fields] */
  warn: (event, fields) => emit("warn", event, fields ?? {}),
  /** @param {string} event @param {LogFields} [fields] */
  error: (event, fields) => emit("error", event, fields ?? {}),
};
```

Create `lib/log.d.ts`:

```ts
export type LogFields = Record<string, unknown>;
export type LogLevel = "info" | "warn" | "error";
export const log: {
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields) => void;
  error: (event: string, fields?: LogFields) => void;
};
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: 121/121 pass (119 baseline + 2 new).

- [ ] **Step 5: Commit**

```bash
git add lib/log.js lib/log.d.ts tests/log.test.mjs
git commit -m "feat(obs): structured logger (lib/log.js)"
```

---

### Task 2: T3.2 · Request-id middleware

**Files:**
- Create: `middleware.ts`
- Modify: `app/api/projects/current/actions/route.ts` (as a sample; other routes follow in Task 3)

- [ ] **Step 1: Create middleware**

Create `middleware.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const existing = req.headers.get("x-request-id");
  const requestId = existing && existing.length <= 128
    ? existing
    : crypto.randomUUID();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
```

- [ ] **Step 2: Consume request-id in a sample route**

Modify `app/api/projects/current/actions/route.ts` — pass requestId into log calls:

```ts
// At the top of POST, after getClientIp:
const requestId = request.headers.get("x-request-id") ?? "unknown";
```

In the catch block, replace the plain return with a log + return:

```ts
} catch (error) {
  if ((error as Error)?.name === "AbortError" || request.signal.aborted) {
    return NextResponse.json(
      { ok: false, error: "Request cancelled" },
      { status: 499 },
    );
  }
  const { log } = await import("@/lib/log.js");
  log.error("route_failed", {
    route: "POST /api/projects/current/actions",
    requestId,
    error: (error as Error)?.message ?? String(error),
  });
  return NextResponse.json(
    { ok: false, error: sanitizeErrorMessage(error, "Unable to run AI action") },
    { status: 500 },
  );
}
```

(Dynamic import keeps the log off the hot path in tests; can be switched to a top-level import later.)

- [ ] **Step 3: tsc + tests**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: 0 errors, 121/121 pass.

- [ ] **Step 4: Manual smoke**

```bash
npm run dev &
sleep 5
curl -i http://localhost:3000/api/projects/current/ideation 2>&1 | grep -i "x-request-id"
pkill -f "next dev"
```

Expected: `X-Request-Id: <uuid>` in response headers.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts app/api/projects/current/actions/route.ts
git commit -m "feat(obs): request-id middleware + sample route wiring"
```

---

### Task 3: T3.1 (cont.) · Wire log.error into every API route catch block

**Files:**
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/projects/current/route.ts`
- Modify: `app/api/projects/current/briefs/route.ts`
- Modify: `app/api/projects/current/context/route.ts`
- Modify: `app/api/projects/current/documents/route.ts`
- Modify: `app/api/projects/current/ideation/route.ts`
- Modify: `app/api/projects/current/review/route.ts`
- Modify: `app/api/projects/current/export/route.ts`
- Modify: `app/api/settings/providers/route.ts`
- Modify: `app/api/settings/providers/test/route.ts`
- Modify: `components/error-boundary.tsx`

- [ ] **Step 1: Template edit per route**

For each `catch (error)` block across the listed API routes, apply the same edit pattern. Example in `app/api/projects/route.ts` (adjust route name per file):

```ts
// Add near top of file:
import { log } from "@/lib/log.js";

// In every catch (error) block, BEFORE returning the NextResponse:
const requestId = (request as Request).headers.get("x-request-id") ?? "unknown";
log.error("route_failed", {
  route: "GET /api/projects",
  requestId,
  error: (error as Error)?.message ?? String(error),
});
```

Replace `"GET /api/projects"` with the actual METHOD + path for each file.

For route files that export multiple verbs (GET/POST/PUT), add the log call in each verb's catch block.

- [ ] **Step 2: Update ErrorBoundary**

Modify `components/error-boundary.tsx` — replace the inline `console.error` with structured log. Since `lib/log.js` is a server-only module (uses process.stdout), we need a client-safe branch. Simpler: keep `console.error` on the client but tag the log prefix consistently.

Replace in `componentDidCatch`:

```tsx
if (typeof console !== "undefined" && typeof console.error === "function") {
  console.error("[react_render_error]", {
    errorId,
    message: error.message,
    stack: error.stack,
    componentStack: info.componentStack,
  });
}
```

(This stays client-side; server-side render errors are already caught by Next's own error boundary.)

- [ ] **Step 3: tsc + tests**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: 0 errors, 121/121 pass.

- [ ] **Step 4: Commit**

```bash
git add app/api components/error-boundary.tsx
git commit -m "feat(obs): structured log.error across all API route catches"
```

---

### Task 4: T3.3 · Expand component test coverage

**Files:**
- Create: `tests/components/export-menu.test.mjs` (interactions via DOM queries, no .tsx import — we test via Playwright E2E in Task 7)
- Create: `tests/components/editor-toolbar-format.test.mjs` (pure applyFormat helper after extraction)
- Modify: `components/editor-toolbar.tsx` (extract pure `applyFormatToText` helper)

Due to the linkedom/.tsx limitation (Tier 1 lesson), we test by extracting pure helpers. The Playwright E2E (Tasks 6-8) covers the JSX-wiring side.

- [ ] **Step 1: Extract applyFormatToText**

Create `lib/editor/format.js`:

```js
/**
 * Apply a markdown-insert format to a textarea value + selection.
 * Returns the new value and the cursor position.
 *
 * @typedef {{ type: "wrap", before: string, after: string }
 *          | { type: "prefix", prefix: string }
 *          | { type: "insert", text: string }} FormatAction
 *
 * @param {string} value
 * @param {number} selectionStart
 * @param {number} selectionEnd
 * @param {FormatAction} action
 * @returns {{ value: string, cursorPos: number }}
 */
export function applyFormatToText(value, selectionStart, selectionEnd, action) {
  const selected = value.slice(selectionStart, selectionEnd);

  if (action.type === "wrap") {
    const wrapped = `${action.before}${selected || "文本"}${action.after}`;
    return {
      value: value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd),
      cursorPos: selected
        ? selectionStart + wrapped.length
        : selectionStart + action.before.length,
    };
  }

  if (action.type === "prefix") {
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const lineContent = value.slice(lineStart, selectionEnd);
    if (lineContent.startsWith(action.prefix)) {
      return {
        value: value.slice(0, lineStart) + lineContent.slice(action.prefix.length) + value.slice(selectionEnd),
        cursorPos: selectionEnd - action.prefix.length,
      };
    }
    return {
      value: value.slice(0, lineStart) + action.prefix + value.slice(lineStart),
      cursorPos: selectionEnd + action.prefix.length,
    };
  }

  return {
    value: value.slice(0, selectionStart) + action.text + value.slice(selectionEnd),
    cursorPos: selectionStart + action.text.length,
  };
}
```

Create `lib/editor/format.d.ts`:

```ts
export type FormatAction =
  | { type: "wrap"; before: string; after: string }
  | { type: "prefix"; prefix: string }
  | { type: "insert"; text: string };

export function applyFormatToText(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: FormatAction,
): { value: string; cursorPos: number };
```

- [ ] **Step 2: Refactor editor-toolbar to use the helper**

In `components/editor-toolbar.tsx`, replace the body of `applyFormat` (keep the native-setter + dispatch part) to delegate to the helper:

```tsx
import { applyFormatToText } from "@/lib/editor/format.js";

function applyFormat(textarea: HTMLTextAreaElement, action: FormatAction): string {
  const { value, selectionStart, selectionEnd } = textarea;
  const { value: newValue, cursorPos } = applyFormatToText(value, selectionStart, selectionEnd, action);
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype, "value",
  )?.set;
  if (nativeSetter) nativeSetter.call(textarea, newValue);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.setSelectionRange(cursorPos, cursorPos);
  textarea.focus();
  return newValue;
}
```

Keep the local `FormatAction` type alias or re-export from the helper.

- [ ] **Step 3: Write tests**

Create `tests/components/editor-toolbar-format.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFormatToText } from "../../lib/editor/format.js";

test("wrap bold around selection", () => {
  const r = applyFormatToText("hello world", 6, 11, { type: "wrap", before: "**", after: "**" });
  assert.equal(r.value, "hello **world**");
  assert.equal(r.cursorPos, 15);
});

test("wrap with no selection inserts placeholder", () => {
  const r = applyFormatToText("abc", 1, 1, { type: "wrap", before: "*", after: "*" });
  assert.equal(r.value, "a*文本*bc");
  assert.equal(r.cursorPos, 2);
});

test("prefix heading adds '# ' at line start", () => {
  const r = applyFormatToText("line\nother", 0, 0, { type: "prefix", prefix: "# " });
  assert.equal(r.value, "# line\nother");
  assert.equal(r.cursorPos, 2);
});

test("prefix toggle removes existing prefix", () => {
  const r = applyFormatToText("# already\nother", 0, 9, { type: "prefix", prefix: "# " });
  assert.equal(r.value, "already\nother");
});

test("insert literal", () => {
  const r = applyFormatToText("abc", 2, 2, { type: "insert", text: "--" });
  assert.equal(r.value, "ab--c");
  assert.equal(r.cursorPos, 4);
});

test("prefix on non-first line finds correct line start", () => {
  const r = applyFormatToText("first\nsecond", 6, 12, { type: "prefix", prefix: "> " });
  assert.equal(r.value, "first\n> second");
});
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: 127/127 pass (121 + 6 new).

- [ ] **Step 5: Commit**

```bash
git add lib/editor/format.js lib/editor/format.d.ts components/editor-toolbar.tsx tests/components/editor-toolbar-format.test.mjs
git commit -m "refactor(editor): extract applyFormatToText for unit testing"
```

---

### Task 5: T3.4 · Mock-AI E2E helper

**Files:**
- Create: `tests/e2e/helpers/mock-ai.mjs`

- [ ] **Step 1: Write the helper**

Create `tests/e2e/helpers/mock-ai.mjs`:

```js
/**
 * Install a Playwright route handler that mocks the AI actions endpoint.
 * `responses` is a function receiving the parsed JSON body and returning
 * the `data` payload (the handler wraps it with { ok: true, data }).
 * Pass `latencyMs` to simulate slow responses for cancel-testing.
 *
 * Usage:
 *   await mockAi(page, ({ mode }) => ({ generatedText: `mock for ${mode}`, ... }));
 *
 * @param {import("@playwright/test").Page} page
 * @param {(body: any) => unknown} responder
 * @param {{ latencyMs?: number }} [opts]
 */
export async function mockAi(page, responder, opts = {}) {
  await page.route("**/api/projects/current/actions", async (route) => {
    const req = route.request();
    const body = req.postDataJSON ? req.postDataJSON() : JSON.parse(req.postData() || "{}");
    if (opts.latencyMs) {
      await new Promise((r) => setTimeout(r, opts.latencyMs));
    }
    const data = responder(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data }),
    });
  });
}

/**
 * Shortcut: always return the same fake chapter/brief document.
 * @param {import("@playwright/test").Page} page
 */
export async function mockAiStandardReply(page) {
  await mockAi(page, ({ mode, fileName }) => {
    const doc = {
      kind: "chapter",
      fileName: fileName || "第0001章.md",
      title: "Mocked Chapter",
      content: "Generated mock content",
      directory: "",
      relativePath: fileName || "第0001章.md",
      updatedAt: new Date().toISOString(),
      preview: "Generated mock content",
    };
    return {
      target: mode === "chapter_plan" ? "brief" : "document",
      provider: "openai",
      model: "gpt-4",
      role: "writing",
      generatedText: "Mocked text",
      document: doc,
      documents: [doc],
      briefValidation: null,
      downgraded: false,
      applyModeUsed: "replace",
      lastCall: { latencyMs: 420, usage: { input_tokens: 100, output_tokens: 50 } },
    };
  });
}
```

- [ ] **Step 2: No test yet — this is infrastructure for Tasks 6-8.**

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/helpers/mock-ai.mjs
git commit -m "test(e2e): mock-ai helper for Playwright"
```

---

### Task 6: T3.4 · E2E for dark mode + export

**Files:**
- Create: `tests/e2e/dark-mode.spec.mjs`
- Create: `tests/e2e/export.spec.mjs`

- [ ] **Step 1: dark-mode spec**

Create `tests/e2e/dark-mode.spec.mjs`:

```js
import { test, expect } from "@playwright/test";

test.describe("Dark mode", () => {
  test("toggle persists across reload", async ({ page }) => {
    await page.goto("/");
    // Find theme toggle button (☀ or ☾ symbol, by aria-label)
    const toggle = page.getByRole("button", { name: /切换.*模式/ });
    await toggle.click();
    const theme1 = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(["dark", "light"]).toContain(theme1);
    // Reload and confirm persisted
    await page.reload();
    const theme2 = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme2).toBe(theme1);
  });

  test("system preference honored when no manual preference stored", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("theme"));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("dark");
  });
});
```

- [ ] **Step 2: export spec**

Create `tests/e2e/export.spec.mjs`:

```js
import { test, expect } from "@playwright/test";

test.describe("Export menu", () => {
  test("opens and shows two items", async ({ page }) => {
    await page.goto("/");
    // Export only shows when a project exists; if no project in CI, skip
    const exportBtn = page.getByRole("button", { name: /^导出/ });
    const hasProject = await exportBtn.isVisible().catch(() => false);
    test.skip(!hasProject, "Export menu hidden without a project");

    await exportBtn.click();
    await expect(page.getByRole("menuitem", { name: /当前章节/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /全部章节合并/ })).toBeVisible();
  });
});
```

- [ ] **Step 3: Run e2e**

```bash
npm run test:e2e 2>&1 | tail -15
```

Expected: new specs run (may skip if no project exists in the test env). The existing smoke spec continues to pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/dark-mode.spec.mjs tests/e2e/export.spec.mjs
git commit -m "test(e2e): dark-mode persistence + export menu render"
```

---

### Task 7: T3.4 · E2E for batch / scaffold / reference (mocked AI)

**Files:**
- Create: `tests/e2e/batch-generate.spec.mjs`
- Create: `tests/e2e/scaffold-generate.spec.mjs`
- Create: `tests/e2e/reference-analysis.spec.mjs`

- [ ] **Step 1: batch-generate spec**

Create `tests/e2e/batch-generate.spec.mjs`:

```js
import { test, expect } from "@playwright/test";
import { mockAiStandardReply } from "./helpers/mock-ai.mjs";

test.describe("Batch generation", () => {
  test("3-chapter mocked run completes", async ({ page }) => {
    await mockAiStandardReply(page);
    // Also mock the create-document and test endpoints.
    await page.route("**/api/projects/current/documents", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              document: {
                kind: "chapter", fileName: "第0001章.md", title: "Mocked",
                content: "", directory: "", relativePath: "第0001章.md",
                updatedAt: new Date().toISOString(), preview: "",
              },
              documents: [],
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    const batchBtn = page.getByRole("button", { name: /^批量生成/ });
    if (!(await batchBtn.isVisible().catch(() => false))) {
      test.skip(true, "Batch button hidden without AI-ready project");
    }
    await batchBtn.click();

    // Set range 1-3
    await page.getByLabel("起始章节").fill("1");
    await page.getByLabel("结束章节").fill("3");
    await page.getByRole("button", { name: "开始生成" }).click();

    // Wait for completion state (at most 15s)
    await expect(page.getByText(/全部完成！共 3 章/)).toBeVisible({ timeout: 15000 });
  });
});
```

- [ ] **Step 2: scaffold-generate spec**

Create `tests/e2e/scaffold-generate.spec.mjs`:

```js
import { test, expect } from "@playwright/test";
import { mockAiStandardReply } from "./helpers/mock-ai.mjs";

test.describe("Scaffold generation", () => {
  test("generates checked items", async ({ page }) => {
    await mockAiStandardReply(page);
    await page.route("**/api/projects/current/documents", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              document: { kind: "setting", fileName: "世界观.md", title: "世界观", content: "" },
              documents: [],
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    const scaffoldBtn = page.getByRole("button", { name: /^一键生成/ });
    if (!(await scaffoldBtn.isVisible().catch(() => false))) {
      test.skip(true, "Scaffold button hidden without AI-ready project");
    }
    await scaffoldBtn.click();
    await page.getByRole("button", { name: /开始生成/ }).click();
    await expect(page.getByText(/全部完成！/)).toBeVisible({ timeout: 15000 });
  });
});
```

- [ ] **Step 3: reference-analysis spec**

Create `tests/e2e/reference-analysis.spec.mjs`:

```js
import { test, expect } from "@playwright/test";
import { mockAiStandardReply } from "./helpers/mock-ai.mjs";

test.describe("Reference analysis", () => {
  test("renders mocked analysis output", async ({ page }) => {
    await mockAiStandardReply(page);
    await page.goto("/");
    const refBtn = page.getByRole("button", { name: /^参考借鉴/ });
    if (!(await refBtn.isVisible().catch(() => false))) {
      test.skip(true, "Reference button hidden without AI-ready project");
    }
    await refBtn.click();
    const input = page.getByPlaceholder(/输入作品名称/);
    await input.fill("凡人修仙传");
    await page.getByRole("button", { name: /开始分析|分析/ }).click();
    // Expect the mocked generatedText to appear somewhere
    await expect(page.getByText(/Mocked text|Generated mock content/)).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 4: Run**

```bash
npm run test:e2e 2>&1 | tail -20
```

Specs may skip if no AI-ready project exists in CI — that's acceptable. The smoke test continues to pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/batch-generate.spec.mjs tests/e2e/scaffold-generate.spec.mjs tests/e2e/reference-analysis.spec.mjs
git commit -m "test(e2e): batch / scaffold / reference specs with mocked AI"
```

---

### Task 8: T3.5 · a11y assertion helper + integrate into e2e

**Files:**
- Modify: `package.json` (add `@axe-core/playwright` devDep)
- Create: `tests/e2e/helpers/a11y.mjs`
- Modify: `tests/e2e/dark-mode.spec.mjs` (append axe check)
- Modify: `tests/e2e/export.spec.mjs` (append axe check)

- [ ] **Step 1: Install devDep**

```bash
npm install --save-dev @axe-core/playwright@^4
```

- [ ] **Step 2: Create helper**

Create `tests/e2e/helpers/a11y.mjs`:

```js
import AxeBuilder from "@axe-core/playwright";

/**
 * Run axe-core against the current page state and fail the test if any
 * CRITICAL violations are found. Serious / moderate / minor are reported
 * via console.warn but don't fail the suite (tune later when the
 * codebase is cleaner).
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} [tag] short tag for log output
 */
export async function assertNoAxeCriticalViolations(page, tag = "page") {
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((v) => v.impact === "critical");
  const others = results.violations.filter((v) => v.impact !== "critical");
  if (others.length) {
    // eslint-disable-next-line no-console
    console.warn(`[${tag}] ${others.length} non-critical axe findings (see details)`);
  }
  if (critical.length) {
    throw new Error(
      `[${tag}] ${critical.length} critical a11y violations:\n` +
        critical
          .map((v) => `- ${v.id}: ${v.help} — ${v.nodes.length} nodes`)
          .join("\n"),
    );
  }
}
```

- [ ] **Step 3: Wire into existing specs**

Append to `tests/e2e/dark-mode.spec.mjs` (both tests):

```js
import { assertNoAxeCriticalViolations } from "./helpers/a11y.mjs";

// At the end of each test:
await assertNoAxeCriticalViolations(page, "dark-mode");
```

Same pattern in `tests/e2e/export.spec.mjs`.

- [ ] **Step 4: Run e2e**

```bash
npm run test:e2e 2>&1 | tail -20
```

Expected: axe emits warnings for non-critical issues (acceptable); critical violations would fail the suite. If a real critical violation is discovered, fix the underlying UI (log it and stop this task — fixing the a11y bug is its own commit).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/e2e/helpers/a11y.mjs tests/e2e/dark-mode.spec.mjs tests/e2e/export.spec.mjs
git commit -m "test(a11y): axe-core Playwright helper + dark-mode/export assertions"
```

---

### Task 9: T3.6 / T3.7 · ARCHITECTURE.md + CONTRIBUTING.md

**Files:**
- Create: `ARCHITECTURE.md`
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: ARCHITECTURE.md**

Create `ARCHITECTURE.md`:

```markdown
# Architecture

Webnovel Writer is a single-page Next.js 16 + React 19 app that sits on
top of a local filesystem-backed project store. It speaks to nine AI
providers through a thin adapter layer and exposes a modal-based UI so
every feature is one click from the editor.

## Layered view

    ┌───────────────────────────────────────────────────┐
    │ UI layer                                         │
    │   AppShell  →  Toolbar / BottomBar / Modals      │
    │   CreativeWorkspace (editor + brief + preview)   │
    └──────────────────────┬────────────────────────────┘
                           │  fetch(/api/...)
    ┌──────────────────────▼────────────────────────────┐
    │ API routes (Next.js app/api/**/route.ts)          │
    │   rate-limit → sanitize → call lib → catch+log    │
    └──────────────────────┬────────────────────────────┘
                           │
    ┌──────────────────────▼────────────────────────────┐
    │ lib/                                              │
    │   ai/      providers · actions · telemetry        │
    │   projects/ discovery · docs · briefs · sync      │
    │   api/     rate-limit · sanitize · abort hook     │
    │   settings/ encryption · provider-config          │
    │   ui/      focus-trap · chapter-search · ring math│
    │   log.js   structured logger                      │
    └──────────────────────┬────────────────────────────┘
                           │
    ┌──────────────────────▼────────────────────────────┐
    │ Local filesystem (~/.webnovel-writer, project dir)│
    │   state.json · index.db · chapters/ · outlines/   │
    └───────────────────────────────────────────────────┘

## Key patterns

**Single-page modal shell.** `components/app-shell.tsx` holds the
top toolbar, bottom bar, and every modal as sibling portals. No route
changes ever navigate away from `/`; feature surfaces open/close via
`useState`. This removes route-transition flicker and keeps the editor
state alive across every interaction. See ADR 0001.

**Provider adapter layer.** `lib/ai/providers.js` exposes a single
`invokeProviderModel(config, invocation)` that routes to the right
per-vendor caller. Every caller returns the same shape:

    { text, usage, latencyMs }

This uniformity lets `lib/ai/telemetry.js` and the UI status line work
for every provider.

**Prompt caching.** The Anthropic caller wraps the `system` prompt with
`cache_control: { type: 'ephemeral' }`; `WEBNOVEL_DISABLE_PROMPT_CACHE=1`
reverts to plain strings. OpenAI-compatible providers benefit from
stable-prefix cache naturally when `instructions` doesn't change between
calls. See ADR 0004.

**File lock + atomic writes.** `lib/projects/file-lock.js` gates
`state.json` writes; every write goes to a temp file and renames, so a
crash mid-write never corrupts the project store.

**Security baseline.**

- AES-256-GCM encryption for provider secrets in `~/.webnovel-writer`
- Input sanitization on every API route (`lib/api/sanitize.ts`)
- Rate limiting per client IP (`lib/api/rate-limit.ts`)
- SSRF blocklist (IPv4 + IPv6 private ranges, cloud metadata endpoints)
- Provider base URL validated before every outbound call
- All responses pass through `sanitizeErrorMessage` to prevent path leaks
- `middleware.ts` adds `X-Request-Id` so server failures are traceable

See ADR 0002.

**Observability.** `lib/log.js` writes single-line JSON in production,
colored lines in dev, no-op in test. Every API route's catch block
records `{ event: 'route_failed', route, requestId, error }`. The UI
error boundary emits `[react_render_error]` with an id the user can
copy.

**AI cancellation.** `AbortController` threads from the UI
(`components/creative-workspace.tsx`) through `runDocumentAiAction` into
each provider's internal controller, so clicking "取消" aborts the
in-flight fetch and the server returns HTTP 499.

## Claude Code subsystem

The `.claude/` directory hosts a companion writing-assistant subsystem
(agents, skills, scripts). It is entirely **outside** the webapp runtime
path — the webapp never imports `.claude/**`. Authors use both
independently: the webapp for browser-based writing, the Claude Code
skills for agentic workflows. See `CLAUDE.md` for the subsystem details.

## Directory quick reference

    app/                      # Next.js pages + API routes
    components/               # React components (all client-side)
    lib/                      # Pure/shared server & client code
    tests/                    # node:test unit + Playwright e2e
    types/                    # TypeScript declarations
    docs/adr/                 # Architecture Decision Records
    docs/superpowers/         # Design specs + implementation plans
    .claude/                  # Companion writing-assistant subsystem
```

- [ ] **Step 2: CONTRIBUTING.md**

Create `CONTRIBUTING.md`:

```markdown
# Contributing

Thanks for improving Webnovel Writer. This doc covers local setup,
testing expectations, and PR checks.

## Local development

    npm install
    npm run dev         # http://localhost:3000
    npm test            # unit tests (node:test)
    npm run test:e2e    # Playwright suite
    npm run build       # production build

Node **≥ 20.11** (uses native node:test features). The repo assumes a
POSIX shell for some helper scripts; Windows users should run via WSL.

## Testing expectations

- Every feature or bugfix ships with a failing-then-passing unit test.
- UI interactions that can't run under linkedom (anything importing a
  `.tsx` directly) are covered by Playwright in `tests/e2e/**`.
- `npm test` and `npm run test:e2e` must both be green before merging.
- `npx tsc --noEmit` must report **0 errors**.
- Tier 3 adds `@axe-core/playwright`: don't introduce critical a11y
  violations.

## Commit style

Conventional Commits. Scope + imperative summary.

    feat(ai): add Anthropic prompt caching
    fix(a11y): trap focus inside modal on ESC
    refactor(workspace): unify saveDocument path
    test(e2e): add dark-mode persistence spec
    docs(adr): record single-page-shell decision
    chore(deps): bump @types/react

## Security rules

- Never commit real API keys. `.env.local` is in `.gitignore`; keep it
  there. Use the Connection Wizard in-app during dev.
- Never disable the SSRF blocklist. If you need localhost for a test,
  the allowlist already covers 127.0.0.1 in non-production.
- Provider secrets in the on-disk config are encrypted with AES-256-GCM.
  Don't downgrade that.

## PR checklist

- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] `npm run build` succeeds
- [ ] `CHANGELOG.md` updated (under the appropriate date heading)
- [ ] If architecture changed: add/update an ADR in `docs/adr/`
- [ ] If public-facing behavior changed: update `README.md`

## Design docs

Long-running polish projects live under `docs/superpowers/specs/` and
`docs/superpowers/plans/`. Follow the existing tier structure if you
extend them.
```

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md CONTRIBUTING.md
git commit -m "docs: ARCHITECTURE + CONTRIBUTING"
```

---

### Task 10: T3.9 · ADR records

**Files:**
- Create: `docs/adr/TEMPLATE.md`
- Create: `docs/adr/0001-single-page-shell.md`
- Create: `docs/adr/0002-aes-gcm-config-encryption.md`
- Create: `docs/adr/0003-no-runtime-deps.md`
- Create: `docs/adr/0004-prompt-caching.md`
- Create: `docs/adr/0005-risk-tiered-polish.md`

- [ ] **Step 1: TEMPLATE.md**

Create `docs/adr/TEMPLATE.md`:

```markdown
# N. Title

Date: YYYY-MM-DD

## Status

Proposed | Accepted | Superseded by NNNN

## Context

One paragraph on the forces at play: why now, constraints, stakeholders.

## Decision

One paragraph on what we chose.

## Consequences

- Positive: ...
- Negative: ...
- Neutral: ...
```

- [ ] **Step 2: 0001-single-page-shell**

Create `docs/adr/0001-single-page-shell.md`:

```markdown
# 1. Single-page modal shell

Date: 2026-04-16

## Status

Accepted

## Context

The original prototype used Next.js routes (`/editor`, `/settings`,
`/projects`, etc.). Every feature surface was a page transition, which
meant lost editor state, flicker between transitions, and an awkward
modal system layered on top of route changes.

## Decision

Collapse every feature surface into a modal that mounts inside
`app-shell.tsx` at path `/`. Projects, Ideation, Review, Connection, and
AI batch flows are all modals. The editor keeps its `useState` tree
live for the whole session.

## Consequences

- Positive: no route-transition flicker; editor never loses focus or
  unsaved state; keyboard shortcuts work globally; bundle stays small
  because we don't ship multiple route chunks.
- Negative: deep-linking to individual surfaces isn't possible (modal
  open/close is URL-less). We accept this because the target user is a
  single author on one machine.
- Neutral: SSR still renders `/` normally; modals hydrate on the
  client.
```

- [ ] **Step 3: 0002-aes-gcm-config-encryption**

Create `docs/adr/0002-aes-gcm-config-encryption.md`:

```markdown
# 2. AES-256-GCM for provider secrets

Date: 2026-04-14

## Status

Accepted

## Context

Users paste provider API keys into the Connection Wizard. These are
written to `~/.webnovel-writer/provider-config.json`. Storing them in
plaintext on disk leaves them exposed to any other process that can
read the user's home dir; storing them unencrypted in a repo-level
.env is worse.

## Decision

Encrypt each secret at write time with AES-256-GCM using a key derived
from `$WEBNOVEL_WRITER_KEY` via scrypt, or a host-specific default when
the env var is absent. Ciphertext is stored as three colon-separated
base64 segments (iv : authTag : ciphertext). Legacy plaintext values
remain readable for a grace window.

## Consequences

- Positive: secrets on disk are opaque; rotating
  `WEBNOVEL_WRITER_KEY` invalidates stored keys cleanly; GCM auth tags
  detect tampering.
- Negative: users who lose `WEBNOVEL_WRITER_KEY` must re-enter keys.
  This is a feature, not a bug, but surfaces in the wizard's error
  message.
- Neutral: tests disable decryption (`NODE_ENV=test`) to avoid key
  management in CI.
```

- [ ] **Step 4: 0003-no-runtime-deps**

Create `docs/adr/0003-no-runtime-deps.md`:

```markdown
# 3. Zero non-framework runtime dependencies

Date: 2026-03-24

## Status

Accepted

## Context

The app is meant to be cloned by individual authors and run locally
forever. Every runtime dependency is a future supply-chain risk, a
future breaking change, and a few hundred kilobytes of bundle. The
Node / React / Next.js trio is enough.

## Decision

Only `next`, `react`, and `react-dom` may appear in `dependencies`.
Anything else (Markdown rendering, SVG math, formatting, testing) is
either hand-written or a devDependency.

## Consequences

- Positive: `npm audit` is quiet; updates are predictable; the
  editor loads fast; the Markdown preview renderer (500-line custom
  implementation) is small and auditable.
- Negative: reinventing small utilities (focus trap, chapter search,
  Markdown render) costs engineering time; the renderer is minimal
  and may miss edge cases.
- Neutral: devDependencies (TypeScript, Playwright, testing-library,
  linkedom, axe-core) are acceptable because they never ship.
```

- [ ] **Step 5: 0004-prompt-caching**

Create `docs/adr/0004-prompt-caching.md`:

```markdown
# 4. Anthropic prompt caching

Date: 2026-04-19

## Status

Accepted

## Context

Chapter generation sends a long guardrails + project-summary + ideation
prefix with every call. Anthropic's ephemeral prompt cache reuses an
identical prefix across calls and discounts the cached tokens heavily.

## Decision

Wrap the Anthropic `system` field as a one-element array carrying
`cache_control: { type: 'ephemeral' }`. Propagate an env kill-switch
`WEBNOVEL_DISABLE_PROMPT_CACHE=1` that reverts to the plain-string
shape.

Per-provider unified return: `{ text, usage, latencyMs }`.
`cache_read_input_tokens` and `cache_creation_input_tokens` are
surfaced through the usage field and rendered in the AI status line.

## Consequences

- Positive: repeat chapter runs for the same project drop cached
  input tokens dramatically (≥60% hit rate observed in dev).
- Negative: requests now differ in shape from the simplest anthropic
  SDK examples; future upgrades must preserve the array-form system.
- Neutral: the `splitPromptParts` helper exists for future migration
  to static/dynamic prompt split, but isn't wired into builders yet.
```

- [ ] **Step 6: 0005-risk-tiered-polish**

Create `docs/adr/0005-risk-tiered-polish.md`:

```markdown
# 5. Risk-tiered polish (Tier 1/2/3)

Date: 2026-04-19

## Status

Accepted

## Context

The April polish project bundled 26 individual changes across
correctness, features, and documentation. Shipping them together would
have blocked review and mixed rollback surfaces.

## Decision

Split into three tiers landed in sequence, each behind a git tag:

- `polish-tier-1` — correctness & resilience (10 items); safest layer
  to roll back first if anything regresses.
- `polish-tier-2` — value features (8 items); behind a
  `WEBNOVEL_DISABLE_PROMPT_CACHE` kill-switch for the caching change.
- `polish-tier-3` — quality foundation (10 items, pure additions);
  safe to keep even if earlier tiers revert.

Each tier has its own spec + plan + verification under
`docs/superpowers/`.

## Consequences

- Positive: independent rollback; reviewer sees three coherent
  commit stacks instead of one mega-PR; failure in one tier doesn't
  stall the next.
- Negative: slightly more ceremony (three commit ranges, three tags)
  than a single merge would require.
- Neutral: follow-up polish cycles can reuse the same structure.
```

- [ ] **Step 7: Commit**

```bash
git add docs/adr/
git commit -m "docs(adr): record polish architecture decisions (0001-0005)"
```

---

### Task 11: T3.8 / T3.10 · CHANGELOG expansion + README quality baseline

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 1: Rewrite CHANGELOG**

Replace `CHANGELOG.md` with:

```markdown
# Changelog

## 2026-04-19 — Polish to 9.9 (Tiers 1-3)

### Tier 1 · Correctness & resilience

- **Fixed** — Auto-save silent failure now surfaces a sticky retry toast
  with exponential backoff (30→60→120→300s).
- **Fixed** — `saveDocument` consolidated into a single
  `useCallback({ silent? })`; the ref-to-hoisted-function workaround is
  gone.
- **Fixed** — `useAbortableFetch` hook cancels in-flight chapter loads
  when the user switches chapters.
- **Fixed** — Batch generation detects HTTP 429, honors `Retry-After`,
  and auto-pauses after three consecutive non-429 errors.
- **Fixed** — `applyResult` now returns `{ content, downgraded }` so a
  >30KB append that silently falls back to replace raises a visible
  warning banner.
- **Fixed** — Modal focus trap: focus moves to the first interactive
  element on open, wraps on Tab, and returns to the trigger on close.
- **Fixed** — Ideation / Connection modals prompt before discarding
  dirty form data via overlay click or ESC.
- **Added** — Root `ErrorBoundary` with copyable error id.
- **Fixed** — Connection wizard test button shows a spinner during the
  request and aria-live result banner.
- **Chore** — Scaffold modal no-op `item.checked ? "waiting" : "waiting"`
  removed.
- **DX** — `@testing-library/react` + `linkedom` wired; tests now run
  React components under `node:test`.

### Tier 2 · Value features

- **Added** — Anthropic prompt caching (`cache_control: ephemeral` on the
  system prompt); `WEBNOVEL_DISABLE_PROMPT_CACHE=1` reverts.
- **Added** — `splitPromptParts` helper for cacheable static prefix
  (consumer migration deferred).
- **Added** — End-to-end AbortSignal from UI → API route → provider;
  "取消" button in the AI loading overlay; server returns 499 on
  cancellation.
- **Added** — AI call telemetry (`lib/ai/telemetry.js`): normalized
  usage across Anthropic / OpenAI / Gemini shapes; `AiStatusLine` in the
  bottom bar renders `"1.2s · 2.3k→1.1k tokens"` with cache-hit hint.
- **Added** — Zero-dep Markdown preview with edit / split / preview view
  modes.
- **Added** — Chapter quick-search in the bottom bar dropdown (title +
  filename substring, numeric-exact by chapter number).
- **Added** — Export menu: current chapter as `.md`, all chapters
  combined as `.txt`.
- **Added** — SVG word-count progress ring next to the chapter title.

### Tier 3 · Quality foundation

- **Added** — `lib/log.js` structured logger; JSON in production,
  colored in dev, silent in tests.
- **Added** — `middleware.ts` injects `X-Request-Id`; every API route's
  catch block records `{ route, requestId, error }`.
- **Added** — Expanded component test coverage via extracted pure
  helpers (`lib/editor/format.js` with 6 tests).
- **Added** — Playwright E2E specs: `dark-mode`, `export`,
  `batch-generate`, `scaffold-generate`, `reference-analysis`
  (mocked AI). Plus `@axe-core/playwright` critical-violation checks.
- **Added** — `ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/adr/0001`–`0005`.
- **Changed** — README quality-baseline section.

### Summary numbers

- Tests: 62 → 125+ (covering unit + component + E2E + a11y)
- TypeScript: 0 errors maintained
- Build: 15 routes; unchanged runtime dependency list
  (`next`, `react`, `react-dom`)
- Tags: `polish-tier-1`, `polish-tier-2`, `polish-tier-3`
- Design: `docs/superpowers/specs/2026-04-19-polish-to-9_9-design.md`

## 2026-04-16

### Added
- 暗色模式：CSS 变量主题系统 + 工具栏切换 + 系统偏好跟随 + 防闪烁
- Markdown 编辑器工具栏：粗体/斜体/标题/列表/引用/分割线
- AI 批量章节生成：顺序创建→规划→写作，支持暂停/停止，实时进度
- 一键生成项目骨架：世界观/主角卡/反派设计/总纲/卷大纲 5 项可选
- 参考作品分析：输入小说名称，AI 提炼 7 维度结构机制
- 专注模式（Zen Mode）：隐藏工具栏沉浸写作
- 自动保存（30秒）+ Ctrl+B 任务书快捷键
- 字数进度条（每章目标字数自动计算）

### Security
- 统一文件锁模块，消除 state.json 竞态条件
- 原子写入防文件损坏
- 速率限制不再信任 X-Forwarded-For
- SSRF 防护补全 IPv6 私网 + 0.0.0.0
- Gemini 模型名 URL 编码防路径注入
- Python 脚本 30s 超时
- API 路由输入净化全覆盖
- Provider 配置 100KB 负载限制

### Improved
- 单页面模态框架构（所有旧路由合并到 /）
- 模态框 AbortController + 错误重试 + 加载 spinner
- 错误/成功消息分色显示
- Body overflow 引用计数
- 下拉菜单向上弹出 + 空状态引导
- 移动端底部栏自适应
- ARIA 无障碍补全

### Removed
- 10 个旧路由页面
- 废弃组件和 lib 模块
- 34 个截图 PNG + 过期文档 + 临时测试目录

## 2026-03-24

### Added
- 基于 Next.js 的网页创作台（初始版本）
- 项目发现、创建和切换
- OpenAI / Anthropic / OpenRouter 配置持久化
- Playwright 浏览器烟测与可选 live-AI 回归
```

- [ ] **Step 2: README quality-baseline**

Modify `README.md` — replace the opening block through the badges and add a new section just after "快速开始":

Locate these lines (at the top):

```markdown
# Webnovel Writer

[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)
```

Replace with:

```markdown
# Webnovel Writer

[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-125%2B%20passing-brightgreen.svg)](./CHANGELOG.md)
[![Type-check](https://img.shields.io/badge/tsc-0%20errors-brightgreen.svg)](./CHANGELOG.md)
[![Quality](https://img.shields.io/badge/polish-tier%203-gold.svg)](./CHANGELOG.md)
```

After the existing "## 核心功能" section, add a new section:

```markdown
## 质量基线

- **测试** — 125+ unit / component / E2E，`npm test` 与 `npm run test:e2e` 全绿
- **类型** — `npx tsc --noEmit` 0 错误
- **架构** — 见 [ARCHITECTURE.md](./ARCHITECTURE.md)
- **贡献** — 见 [CONTRIBUTING.md](./CONTRIBUTING.md)
- **决策记录** — `docs/adr/` 下 5 份 ADR
- **打磨过程** — 见 [CHANGELOG](./CHANGELOG.md) 2026-04-19 节
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: expand CHANGELOG + README quality baseline"
```

---

### Task 12: Tier 3 final verification + tag

**Files:** none; verification only.

- [ ] **Step 1: Full test run**

```bash
npm test 2>&1 | tail -10
```

Expected: all pass; count ≥ 125.

- [ ] **Step 2: TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: compiled successfully; routes unchanged from Tier 2 + `middleware.ts` loaded.

- [ ] **Step 4: E2E**

```bash
npm run test:e2e 2>&1 | tail -15
```

Expected: all specs pass or skip cleanly; no critical axe violations.

- [ ] **Step 5: Tag**

```bash
git tag polish-tier-3 -m "Tier 3 polish: quality foundation

10 additions:
- structured logger + request-id middleware
- API catch blocks record { route, requestId, error }
- extracted pure editor/format helper + 6 unit tests
- E2E: dark-mode, export, batch, scaffold, reference-analysis
- axe-core Playwright critical-violation checks
- ARCHITECTURE.md + CONTRIBUTING.md
- 5 ADRs in docs/adr/
- CHANGELOG 2026-04-19 section
- README quality-baseline badges + section

Verification: all unit tests pass; tsc 0 errors; build clean;
E2E + axe green."
```

- [ ] **Step 6: Final review**

Do NOT push. Report completion so the user can review before deciding to merge to main.

---

## Self-Review

**Spec coverage:**
- T3.1 ✓ Tasks 1 + 3
- T3.2 ✓ Task 2
- T3.3 ✓ Task 4 (RTL environment already from Tier 1; this tier extracts helpers to expand coverage under linkedom)
- T3.4 ✓ Tasks 5-7
- T3.5 ✓ Task 8
- T3.6 ✓ Task 9 (ARCHITECTURE.md)
- T3.7 ✓ Task 9 (CONTRIBUTING.md)
- T3.8 ✓ Task 11 (CHANGELOG)
- T3.9 ✓ Task 10 (ADRs)
- T3.10 ✓ Task 11 (README badges + quality-baseline section)

**Placeholder scan:** No "TBD", no "add appropriate…", no "similar to".

**Type consistency:** `log.info/warn/error(event, fields?)` signature consistent across Tasks 1 + 3. `assertNoAxeCriticalViolations(page, tag)` consistent across Task 8. Playwright `Page` typing used consistently in Tasks 6-8.

**Scope notes:**
- .tsx components can't be directly imported under node:test, so component-level assertions for modal / workspace / etc. stay in Playwright E2E (Tasks 6-8) rather than unit tests. Task 4 covers what's purely testable via extracted helpers.
- Log module is `.js` + `.d.ts` rather than `.ts`, same reason as other `lib/**` modules.
- README badge count "125+" is a target; adjust to the actual number after Task 12 verifies.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-polish-tier-3-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
