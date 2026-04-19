# Polish Tier 4a Implementation Plan — Zero-Behavior Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead code, DRY 18 API catch blocks via `withRouteLogging`, DRY 5 modal `AbortController` patterns via `useModalResource`, and regroup 12 trailing T1/T2 CSS sections into their logical buckets — with zero user-visible behavior change.

**Architecture:** Pure-removal and refactor-in-place. No business logic is added or changed. Every task follows TDD: capture current behavior with a test (if not already covered), perform the refactor, verify the test still passes.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, node:test, existing `@testing-library/react` + `linkedom` (Tier 1). No new devDeps.

**Branch:** `polish/tier-4a` (already checked out). Tag `polish-tier-4a` at the end.

**Budget:** ~-500 lines production, ~-200 lines tests. 137 baseline tests → ~123 after death-of-dead-tests (still all green).

---

## File Structure

**Deletions (T4.1 / T4.2 / T4.3):**
- `lib/ai/prompt-cache.js` / `.d.ts`
- `lib/ai/repair-link.js` / `.d.ts`
- `lib/ai/repair-request.js` / `.d.ts`
- `tests/ai/prompt-cache.test.mjs`
- `tests/ai/repair-link.test.mjs`
- `tests/ai/repair-request.test.mjs`

**New files (T4.4 / T4.5):**
- `lib/api/with-route-logging.ts` — higher-order handler that wraps try/catch + log + sanitize
- `tests/api/with-route-logging.test.mjs` — unit tests with mocked `log.error`
- `lib/api/use-modal-resource.ts` — hook managing `{ data, loading, error, retry }` with AbortController
- `tests/components/use-modal-resource.test.mjs` — unit tests for the hook

**Modified files:**
- `package.json` — drop `@testing-library/user-event` devDep (T4.3)
- `tests/setup/react.mjs` — remove re-export of `userEvent` (T4.3)
- All 10 API route files under `app/api/**/route.ts` — collapse catch into `withRouteLogging` (T4.4)
- `components/connection-modal.tsx`, `components/ideation-modal.tsx`, `components/review-modal.tsx`, `components/projects-modal.tsx`, `components/project-dropdown.tsx` — consume `useModalResource` (T4.5)
- `app/globals.css` — regroup 12 trailing sections (T4.6)

---

### Task 1: T4.1 · Delete prompt-cache dead module

**Files:**
- Delete: `lib/ai/prompt-cache.js`
- Delete: `lib/ai/prompt-cache.d.ts`
- Delete: `tests/ai/prompt-cache.test.mjs`

- [ ] **Step 1: Verify zero production imports**

```bash
grep -rln "prompt-cache" --include="*.ts" --include="*.tsx" --include="*.js" app components lib 2>/dev/null
```

Expected: empty output. If anything surfaces (other than itself), STOP and report as DONE_WITH_CONCERNS.

- [ ] **Step 2: Delete the files**

```bash
rm lib/ai/prompt-cache.js lib/ai/prompt-cache.d.ts tests/ai/prompt-cache.test.mjs
```

- [ ] **Step 3: Verify tsc + tests**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: 0 errors, tests drop by 3 (137 → 134), all pass.

- [ ] **Step 4: Commit**

```bash
git add -A lib/ai/prompt-cache.js lib/ai/prompt-cache.d.ts tests/ai/prompt-cache.test.mjs
git commit -m "refactor(ai): drop unused prompt-cache helper

Shipped in T2.2 as helper for future prompt-builder migration; the
builders were never migrated. Provider-layer Anthropic caching (T2.1)
doesn't need this helper. Remove dead code; git history preserves it."
```

---

### Task 2: T4.2 · Delete repair-link and repair-request dead modules

**Files:**
- Delete: `lib/ai/repair-link.js` / `.d.ts`
- Delete: `lib/ai/repair-request.js` / `.d.ts`
- Delete: `tests/ai/repair-link.test.mjs`
- Delete: `tests/ai/repair-request.test.mjs`

- [ ] **Step 1: Verify zero production imports**

```bash
grep -rln "repair-link\|repair-request" --include="*.ts" --include="*.tsx" --include="*.js" app components lib 2>/dev/null
```

Expected: empty. If anything surfaces, STOP and report.

- [ ] **Step 2: Delete files**

```bash
rm lib/ai/repair-link.js lib/ai/repair-link.d.ts lib/ai/repair-request.js lib/ai/repair-request.d.ts \
   tests/ai/repair-link.test.mjs tests/ai/repair-request.test.mjs
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: 0 errors, tests drop by ~10 (134 → ~124), all pass.

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor(ai): drop unused repair-link / repair-request modules

From a pre-Tier-1 architecture where the UI called brief/chapter
repair actions. The current workspace UI calls the AI actions route
directly, bypassing these builders. No production importer remains."
```

---

### Task 3: T4.3 · Drop unused @testing-library/user-event devDep

**Files:**
- Modify: `tests/setup/react.mjs`
- Modify: `package.json` (+ lockfile)

- [ ] **Step 1: Verify zero usage**

```bash
grep -rn "userEvent\|user-event" tests components app lib --include="*.mjs" --include="*.ts" --include="*.tsx" --include="*.js"
```

Expected: only `tests/setup/react.mjs` (the re-export site).

- [ ] **Step 2: Update setup/react.mjs**

Edit `tests/setup/react.mjs`:

```js
// Before:
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export { render, screen, fireEvent, cleanup, waitFor, userEvent };

// After:
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

export { render, screen, fireEvent, cleanup, waitFor };
```

- [ ] **Step 3: Uninstall the devDep**

```bash
npm uninstall --save-dev @testing-library/user-event
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: 0 errors, tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/setup/react.mjs
git commit -m "chore(deps): drop unused @testing-library/user-event

Re-exported but never used by any test. Removing shrinks node_modules
and clarifies the test surface to render/screen/fireEvent/cleanup/waitFor."
```

---

### Task 4: T4.4 · Extract withRouteLogging higher-order handler

**Files:**
- Create: `lib/api/with-route-logging.ts`
- Create: `tests/api/with-route-logging.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/api/with-route-logging.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withRouteLogging } from "../../lib/api/with-route-logging.ts?t=placeholder";
```

(node:test cannot import .ts directly; ship the implementation as
`.js` with a `.d.ts` sibling, and update imports below to
`.js?t=placeholder`. Mirror the pattern used in `lib/log.js` and
`lib/ai/telemetry.js`.)

Rewrite the import:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withRouteLogging } from "../../lib/api/with-route-logging.js?t=" + Date.now();

test("withRouteLogging forwards successful responses unchanged", async () => {
  process.env.NODE_ENV = "test";
  const handler = withRouteLogging("GET /api/test", async (req, { requestId }) => {
    assert.equal(typeof requestId, "string");
    return new Response(JSON.stringify({ ok: true, echo: requestId }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const req = new Request("http://x/test", {
    headers: { "x-request-id": "id-abc" },
  });
  const res = await handler(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.echo, "id-abc");
});

test("withRouteLogging returns 500 with sanitized message on error", async () => {
  process.env.NODE_ENV = "test";
  const handler = withRouteLogging("GET /api/test", async () => {
    throw new Error("secret path /etc/x");
  }, "Unable to do thing");

  const req = new Request("http://x/test");
  const res = await handler(req);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(typeof body.error, "string");
  // Sanitized message should NOT leak the raw path
  assert.ok(!body.error.includes("/etc/x"));
});

test("withRouteLogging returns 499 on AbortError", async () => {
  process.env.NODE_ENV = "test";
  const handler = withRouteLogging("POST /api/test", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  });

  const req = new Request("http://x/test", { method: "POST" });
  const res = await handler(req);
  assert.equal(res.status, 499);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "Request cancelled");
});

test("withRouteLogging defaults requestId to 'unknown' if header missing", async () => {
  process.env.NODE_ENV = "test";
  let seenId = null;
  const handler = withRouteLogging("GET /api/x", async (_req, { requestId }) => {
    seenId = requestId;
    return new Response("ok");
  });
  await handler(new Request("http://x/x"));
  assert.equal(seenId, "unknown");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern=withRouteLogging 2>&1 | tail -8
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement helper**

Create `lib/api/with-route-logging.js`:

```js
import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "./sanitize-error.ts";
import { log } from "../log.js";

/**
 * Higher-order Next.js route handler. Extracts the request-id,
 * invokes the inner handler, and normalizes error outcomes:
 *   - AbortError / aborted signal → HTTP 499 "Request cancelled"
 *   - anything else → HTTP 500, log.error with route+requestId+error,
 *     return sanitized message
 *
 * @param {string} routeLabel e.g. "POST /api/projects/current/actions"
 * @param {(request: Request, ctx: { requestId: string }) => Promise<Response>} handler
 * @param {string} [fallbackMessage]
 * @returns {(request: Request) => Promise<Response>}
 */
export function withRouteLogging(routeLabel, handler, fallbackMessage = "Unable to process request") {
  return async function routeHandler(request) {
    const requestId = request.headers.get("x-request-id") ?? "unknown";
    try {
      return await handler(request, { requestId });
    } catch (error) {
      const isAbort = error?.name === "AbortError" || request.signal?.aborted;
      if (isAbort) {
        return NextResponse.json(
          { ok: false, error: "Request cancelled" },
          { status: 499 },
        );
      }
      log.error("route_failed", {
        route: routeLabel,
        requestId,
        error: error?.message ?? String(error),
      });
      return NextResponse.json(
        { ok: false, error: sanitizeErrorMessage(error, fallbackMessage) },
        { status: 500 },
      );
    }
  };
}
```

Note: `sanitize-error` is currently a `.ts` file exporting `sanitizeErrorMessage`. Import with the `.ts` extension from JS is rejected by node:test; use the path without extension (Next resolves via tsconfig paths), or create a `.d.ts` shim so the JS import works. Simplest path: since this file is imported only from Next route handlers and from tests, keep `.js` and import `sanitize-error` with `.js` extension (Next's build handles the TS-to-JS mapping). If tests fail on the import, refactor `sanitize-error.ts` to `.js` + `.d.ts` (Tier 1 / Tier 3 pattern).

**Actual import line (to paste):**

```js
import { sanitizeErrorMessage } from "./sanitize-error.js";
```

Check whether `lib/api/sanitize-error.ts` resolves at runtime to `.js`. If this fails, create `lib/api/sanitize-error.d.ts` and rename source to `.js` (same pattern as `lib/ai/actions.js` + `lib/ai/actions.d.ts`).

- [ ] **Step 4: Create .d.ts**

Create `lib/api/with-route-logging.d.ts`:

```ts
export function withRouteLogging(
  routeLabel: string,
  handler: (request: Request, ctx: { requestId: string }) => Promise<Response>,
  fallbackMessage?: string,
): (request: Request) => Promise<Response>;
```

- [ ] **Step 5: Run test**

```bash
npm test 2>&1 | tail -5
```

Expected: all pass; 4 new tests added.

- [ ] **Step 6: Convert first route — `app/api/projects/current/review/route.ts`**

Smallest route; use as the reference conversion.

```ts
import { NextResponse } from "next/server";
import { withRouteLogging } from "@/lib/api/with-route-logging.js";
import { requireProjectRoot } from "@/lib/projects/discovery.js";
import { readProjectReviewSummary } from "@/lib/projects/review.js";

export const GET = withRouteLogging(
  "GET /api/projects/current/review",
  async () => {
    const projectRoot = await requireProjectRoot();
    const summary = await readProjectReviewSummary(projectRoot);
    return NextResponse.json({ ok: true, data: summary });
  },
  "Unable to load review summary",
);
```

- [ ] **Step 7: Verify first route still works**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 8: Start dev server and smoke the route**

```bash
npm run dev &
sleep 5
curl -s -i http://localhost:3000/api/projects/current/review | head -6
pkill -f "next dev" 2>/dev/null || true
```

Expected: HTTP 200 or 500 (if no project exists); `X-Request-Id` still present.

- [ ] **Step 9: Convert remaining 9 routes**

Apply the same pattern to:
- `app/api/projects/route.ts` (GET + POST)
- `app/api/projects/current/route.ts` (GET + PUT)
- `app/api/projects/current/briefs/route.ts` (GET + PUT)
- `app/api/projects/current/context/route.ts` (GET)
- `app/api/projects/current/documents/route.ts` (GET + POST + PUT)
- `app/api/projects/current/ideation/route.ts` (GET + PUT)
- `app/api/projects/current/export/route.ts` (GET)
- `app/api/projects/current/actions/route.ts` (POST, already has the 499 branch — withRouteLogging handles it)
- `app/api/settings/providers/route.ts` (GET + PUT)
- `app/api/settings/providers/test/route.ts` (GET)

**Important for `actions/route.ts`**: the existing rate-limit check at the top returns 429 before entering the try block. Keep that **outside** `withRouteLogging` — the wrapper only handles the happy path + error path; the 429 early return stays as-is.

**Important for `settings/providers` & `settings/providers/test`**: same thing — rate-limit early return stays outside the wrapper.

For each route, the structure becomes:

```ts
export const GET = withRouteLogging(
  "GET /api/...",
  async (request) => {
    // existing body, throw on error, return NextResponse.json on success
  },
  "Unable to do thing",
);
```

For routes with a rate-limit preamble (settings/providers, settings/providers/test, actions):

```ts
export async function GET(request: Request) {
  // rate limit preamble (unchanged)
  if (!rateCheck.allowed) return /* 429 response */;
  return withRouteLogging("GET /api/...", async (req) => {
    // body
  }, "fallback")(request);
}
```

- [ ] **Step 10: Verify all routes**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -10
```

Expected: 0 errors; all tests pass; build clean.

- [ ] **Step 11: Smoke all routes**

```bash
npm run dev &
sleep 5
for path in / /api/projects/current /api/settings/providers /api/projects/current/ideation /api/projects/current/review; do
  echo "=== $path ==="
  curl -s -o /dev/null -w "HTTP %{http_code} · %{time_total}s\n" "http://localhost:3000$path"
done
pkill -f "next dev" 2>/dev/null || true
```

Expected: all 200 or 404/500 with middleware `X-Request-Id`.

- [ ] **Step 12: Commit**

```bash
git add lib/api/with-route-logging.js lib/api/with-route-logging.d.ts tests/api/with-route-logging.test.mjs app/api/
git commit -m "refactor(api): extract withRouteLogging higher-order handler

Collapses 18 catch blocks in 10 route files into a single HOF that:
- reads x-request-id
- normalizes AbortError → HTTP 499
- runs log.error('route_failed', { route, requestId, error })
- returns sanitized message on HTTP 500

Routes with rate-limit preambles (settings/providers, providers/test,
actions) keep the rate-limit early return outside the wrapper.

4 new unit tests; route behavior unchanged."
```

---

### Task 5: T4.5 · Extract useModalResource hook + migrate 5 consumers

**Files:**
- Create: `lib/api/use-modal-resource.ts`
- Create: `tests/components/use-modal-resource.test.mjs`
- Modify: `components/connection-modal.tsx`
- Modify: `components/ideation-modal.tsx`
- Modify: `components/review-modal.tsx`
- Modify: `components/projects-modal.tsx`
- Modify: `components/project-dropdown.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/use-modal-resource.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { render, cleanup, waitFor } from "../setup/react.mjs";
import React from "react";
import { useModalResource } from "../../lib/api/use-modal-resource.js";

function HookHarness({ url, open, onState }) {
  const state = useModalResource(url, open);
  onState(state);
  return null;
}

test("useModalResource loads data when open flips true", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, data: { x: 1 } }),
  });
  let state;
  render(
    React.createElement(HookHarness, {
      url: "/api/test",
      open: true,
      onState: (s) => { state = s; },
    }),
  );
  await waitFor(() => assert.equal(state.loading, false));
  assert.equal(state.data.x, 1);
  assert.equal(state.error, false);
  globalThis.fetch = originalFetch;
  cleanup();
});

test("useModalResource error=true when response !ok", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: false }),
  });
  let state;
  render(
    React.createElement(HookHarness, {
      url: "/api/test",
      open: true,
      onState: (s) => { state = s; },
    }),
  );
  await waitFor(() => assert.equal(state.loading, false));
  assert.equal(state.error, true);
  assert.equal(state.data, null);
  globalThis.fetch = originalFetch;
  cleanup();
});

test("useModalResource retry fires a second fetch", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ ok: true, data: { n: calls } }) };
  };
  let state;
  render(
    React.createElement(HookHarness, {
      url: "/api/test",
      open: true,
      onState: (s) => { state = s; },
    }),
  );
  await waitFor(() => assert.equal(state.loading, false));
  assert.equal(state.data.n, 1);
  state.retry();
  await waitFor(() => assert.equal(state.data?.n, 2));
  globalThis.fetch = originalFetch;
  cleanup();
});
```

- [ ] **Step 2: Run test**

```bash
npm test -- --test-name-pattern=useModalResource 2>&1 | tail -8
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement hook**

Create `lib/api/use-modal-resource.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ModalResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
};

/**
 * Fetch a JSON resource when `open` flips true; cancel and reset when
 * `open` flips false. Expects `{ ok: boolean, data: T }` shape (the
 * project's standard API envelope). `retry()` re-fetches without
 * needing a parent state change.
 */
export function useModalResource<T>(url: string, open: boolean): ModalResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(false);
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((payload) => {
        if (ctrl.signal.aborted) return;
        if (payload?.ok) setData(payload.data);
        else setError(true);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, [url]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setData(null);
      setError(false);
      setLoading(false);
      return;
    }
    load();
    return () => abortRef.current?.abort();
  }, [open, load]);

  return { data, loading, error, retry: load };
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- --test-name-pattern=useModalResource 2>&1 | tail -10
```

Expected: 3 new tests pass.

- [ ] **Step 5: Migrate `components/connection-modal.tsx`**

Replace the existing loading/error/retry block with the hook:

```tsx
"use client";

import { useRef } from "react";

import { Modal } from "@/components/ui/modal";
import { ConnectionWizard } from "@/components/connection-wizard";
import { useModalResource } from "@/lib/api/use-modal-resource";
import type { ProviderConfigSummary } from "@/types/settings";

type ConnectionModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ConnectionModal({ open, onClose }: ConnectionModalProps) {
  const { data: config, loading, error, retry } = useModalResource<ProviderConfigSummary>(
    "/api/settings/providers",
    open,
  );
  const dirtyRef = useRef(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI 连接"
      eyebrow="设置"
      variant="standard"
      confirmCloseIfDirty={() => dirtyRef.current}
    >
      {loading ? (
        <div className="modal-loading">
          <span className="ai-spinner" />{" "}
          <p className="muted">加载配置中…</p>
        </div>
      ) : error ? (
        <div className="modal-loading">
          <p className="modal-error">无法加载配置。</p>
          <button type="button" className="action-button compact" onClick={retry}>重试</button>
        </div>
      ) : config ? (
        <ConnectionWizard
          initialConfig={config}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
        />
      ) : null}
    </Modal>
  );
}
```

- [ ] **Step 6: Migrate `components/ideation-modal.tsx`**

Same pattern; URL `/api/projects/current/ideation`, type `ProjectIdeation`, passes `onDirtyChange` to `IdeationForm`.

```tsx
"use client";

import { useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { IdeationForm } from "@/components/ideation-form";
import { useModalResource } from "@/lib/api/use-modal-resource";
import type { ProjectIdeation } from "@/types/ideation";

type IdeationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function IdeationModal({ open, onClose }: IdeationModalProps) {
  const { data: ideation, loading, error, retry } = useModalResource<ProjectIdeation>(
    "/api/projects/current/ideation",
    open,
  );
  const dirtyRef = useRef(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="立项"
      eyebrow="作品核心"
      variant="wide"
      confirmCloseIfDirty={() => dirtyRef.current}
    >
      {loading ? (
        <div className="modal-loading">
          <span className="ai-spinner" />{" "}
          <p className="muted">加载中…</p>
        </div>
      ) : error ? (
        <div className="modal-loading">
          <p className="modal-error">无法加载立项数据。</p>
          <button type="button" className="action-button compact" onClick={retry}>重试</button>
        </div>
      ) : ideation ? (
        <IdeationForm
          initialIdeation={ideation}
          onClose={onClose}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
        />
      ) : null}
    </Modal>
  );
}
```

- [ ] **Step 7: Migrate `components/review-modal.tsx`**

Open `components/review-modal.tsx` first, identify the URL + data type, then apply the same pattern. Pattern template (adjust types / URL):

```tsx
const { data, loading, error, retry } = useModalResource<ReviewSummary>(
  "/api/projects/current/review",
  open,
);
```

- [ ] **Step 8: Migrate `components/projects-modal.tsx`**

Same pattern. URL `/api/projects`. Check the component first to see whether it uses `data.workspace` or `data.projects` — preserve whatever the existing code reads.

- [ ] **Step 9: Migrate `components/project-dropdown.tsx`**

Same pattern, but note: dropdown may load its data on hover rather than on `open`. Read the component first. If it uses a different trigger, adapt by making a local `shouldLoad: boolean` state feed into `useModalResource(url, shouldLoad)`.

- [ ] **Step 10: Verify all migrations**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -5
```

Expected: 0 errors; tests pass; build clean.

- [ ] **Step 11: Smoke-test modals in dev**

```bash
npm run dev &
sleep 5
# Use Playwright MCP or manual browser: open each modal; verify loading state visible then content; click retry after dev-pause backend; close modal and reopen.
pkill -f "next dev" 2>/dev/null || true
```

- [ ] **Step 12: Commit**

```bash
git add lib/api/use-modal-resource.ts tests/components/use-modal-resource.test.mjs \
        components/connection-modal.tsx components/ideation-modal.tsx \
        components/review-modal.tsx components/projects-modal.tsx \
        components/project-dropdown.tsx
git commit -m "refactor(modal): useModalResource hook collapses 5 fetch+loading+error patterns

Single hook manages AbortController, loading, error, data, and retry
for modals that fetch a typed JSON envelope. Consumers:
  - connection-modal, ideation-modal, review-modal, projects-modal
  - project-dropdown

dirty-close tracking (connection + ideation) stays in the consumer
because it needs a ref, not hook state. 3 new unit tests; no behavior
change."
```

---

### Task 6: T4.6 · CSS regroup — merge 12 trailing T1/T2 sections into logical buckets

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Take a snapshot baseline**

```bash
md5sum app/globals.css
wc -l app/globals.css
```

Record both numbers so we can verify **line count doesn't change** after the move (pure relocation should be byte-exact except for section headers).

- [ ] **Step 2: Build the move plan**

Target destinations for the 12 trailing sections (from end-of-file to logical neighbors):

| Trailing section (to move) | Destination |
|---|---|
| `Downgrade Notice (T1.5b)` | inside `AI Loading Spinner` section |
| `Auto-save Error Toast (T1.1)` | next to `Auto-save indicator` (merge + rename section to `Auto-save feedback`) |
| `Error Boundary Fallback (T1.8)` | next to `Error Pages` |
| `Button Spinner (T1.10)` | end of `Buttons` |
| `AI Cancel Button (T2.3)` | end of `AI Loading Spinner` (together with Downgrade Notice) |
| `AI Status Line (T2.4)` | end of `Bottom Bar` |
| `Markdown Preview (T2.5)` | new section `Editor Preview` inserted before `Textarea Enhancement` |
| `Chapter Search (T2.6)` | end of `Bottom Bar` |
| `Export Menu (T2.7)` | end of `Toolbar` |
| `Word-count Ring (T2.8)` | end of `Word Count Progress` |
| `Dark Mode Refinements` (pre-existing, line 2032) | end of `Dark Mode` (line ~39) |

- [ ] **Step 3: Move sections one at a time, running dev server after each**

For each of the 12 sections:

1. Cut the block (from its `/* ===== HEADER ===== */` through to the next `/* =====` line, exclusive).
2. Paste into the target section — remove the redundant header, keep only the CSS rules.
3. Save.
4. Verify `npm run build` still succeeds (CSS doesn't break build).
5. Optionally load http://localhost:3000 with dev server running to eyeball visually.

Tip: do this in groups to limit context churn. Recommended groupings:

- **Batch A (4 moves)**: Downgrade Notice + AI Cancel Button → AI Loading Spinner; AI Status Line + Chapter Search → Bottom Bar
- **Batch B (3 moves)**: Auto-save Error Toast → Auto-save indicator; Error Boundary Fallback → Error Pages; Button Spinner → Buttons
- **Batch C (3 moves)**: Markdown Preview (new `Editor Preview` section); Export Menu → Toolbar; Word-count Ring → Word Count Progress
- **Batch D (1 move)**: Dark Mode Refinements → Dark Mode

After each batch:
```bash
npx tsc --noEmit && npm run build 2>&1 | tail -3
```

Expected: build clean.

- [ ] **Step 4: Verify no class name is defined twice**

```bash
grep -n "^\.[a-zA-Z]" app/globals.css | sort -t'{' -k1 | awk '{print $1}' | sort | uniq -d
```

Expected: empty output (no duplicate selectors).

- [ ] **Step 5: Visual regression**

```bash
npm run dev &
sleep 5
```

Use Playwright MCP:
- Open `/`
- Toggle dark mode; verify colors identical to pre-move (take screenshot each side)
- Open Ideation modal; Export menu; Batch Generate modal
- Close dev server

```bash
pkill -f "next dev" 2>/dev/null || true
```

- [ ] **Step 6: Line count sanity check**

```bash
wc -l app/globals.css
```

Expected: ≤ snapshot baseline + 5 lines (just new section headers; section headers being merged mean some net reduction).

- [ ] **Step 7: Commit**

```bash
git add app/globals.css
git commit -m "style(css): regroup 12 trailing T1/T2 sections into logical buckets

No rule text changes; only relocations so that related selectors sit
together. 'Downgrade Notice' / 'AI Cancel Button' move to 'AI Loading
Spinner'; 'AI Status Line' / 'Chapter Search' move to 'Bottom Bar';
'Auto-save Error Toast' merges with 'Auto-save indicator' as a new
'Auto-save feedback' section; 'Error Boundary Fallback' moves to
'Error Pages'; 'Button Spinner' to 'Buttons'; 'Markdown Preview'
becomes a new 'Editor Preview' section before 'Textarea Enhancement';
'Export Menu' to 'Toolbar'; 'Word-count Ring' to 'Word Count
Progress'; 'Dark Mode Refinements' merges with 'Dark Mode'.

Verified: tsc 0 errors; build clean; no duplicate selectors; manual
visual regression in dev."
```

---

### Task 7: Tier 4a final verification + tag

**Files:** none; verification only.

- [ ] **Step 1: Full test run**

```bash
npm test 2>&1 | tail -10
```

Expected: all pass; count ≈ 137 - 14 deleted + ~4 new (withRouteLogging + useModalResource) ≈ 127.

- [ ] **Step 2: TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: compiled successfully; 15 routes + middleware.

- [ ] **Step 4: E2E run (sanity — Tier 1-3 specs untouched by 4a)**

```bash
npm run test:e2e 2>&1 | tail -15
```

Expected: all specs pass or skip cleanly.

- [ ] **Step 5: Smoke test interactively**

```bash
npm run dev &
sleep 5
```

Manual checklist via Playwright MCP or browser:
- Home renders with project
- Toggle dark mode
- Open Ideation modal → see loading → content appears → ESC closes
- Trigger retry by modifying a URL (skip in favor of code review)
- Open Export menu → see two items
- Verify API response carries `X-Request-Id`

Kill:
```bash
pkill -f "next dev" 2>/dev/null || true
```

- [ ] **Step 6: Tag**

```bash
git tag polish-tier-4a -m "Tier 4a: zero-behavior cleanup

6 tasks:
- T4.1 drop prompt-cache
- T4.2 drop repair-link + repair-request
- T4.3 drop @testing-library/user-event devDep
- T4.4 withRouteLogging HOF (10 routes, 18 catch blocks collapsed)
- T4.5 useModalResource hook (5 consumers migrated)
- T4.6 CSS regroup (12 trailing sections merged into logical buckets)

Verification: tests all green; tsc 0 errors; build clean; no
behavior change."
```

- [ ] **Step 7: Do NOT push**

Report completion to the user so they can review before merging to main.

---

## Self-Review

**Spec coverage:**
- T4.1 ✓ Task 1
- T4.2 ✓ Task 2
- T4.3 ✓ Task 3
- T4.4 ✓ Task 4 (all 10 routes in Step 9)
- T4.5 ✓ Task 5 (all 5 consumers in Steps 5-9)
- T4.6 ✓ Task 6 (all 12 moves in Step 3)

**Placeholder scan:** No TBDs. Step 9 of Task 4 includes a concrete target list of all 10 routes rather than "similar routes."

**Type consistency:** `withRouteLogging(routeLabel: string, handler, fallbackMessage?: string) → (Request) => Promise<Response>` is consistent across Task 4 test, implementation, and .d.ts. `useModalResource<T>(url, open) → { data, loading, error, retry }` is consistent across the hook, test, and all 5 consumers.

**Scope check:** 7 tasks × ~20 minutes each = ~2.5 hours focused work. Matches Tier 4a estimate in spec.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-polish-tier-4a-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
