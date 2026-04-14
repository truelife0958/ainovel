# Chapter Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the app into a chapter-cockpit product where `/` lands on `/writing`, writing becomes the primary surface, AI settings open in a modal, and review is triggered from the current chapter.

**Architecture:** Keep the existing Next.js single-project runtime and evolve the current writing page instead of adding a new `/workspace` shell. Add a small chapter-cockpit aggregation layer plus a few focused UI components around `WritingStudio`, then demote dashboard/settings/review/ideation to compatibility or low-frequency entry points.

**Tech Stack:** Next.js 16 app router, React 19 client/server components, Node.js ES modules, filesystem-backed project data, Playwright E2E, Node `--test` unit tests.

---

**Execution note:** `D:\ebak\webnovel-writer-master` is not a Git repository. Replace every normal commit step with a checkpoint note in the task log unless the repo is initialized before execution.

## File map

### Create
- `types/chapter-cockpit.ts` — typed view model for the chapter cockpit page.
- `lib/project/chapter-cockpit.js` — aggregate selected chapter data, related outline excerpt, related setting excerpts, review href, and provider config.
- `lib/project/chapter-cockpit.d.ts` — declarations for the cockpit aggregator.
- `lib/project/review.js` — single-project review summary service migrated from `lib/projects/review.js`.
- `lib/project/review.d.ts` — declarations for the new review service.
- `components/chapter-cockpit-header.tsx` — top status bar with save/model/review/settings actions.
- `components/chapter-support-panel.tsx` — right-side panel for brief summary, context, outline excerpt, and setting excerpts.
- `components/ai-settings-modal.tsx` — modal shell that hosts `ProviderSettingsForm` from the writing page.
- `components/review-action-button.tsx` — focused current-chapter review trigger.
- `tests/project/chapter-cockpit.test.mjs` — unit tests for cockpit aggregation and excerpt fallback.
- `tests/project/review.test.mjs` — unit tests for the migrated review service.

### Modify
- `app/page.tsx` — redirect root to `/writing`.
- `app/dashboard/page.tsx` — replace dashboard with a redirect to `/writing`.
- `app/writing/page.tsx` — load `CurrentChapterWorkspace` and pass modal/review props into the client UI.
- `app/review/page.tsx` — keep `/review` as the result page, but adapt its copy and file-aware entry behavior.
- `app/settings/page.tsx` — keep as compatibility entry with reduced prominence.
- `app/ideation/page.tsx` — lower the copy weight so it reads as low-frequency setup.
- `app/outline/page.tsx` — update copy to emphasize deep editing from writing.
- `app/library/page.tsx` — update copy to emphasize deep editing from writing.
- `components/app-shell.tsx` — simplify nav to writing-first product navigation.
- `components/provider-settings-form.tsx` — support modal embedding and optional `onSaved` callback.
- `components/writing-studio.tsx` — refactor into cockpit layout, wire modal and review button, keep save/AI flows intact.
- `lib/app/navigation.ts` — remove dashboard from primary navigation and demote ideation/settings/review.
- `app/globals.css` — add chapter-cockpit layout and modal styles.
- `tests/e2e/app-smoke.spec.mjs` — update the root redirect and writing-first journey.

### Keep as-is unless a task below changes them
- `app/api/projects/current/documents/route.ts`
- `app/api/projects/current/briefs/route.ts`
- `app/api/projects/current/context/route.ts`
- `app/api/projects/current/actions/route.ts`
- `app/api/settings/providers/route.ts`
- `components/document-workspace.tsx`
- `components/review-summary-panel.tsx`
- `lib/project/context.js`
- `lib/project/summary.js`
- `lib/settings/provider-config.js`

### Task 1: Repoint the app entry and primary navigation

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `lib/app/navigation.ts`
- Modify: `components/app-shell.tsx`
- Test: `tests/e2e/app-smoke.spec.mjs`

- [ ] **Step 1: Write the failing redirect/navigation assertions**

```js
// tests/e2e/app-smoke.spec.mjs

test("redirects the root route to the writing cockpit", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/writing$/);
  await expect(page.getByRole("heading", { name: "章节驾驶舱", exact: true })).toBeVisible();
});
```

```js
// tests/e2e/app-smoke.spec.mjs

test("shows writing-first primary navigation", async ({ page }) => {
  await page.goto("/writing");
  await expect(page.getByRole("link", { name: /写作/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /大纲/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /设定/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /总览/ })).toHaveCount(0);
});
```

- [ ] **Step 2: Run the redirect test and confirm it fails against `/dashboard`**

Run: `npm run test:e2e -- tests/e2e/app-smoke.spec.mjs --grep "redirects the root route to the writing cockpit"`
Expected: FAIL because `/` still redirects to `/dashboard` and the heading is `项目首页`.

- [ ] **Step 3: Switch the entry route and dashboard compatibility page**

```tsx
// app/page.tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/writing");
}
```

```tsx
// app/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/writing");
}
```

- [ ] **Step 4: Replace the primary nav with writing-first links**

```ts
// lib/app/navigation.ts
export type AppNavHref = "/writing" | "/outline" | "/library" | "/ideation";

export type AppNavItem = {
  href: AppNavHref;
  label: string;
  description: string;
  tone?: "primary" | "secondary";
};

export const appNavItems: AppNavItem[] = [
  {
    href: "/writing",
    label: "写作",
    description: "当前章驾驶舱、AI 动作与正文推进",
    tone: "primary",
  },
  {
    href: "/outline",
    label: "大纲",
    description: "从当前章跳入的深度规划页",
    tone: "primary",
  },
  {
    href: "/library",
    label: "设定",
    description: "从当前章跳入的资料整理页",
    tone: "primary",
  },
  {
    href: "/ideation",
    label: "立项",
    description: "低频初始化与项目定位调整",
    tone: "secondary",
  },
];
```

```tsx
// components/app-shell.tsx
<nav className="nav" aria-label="主导航">
  {appNavItems.map((item) => {
    const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={isActive ? `nav-item active ${item.tone ?? "primary"}` : `nav-item ${item.tone ?? "primary"}`}
        aria-current={isActive ? "page" : undefined}
      >
        <span>{item.label}</span>
        <small>{item.description}</small>
      </Link>
    );
  })}
</nav>
```

- [ ] **Step 5: Re-run the redirect/navigation tests**

Run: `npm run test:e2e -- tests/e2e/app-smoke.spec.mjs --grep "redirects the root route to the writing cockpit|shows writing-first primary navigation"`
Expected: PASS for both checks.

- [ ] **Step 6: Checkpoint**

Record: `Checkpoint: root route now lands on /writing, dashboard is a redirect, and the shell nav is writing-first.`

### Task 2: Add a chapter-cockpit aggregation layer

**Files:**
- Create: `types/chapter-cockpit.ts`
- Create: `lib/project/chapter-cockpit.js`
- Create: `lib/project/chapter-cockpit.d.ts`
- Test: `tests/project/chapter-cockpit.test.mjs`
- Modify: `lib/project/context.js`
- Modify: `types/context.ts`

- [ ] **Step 1: Write a failing unit test for the cockpit view model**

```js
// tests/project/chapter-cockpit.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCurrentChapterWorkspace } from "../../lib/project/chapter-cockpit.js";

const createdDirs = [];

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("buildCurrentChapterWorkspace returns chapter data plus outline and setting excerpts", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "chapter-cockpit-"));
  createdDirs.push(workspaceRoot);
  const projectRoot = join(workspaceRoot, "webnovel-project");
  await mkdir(join(projectRoot, ".webnovel", "briefs"), { recursive: true });
  await mkdir(join(projectRoot, ".webnovel", "summaries"), { recursive: true });
  await mkdir(join(projectRoot, "正文"), { recursive: true });
  await mkdir(join(projectRoot, "大纲"), { recursive: true });
  await mkdir(join(projectRoot, "设定集"), { recursive: true });
  await writeFile(join(projectRoot, ".webnovel", "state.json"), JSON.stringify({
    project_info: { title: "雾站账本", genre: "都市异能" },
    progress: { current_chapter: 2, current_volume: 1, total_words: 12345 },
  }), "utf8");
  await writeFile(join(projectRoot, "正文", "第0002章.md"), "# 第0002章\n\n正文", "utf8");
  await writeFile(join(projectRoot, ".webnovel", "briefs", "ch0002.md"), `### 第 2 章：雾站试探\n- 关键实体: 灰雾账本 / 雾站`, "utf8");
  await writeFile(join(projectRoot, "大纲", "第一卷卷纲.md"), "### 第 2 章：雾站试探\n林岚第一次主动使用账本。", "utf8");
  await writeFile(join(projectRoot, "设定集", "灰雾账本.md"), "# 灰雾账本\n\n账本会记录规则代价。", "utf8");

  const workspace = await buildCurrentChapterWorkspace({ workspaceRoot, requestedFileName: "第0002章.md" });

  assert.equal(workspace.currentDocument?.fileName, "第0002章.md");
  assert.match(workspace.outlineExcerpt?.excerpt || "", /雾站试探/);
  assert.equal(workspace.settingExcerpts[0]?.title, "灰雾账本");
  assert.equal(workspace.reviewHref, "/review?file=%E7%AC%AC0002%E7%AB%A0.md");
});
```

- [ ] **Step 2: Run the new unit test and confirm the module is missing**

Run: `npm test -- tests/project/chapter-cockpit.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/project/chapter-cockpit.js`.

- [ ] **Step 3: Define the cockpit types and aggregator skeleton**

```ts
// types/chapter-cockpit.ts
import type { ChapterBrief } from "@/types/briefs";
import type { ChapterContext } from "@/types/context";
import type { ProjectDocument, ProjectDocumentMeta } from "@/types/documents";
import type { ProjectSummary } from "@/types/project";
import type { ProviderConfigSummary, ProviderRuntimeStatus } from "@/types/settings";

export type RelatedDocumentExcerpt = {
  kind: "outline" | "setting";
  fileName: string;
  title: string;
  excerpt: string;
  href: string;
};

export type CurrentChapterWorkspace = {
  project: ProjectSummary;
  documents: ProjectDocumentMeta[];
  currentDocument: ProjectDocument | null;
  currentBrief: ChapterBrief | null;
  currentContext: ChapterContext | null;
  outlineExcerpt: RelatedDocumentExcerpt | null;
  settingExcerpts: RelatedDocumentExcerpt[];
  providerConfig: ProviderConfigSummary;
  assistantStatus: ProviderRuntimeStatus;
  reviewHref: string | null;
};
```

```js
// lib/project/chapter-cockpit.js
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseChapterBriefContent } from "./brief-format.js";
import { readChapterBrief } from "./briefs.js";
import { buildChapterContext, readOutlineExcerpt, readTextOrEmpty } from "./context.js";
import { listProjectDocuments, readProjectDocument } from "./documents.js";
import { requireProjectRoot } from "./root.js";
import { readProjectSummary } from "./summary.js";
import { createProviderRuntimeStatus, readProviderConfigSummary } from "../settings/provider-config.js";

function buildReviewHref(fileName) {
  return fileName ? `/review?file=${encodeURIComponent(fileName)}` : null;
}

function clipText(value, limit = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 3).trimEnd()}...`;
}

async function readSettingExcerpts(projectRoot, keyEntities) {
  const results = [];
  for (const entity of keyEntities.slice(0, 3)) {
    const fileName = `${entity}.md`;
    const absolutePath = join(resolve(projectRoot), "设定集", fileName);
    const content = await readTextOrEmpty(absolutePath);
    if (!content) continue;
    results.push({
      kind: "setting",
      fileName,
      title: entity,
      excerpt: clipText(content),
      href: `/library?file=${encodeURIComponent(fileName)}`,
    });
  }
  return results;
}

export async function buildCurrentChapterWorkspace({ workspaceRoot = process.cwd(), requestedFileName = "" } = {}) {
  const projectRoot = await requireProjectRoot(workspaceRoot);
  const [project, providerConfig, documents] = await Promise.all([
    readProjectSummary(projectRoot),
    readProviderConfigSummary(),
    listProjectDocuments(projectRoot, "chapter"),
  ]);
  const selected = documents.find((item) => item.fileName === requestedFileName) || documents[0] || null;
  if (!selected) {
    return {
      project,
      documents,
      currentDocument: null,
      currentBrief: null,
      currentContext: null,
      outlineExcerpt: null,
      settingExcerpts: [],
      providerConfig,
      assistantStatus: createProviderRuntimeStatus(providerConfig, "writing"),
      reviewHref: null,
    };
  }
  const [currentDocument, currentBrief, currentContext, outlineText] = await Promise.all([
    readProjectDocument(projectRoot, "chapter", selected.fileName),
    readChapterBrief(projectRoot, selected.fileName),
    buildChapterContext(projectRoot, selected.fileName),
    readOutlineExcerpt(projectRoot, Number(selected.fileName.match(/(\d{1,5})/)?.[1] || 0)),
  ]);
  const parsedBrief = parseChapterBriefContent(currentBrief?.content || "");
  return {
    project,
    documents,
    currentDocument,
    currentBrief,
    currentContext,
    outlineExcerpt: outlineText
      ? {
          kind: "outline",
          fileName: "",
          title: "相关大纲",
          excerpt: clipText(outlineText, 320),
          href: "/outline",
        }
      : null,
    settingExcerpts: await readSettingExcerpts(projectRoot, parsedBrief.keyEntities || []),
    providerConfig,
    assistantStatus: createProviderRuntimeStatus(providerConfig, "writing"),
    reviewHref: buildReviewHref(selected.fileName),
  };
}
```

- [ ] **Step 4: Extend context typing so the support panel can surface data safely**

```ts
// types/context.ts
export type ChapterContext = {
  chapterNumber: number;
  outline: string;
  previousSummaries: string[];
  stateSummary: string;
  guidanceItems: string[];
  error: string;
};
```

```js
// lib/project/context.js
export async function readTextOrEmpty(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

export async function readOutlineExcerpt(projectRoot, chapterNumber) {
  // keep existing implementation exportable so chapter-cockpit.js can reuse it
}
```

- [ ] **Step 5: Re-run the cockpit unit test**

Run: `npm test -- tests/project/chapter-cockpit.test.mjs`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

Record: `Checkpoint: CurrentChapterWorkspace aggregates the selected chapter, provider status, review href, outline excerpt, and setting excerpts.`

### Task 3: Migrate review data to the single-project layer and wire a current-chapter review button

**Files:**
- Create: `lib/project/review.js`
- Create: `lib/project/review.d.ts`
- Create: `components/review-action-button.tsx`
- Modify: `app/review/page.tsx`
- Test: `tests/project/review.test.mjs`
- Modify: `tests/e2e/app-smoke.spec.mjs`

- [ ] **Step 1: Add a failing unit test for the migrated review service**

```js
// tests/project/review.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProjectReviewSummary } from "../../lib/project/review.js";

const createdDirs = [];

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("readProjectReviewSummary returns latest chapter repair info", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "review-project-"));
  createdDirs.push(projectRoot);
  await mkdir(join(projectRoot, ".webnovel", "observability"), { recursive: true });
  await writeFile(join(projectRoot, ".webnovel", "state.json"), JSON.stringify({
    chapter_meta: {
      "0002": {
        hook: "第二个名字出现",
        hook_type: "悬念钩",
        strand: "Quest",
        coolpoint_patterns: ["认知反杀"],
        end_question: "第二个名字为何提前出现",
        antagonist_tier: "小Boss",
        pov: "林岚",
        key_entities: ["灰雾账本"],
        change: "确认旧案与账本直连",
      },
    },
  }), "utf8");
  await writeFile(join(projectRoot, ".webnovel", "workflow_state.json"), JSON.stringify({ history: [] }), "utf8");

  const summary = await readProjectReviewSummary(projectRoot);

  assert.equal(summary.latestChapterMeta?.chapter, 2);
  assert.equal(summary.latestChapterRepair.primaryAction?.label, "补目标冲突代价");
});
```

- [ ] **Step 2: Run the new review test and confirm the new module is missing**

Run: `npm test -- tests/project/review.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/project/review.js`.

- [ ] **Step 3: Migrate the review service and create a dedicated button component**

```js
// lib/project/review.js
export { readProjectReviewSummary } from "../projects/review.js";
```

```ts
// lib/project/review.d.ts
export { readProjectReviewSummary } from "@/lib/projects/review";
```

```tsx
// components/review-action-button.tsx
"use client";

import Link from "next/link";

export function ReviewActionButton({ href, disabled }: { href: string | null; disabled?: boolean }) {
  if (!href || disabled) {
    return (
      <button type="button" className="action-button secondary" disabled>
        审查当前章
      </button>
    );
  }

  return (
    <Link href={href} className="action-button secondary">
      审查当前章
    </Link>
  );
}
```

- [ ] **Step 4: Convert `/review` into a result page that understands `file` context**

```tsx
// app/review/page.tsx
import { AppShell } from "@/components/app-shell";
import { ReviewSummaryPanel } from "@/components/review-summary-panel";
import { readProjectReviewSummary } from "@/lib/project/review";
import { readProjectSummary } from "@/lib/project/summary";

type ReviewPageProps = {
  searchParams?: Promise<{ file?: string | string[] }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const fileName = firstValue(params?.file);
  const [project, summary] = await Promise.all([readProjectSummary(), readProjectReviewSummary(process.cwd())]);

  return (
    <AppShell
      currentPath="/review"
      project={project}
      title="当前章审查结果"
      description={fileName ? `已从写作页带入 ${fileName} 的审查上下文。` : "查看最近的章节审查结果与修补建议。"}
    >
      <section className="workspace-panel">
        <ReviewSummaryPanel summary={summary} />
      </section>
    </AppShell>
  );
}
```

- [ ] **Step 5: Update the review-page E2E assertion**

```js
// tests/e2e/app-smoke.spec.mjs
await page.goto("/review?file=%E7%AC%AC0002%E7%AB%A0.md");
await expect(page.getByRole("heading", { name: "当前章审查结果", exact: true })).toBeVisible();
await expect(page.getByText("第0002章.md")).toBeVisible();
```

Run: `npm test -- tests/project/review.test.mjs`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

Record: `Checkpoint: review data now lives behind lib/project/review.js and /review behaves like a chapter result page.`

### Task 4: Add an AI settings modal around the existing provider form

**Files:**
- Create: `components/ai-settings-modal.tsx`
- Modify: `components/provider-settings-form.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/app-smoke.spec.mjs`

- [ ] **Step 1: Add a failing E2E check for the writing-page settings modal**

```js
// tests/e2e/app-smoke.spec.mjs
await page.goto("/writing");
await page.getByRole("button", { name: "AI 设置" }).click();
await expect(page.getByRole("dialog", { name: "AI 设置" })).toBeVisible();
await expect(page.getByRole("button", { name: "保存设置" })).toBeVisible();
```

- [ ] **Step 2: Run the modal assertion and confirm the button does not exist yet**

Run: `npm run test:e2e -- tests/e2e/app-smoke.spec.mjs --grep "AI 设置"`
Expected: FAIL because `/writing` has no modal trigger.

- [ ] **Step 3: Let the provider form report successful saves back to its parent**

```tsx
// components/provider-settings-form.tsx
type ProviderSettingsFormProps = {
  initialConfig: ProviderConfigSummary;
  onSaved?: (nextConfig: ProviderConfigSummary) => void;
  submitLabel?: string;
};

export function ProviderSettingsForm({ initialConfig, onSaved, submitLabel = "保存设置" }: ProviderSettingsFormProps) {
  // existing state...
  if (!response.ok || !payload.ok) {
    setMessage(payload.error || "保存失败");
    return;
  }

  setConfig(payload.data);
  setSecrets({ ...emptySecrets });
  setClearFlags({ ...emptyClearFlags });
  setMessage("模型设置已保存");
  onSaved?.(payload.data);

  <button type="submit" className="action-button" disabled={isPending}>
    {isPending ? "保存中..." : submitLabel}
  </button>
}
```

- [ ] **Step 4: Add the modal wrapper and compatibility copy on `/settings`**

```tsx
// components/ai-settings-modal.tsx
"use client";

import { useState } from "react";
import type { ProviderConfigSummary } from "@/types/settings";
import { ProviderSettingsForm } from "@/components/provider-settings-form";

export function AiSettingsModal({ initialConfig, onSaved }: {
  initialConfig: ProviderConfigSummary;
  onSaved?: (nextConfig: ProviderConfigSummary) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="action-button secondary" onClick={() => setOpen(true)}>
        AI 设置
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="AI 设置" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">模型提供商</p>
                <strong>AI 设置</strong>
              </div>
              <button type="button" className="action-button secondary" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>
            <ProviderSettingsForm
              initialConfig={initialConfig}
              onSaved={(nextConfig) => {
                onSaved?.(nextConfig);
                setOpen(false);
              }}
              submitLabel="保存并关闭"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
```

```tsx
// app/settings/page.tsx
<WorkspaceIntro
  compact
  eyebrow="兼容入口"
  title="设置页保留用于兼容访问"
  description="主流程里的 AI 设置现在从写作页弹窗打开，这里仅保留完整表单入口。"
/>
```

- [ ] **Step 5: Add modal styles and re-run the E2E assertion**

```css
/* app/globals.css */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(30, 26, 21, 0.48);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 50;
}

.modal-card {
  width: min(1100px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  padding: 24px;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}
```

Run: `npm run test:e2e -- tests/e2e/app-smoke.spec.mjs --grep "AI 设置"`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

Record: `Checkpoint: ProviderSettingsForm works both as a compatibility page and as a writing-page modal.`

### Task 5: Refactor the writing page into the chapter cockpit

**Files:**
- Modify: `app/writing/page.tsx`
- Modify: `components/writing-studio.tsx`
- Create: `components/chapter-cockpit-header.tsx`
- Create: `components/chapter-support-panel.tsx`
- Modify: `app/globals.css`
- Test: `tests/project/chapter-cockpit.test.mjs`
- Test: `tests/e2e/app-smoke.spec.mjs`

- [ ] **Step 1: Add a failing E2E assertion for the chapter cockpit layout**

```js
// tests/e2e/app-smoke.spec.mjs
await page.goto("/writing");
await expect(page.getByText("章节驾驶舱")).toBeVisible();
await expect(page.getByRole("button", { name: "审查当前章" })).toBeVisible();
await expect(page.getByText("相关设定")).toBeVisible();
await expect(page.getByText("相关大纲")).toBeVisible();
```

- [ ] **Step 2: Run the new cockpit assertion and confirm the new UI is absent**

Run: `npm run test:e2e -- tests/e2e/app-smoke.spec.mjs --grep "章节驾驶舱"`
Expected: FAIL because the page still renders `章节写作台` and has no support panel header.

- [ ] **Step 3: Load the cockpit view model in the server page**

```tsx
// app/writing/page.tsx
import { AppShell } from "@/components/app-shell";
import { WritingStudio } from "@/components/writing-studio";
import { buildCurrentChapterWorkspace } from "@/lib/project/chapter-cockpit";

type WritingPageProps = {
  searchParams?: Promise<{
    file?: string | string[];
    assistantRequest?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function WritingPage({ searchParams }: WritingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const workspace = await buildCurrentChapterWorkspace({ requestedFileName: firstValue(params?.file) });

  return (
    <AppShell
      currentPath="/writing"
      project={workspace.project}
      title="章节驾驶舱"
      description="直接围绕当前章推进正文、任务书、上下文、审查和 AI 设置。"
    >
      <WritingStudio
        project={workspace.project}
        assistantStatus={workspace.assistantStatus}
        initialProviderConfig={workspace.providerConfig}
        initialDocuments={workspace.documents}
        initialDocument={workspace.currentDocument}
        initialBrief={workspace.currentBrief}
        initialContext={workspace.currentContext}
        initialOutlineExcerpt={workspace.outlineExcerpt}
        initialSettingExcerpts={workspace.settingExcerpts}
        initialReviewHref={workspace.reviewHref}
        initialAssistantRequest={firstValue(params?.assistantRequest)}
      />
    </AppShell>
  );
}
```

- [ ] **Step 4: Introduce cockpit header/support components and wire them into `WritingStudio`**

```tsx
// components/chapter-cockpit-header.tsx
import type { ProviderRuntimeStatus } from "@/types/settings";
import { AiSettingsModal } from "@/components/ai-settings-modal";
import { ReviewActionButton } from "@/components/review-action-button";

export function ChapterCockpitHeader({
  title,
  dirty,
  assistantStatus,
  providerConfig,
  reviewHref,
  onProviderSaved,
}: {
  title: string;
  dirty: boolean;
  assistantStatus: ProviderRuntimeStatus;
  providerConfig: ProviderConfigSummary;
  reviewHref: string | null;
  onProviderSaved?: (nextConfig: ProviderConfigSummary) => void;
}) {
  return (
    <section className="cockpit-header list-card">
      <div>
        <p className="eyebrow">当前章状态</p>
        <strong>{title || "未选择章节"}</strong>
        <p className="muted">{dirty ? "有未保存修改" : assistantStatus.message}</p>
      </div>
      <div className="cockpit-header-actions">
        <ReviewActionButton href={reviewHref} disabled={!title} />
        <AiSettingsModal initialConfig={providerConfig} onSaved={onProviderSaved} />
      </div>
    </section>
  );
}
```

```tsx
// components/chapter-support-panel.tsx
import type { ChapterContext } from "@/types/context";
import type { RelatedDocumentExcerpt } from "@/types/chapter-cockpit";

export function ChapterSupportPanel({
  briefPreviewItems,
  context,
  outlineExcerpt,
  settingExcerpts,
}: {
  briefPreviewItems: Array<{ label: string; value: string }>;
  context: ChapterContext | null;
  outlineExcerpt: RelatedDocumentExcerpt | null;
  settingExcerpts: RelatedDocumentExcerpt[];
}) {
  return (
    <aside className="chapter-support-panel">
      <section className="list-card inner-card">
        <p className="eyebrow">任务书速览</p>
        <ul>{briefPreviewItems.map((item) => <li key={item.label}>{item.label}：{item.value || "未填写"}</li>)}</ul>
      </section>
      <section className="list-card inner-card">
        <p className="eyebrow">章节上下文</p>
        <p className="muted context-pre">{context?.stateSummary || "暂无状态摘要"}</p>
        <ul>{(context?.guidanceItems || ["暂无执行建议"]).map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="list-card inner-card">
        <p className="eyebrow">相关大纲</p>
        <p className="muted context-pre">{outlineExcerpt?.excerpt || "暂无相关大纲摘录"}</p>
      </section>
      <section className="list-card inner-card">
        <p className="eyebrow">相关设定</p>
        {settingExcerpts.length ? (
          <ul>{settingExcerpts.map((item) => <li key={item.fileName}>{item.title}：{item.excerpt}</li>)}</ul>
        ) : (
          <p className="muted">暂无相关设定摘录</p>
        )}
      </section>
    </aside>
  );
}
```

```tsx
// components/writing-studio.tsx
// add props: initialProviderConfig, initialOutlineExcerpt, initialSettingExcerpts, initialReviewHref
// render order:
// <ChapterCockpitHeader ... />
// <div className="writing-grid cockpit-grid">
//   <aside className="document-sidebar">...</aside>
//   <div className="writing-stack">AI actions + brief editor + chapter editor</div>
//   <ChapterSupportPanel ... />
// </div>
```

- [ ] **Step 5: Add cockpit layout CSS and rerun the E2E check**

```css
/* app/globals.css */
.cockpit-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.cockpit-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
}

.cockpit-grid {
  grid-template-columns: 260px minmax(0, 1fr) 320px;
  align-items: start;
}

.chapter-support-panel {
  display: grid;
  gap: 16px;
}

@media (max-width: 1180px) {
  .cockpit-grid {
    grid-template-columns: 1fr;
  }

  .chapter-support-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .cockpit-header,
  .cockpit-header-actions,
  .chapter-support-panel {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
```

Run: `npm run test:e2e -- tests/e2e/app-smoke.spec.mjs --grep "章节驾驶舱"`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

Record: `Checkpoint: /writing now renders the chapter cockpit header, current-chapter support panel, review action, and AI settings modal trigger.`

### Task 6: Demote outline/library/ideation/settings copy and finish the writing-first regression pass

**Files:**
- Modify: `app/outline/page.tsx`
- Modify: `app/library/page.tsx`
- Modify: `app/ideation/page.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `tests/e2e/app-smoke.spec.mjs`
- Test: `tests/settings/provider-config.test.mjs`

- [ ] **Step 1: Update the page-level copy to match the new product hierarchy**

```tsx
// app/outline/page.tsx
<AppShell
  currentPath="/outline"
  project={project}
  title="大纲深度编辑"
  description="从写作页跳入的结构编辑页，适合系统调整总纲、卷纲和节拍。"
>
```

```tsx
// app/library/page.tsx
<AppShell
  currentPath="/library"
  project={project}
  title="设定深度编辑"
  description="从写作页跳入的资料整理页，适合系统维护角色、世界观和规则。"
>
```

```tsx
// app/ideation/page.tsx
<AppShell
  currentPath="/ideation"
  project={project}
  title="立项资料"
  description="低频使用的项目定位入口，主要用于初始化和重新校准作品承诺。"
>
```

```tsx
// app/settings/page.tsx
<AppShell
  currentPath="/settings"
  project={project}
  title="AI 设置兼容入口"
  description="主流程里的 AI 设置已移到写作页弹窗，这里保留完整表单入口。"
>
```

- [ ] **Step 2: Update the smoke journey to follow the new writing-first flow**

```js
// tests/e2e/app-smoke.spec.mjs
await page.goto("/");
await expect(page).toHaveURL(/\/writing$/);
await expect(page.getByRole("heading", { name: "章节驾驶舱", exact: true })).toBeVisible();

await page.getByRole("button", { name: "AI 设置" }).click();
await page.getByRole("dialog", { name: "AI 设置" }).getByLabel("成本模式").selectOption({ label: "省钱" });
await page.getByRole("dialog", { name: "AI 设置" }).getByRole("button", { name: "保存并关闭" }).click();

await page.getByRole("button", { name: "审查当前章" }).click();
await expect(page).toHaveURL(/\/review\?file=/);

await page.goto("/outline");
await expect(page.getByRole("heading", { name: "大纲深度编辑", exact: true })).toBeVisible();

await page.goto("/library");
await expect(page.getByRole("heading", { name: "设定深度编辑", exact: true })).toBeVisible();
```

- [ ] **Step 3: Run the fast unit regression for provider config persistence**

Run: `npm test -- tests/settings/provider-config.test.mjs`
Expected: PASS.

- [ ] **Step 4: Run the updated smoke test**

Run: `npm run test:e2e -- tests/e2e/app-smoke.spec.mjs`
Expected: PASS.

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Run the production build**

Run: `npm run build`
Expected: PASS with Next.js production build output and no route compilation errors.

- [ ] **Step 7: Checkpoint**

Record: `Checkpoint: writing-first copy is applied across the app, smoke flow passes, unit tests pass, and the build succeeds.`

## Self-review

### Spec coverage
- `/` → `/writing`: Task 1.
- Writing as the primary product surface: Tasks 1 and 5.
- AI settings modal from writing: Task 4.
- Review as a button from writing with `/review` retained: Tasks 3 and 5.
- Outline/library as deep-edit pages: Task 6.
- Ideation as low-frequency: Tasks 1 and 6.
- No `/workspace` shell: all tasks evolve existing `AppShell` and `WritingStudio`; no task introduces `/workspace`.

### Placeholder scan
- No `TODO`, `TBD`, or “similar to previous task” text remains.
- Each task names exact files and runnable commands.
- Each code-edit step includes concrete code blocks.

### Type consistency
- `CurrentChapterWorkspace`, `RelatedDocumentExcerpt`, `AiSettingsModal`, and `ReviewActionButton` are introduced once and reused consistently.
- `ProviderSettingsForm`’s new callback shape is reused by `AiSettingsModal` and `WritingStudio`.
- Review navigation always uses `/review?file=...`.
