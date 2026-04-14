# Single-Project Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the app into a single-project runtime centered on `webnovel-project/` while preserving `npm run dev`, `npm run build`, and real AI-backed outline and chapter generation.

**Architecture:** Create a new `lib/project/*` service layer for the fixed project root, rename the runtime API surface to `/api/project/*`, rewire pages and client components to single-project data flow, replace Python context extraction with JavaScript context aggregation, then delete dashboard/review and non-runtime assets.

**Tech Stack:** Next.js 16, React 19, Node.js ES modules, TypeScript type-checking with JS source plus `.d.ts`, filesystem-backed markdown and JSON storage, OpenAI/Anthropic/OpenRouter provider integrations.

---

**Execution note:** `D:\ebak\webnovel-writer-master` is not a Git repository. `git rev-parse --show-toplevel` fails here, so every normal commit step becomes a checkpoint note unless the repository is initialized before execution.

### Task 1: Establish the fixed single-project root and runtime summary

**Files:**
- Create: `lib/project/root.js`
- Create: `lib/project/root.d.ts`
- Create: `lib/project/summary.js`
- Create: `lib/project/summary.d.ts`
- Modify: `types/project.ts`
- Modify: `lib/app/navigation.ts`
- Modify: `components/app-shell.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Verify the new root module does not exist yet**

Run: `node --input-type=module -e "import('./lib/project/root.js')"`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 2: Create the fixed root resolver**

```js
// lib/project/root.js
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";

export const FIXED_PROJECT_DIR = "webnovel-project";

export function resolveProjectRoot(workspaceRoot = process.cwd()) {
  return resolve(workspaceRoot, FIXED_PROJECT_DIR);
}

export async function requireProjectRoot(workspaceRoot = process.cwd()) {
  const root = resolveProjectRoot(workspaceRoot);
  try {
    await access(join(root, ".webnovel", "state.json"));
    return root;
  } catch {
    throw new Error(`Expected single project at ${FIXED_PROJECT_DIR}\\.webnovel\\state.json`);
  }
}
```

```ts
// lib/project/root.d.ts
export const FIXED_PROJECT_DIR: string;
export function resolveProjectRoot(workspaceRoot?: string): string;
export function requireProjectRoot(workspaceRoot?: string): Promise<string>;
```

- [ ] **Step 3: Create the summary reader and shrink the summary type**

```js
// lib/project/summary.js
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { requireProjectRoot } from "./root.js";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function countMarkdownFiles(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    const counts = await Promise.all(entries.map(async (entry) => {
      const absolute = join(path, entry.name);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        return 1;
      }
      if (entry.isDirectory()) {
        return countMarkdownFiles(absolute);
      }
      return 0;
    }));
    return counts.reduce((sum, count) => sum + count, 0);
  } catch {
    return 0;
  }
}

export async function readProjectSummary(workspaceRoot = process.cwd()) {
  const root = await requireProjectRoot(workspaceRoot);
  const raw = JSON.parse(await readFile(join(root, ".webnovel", "state.json"), "utf8"));
  const projectInfo = asObject(raw.project_info);
  const progress = asObject(raw.progress);
  return {
    title: String(projectInfo.title || "Webnovel Project"),
    genre: String(projectInfo.genre || "未设定"),
    currentChapter: Number(progress.current_chapter || 0),
    currentVolume: Number(progress.current_volume || 1),
    totalWords: Number(progress.total_words || 0),
    targetWords: Number(projectInfo.target_words || 0),
    targetChapters: Number(projectInfo.target_chapters || 0),
    settingFilesCount: await countMarkdownFiles(join(root, "设定集")),
    outlineFilesCount: await countMarkdownFiles(join(root, "大纲")),
    chaptersCount: await countMarkdownFiles(join(root, "正文")),
  };
}
```

```ts
// types/project.ts
export type ProjectSummary = {
  title: string;
  genre: string;
  currentChapter: number;
  currentVolume: number;
  totalWords: number;
  targetWords: number;
  targetChapters: number;
  settingFilesCount: number;
  outlineFilesCount: number;
  chaptersCount: number;
};
```

- [ ] **Step 4: Rewire entry and navigation to the fixed runtime**

```ts
// lib/app/navigation.ts
export const appNavItems = [
  { href: "/ideation", label: "立项", description: "题材、卖点和项目定位" },
  { href: "/library", label: "设定", description: "世界观、角色卡和资料文档" },
  { href: "/outline", label: "大纲", description: "总纲、卷纲和规划文档" },
  { href: "/writing", label: "写作", description: "章节任务书、正文和上下文" },
  { href: "/settings", label: "设置", description: "API Key 和模型路由" },
];
```

```tsx
// app/page.tsx
import { redirect } from "next/navigation";
export default function HomePage() {
  redirect("/writing");
}
```

```tsx
// components/app-shell.tsx
import Link from "next/link";
import { ReactNode } from "react";
import { appNavItems } from "@/lib/app/navigation";
import type { ProjectSummary } from "@/types/project";

function projectSubtitle(project: ProjectSummary | null) {
  if (!project) return "固定单项目运行模式";
  return `${project.genre || "未设定"} / 第 ${project.currentChapter} 章`;
}

export function AppShell({ currentPath, project, title, description, children }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="eyebrow">Webnovel Writer</p>
          <h1>创作台</h1>
          <p className="muted">单项目运行模式</p>
        </div>
        <nav className="nav">
          {appNavItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <Link key={item.href} href={item.href} className={isActive ? "nav-item active" : "nav-item"}>
                <span>{item.label}</span>
                <small>{item.description}</small>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="content">
        <header className="page-header">
          <div>
            <p className="eyebrow">当前工作区</p>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
          </div>
          <div className="project-pill">
            <strong>{project?.title ?? "Webnovel Project"}</strong>
            <span>{projectSubtitle(project)}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Verify the summary path resolves the bundled project**

Run: `node --input-type=module -e "const { readProjectSummary } = await import('./lib/project/summary.js'); const summary = await readProjectSummary(); console.log(Boolean(summary.title), summary.chaptersCount >= 0)"`
Expected: `true true`.

- [ ] **Step 6: Checkpoint**

Record Task 1 complete.

### Task 2: Move document, ideation, brief, and sync services under `lib/project`

**Files:**
- Create: `lib/project/documents.js`
- Create: `lib/project/documents.d.ts`
- Create: `lib/project/ideation.js`
- Create: `lib/project/ideation.d.ts`
- Create: `lib/project/briefs.js`
- Create: `lib/project/briefs.d.ts`
- Create: `lib/project/sync.js`
- Create: `lib/project/sync.d.ts`

- [ ] **Step 1: Verify the new content service modules are absent**

Run: `node --input-type=module -e "import('./lib/project/documents.js')"`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 2: Create the single-project document reader/writer**

```js
// lib/project/documents.js
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

const kindDirectoryMap = { setting: "设定集", outline: "大纲", chapter: "正文" };

function getDirectoryForKind(kind) {
  const directory = kindDirectoryMap[kind];
  if (!directory) throw new Error("Unsupported document kind");
  return directory;
}

function toTitle(fileName) {
  return basename(fileName, extname(fileName));
}

function previewFromContent(content) {
  return String(content || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function ensureSafeFileName(fileName) {
  const normalized = String(fileName || "").trim().replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length || segments.includes("..") || !normalized.toLowerCase().endsWith(".md")) {
    throw new Error("Invalid document path");
  }
  return segments.join("/");
}

function normalizeFileName(kind, value) {
  const stem = String(value || "").trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "");
  if (!stem) throw new Error("Document title is required");
  const finalStem = kind === "chapter"
    ? stem.replace(/^(第)?\s*(\d+)\s*章$/u, (_, __, num) => `第${String(Number(num)).padStart(4, "0")}章`)
    : stem;
  return finalStem.toLowerCase().endsWith(".md") ? finalStem : `${finalStem}.md`;
}

async function listMarkdownFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(entries.map(async (entry) => {
    const nextRelative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(absolute, nextRelative);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) return [nextRelative];
    return [];
  }));
  return results.flat();
}

async function readDocumentMeta(projectRoot, kind, fileName) {
  const directory = getDirectoryForKind(kind);
  const absolutePath = join(projectRoot, directory, fileName);
  const [content, fileStat] = await Promise.all([readFile(absolutePath, "utf8"), stat(absolutePath)]);
  return {
    kind,
    directory,
    fileName,
    title: toTitle(fileName),
    relativePath: relative(projectRoot, absolutePath),
    updatedAt: fileStat.mtime.toISOString(),
    preview: previewFromContent(content),
    content,
  };
}

export async function listProjectDocuments(projectRoot, kind) {
  const root = resolve(projectRoot);
  const directory = getDirectoryForKind(kind);
  try {
    const entries = await listMarkdownFiles(join(root, directory));
    const documents = await Promise.all(entries.map(async (entry) => {
      const { content, ...meta } = await readDocumentMeta(root, kind, entry);
      return meta;
    }));
    return documents.sort((left, right) => left.fileName.localeCompare(right.fileName, "zh-Hans-CN", { numeric: true }));
  } catch {
    return [];
  }
}

export async function readProjectDocument(projectRoot, kind, fileName) {
  return readDocumentMeta(resolve(projectRoot), kind, ensureSafeFileName(fileName));
}

export async function updateProjectDocument(projectRoot, kind, fileName, content) {
  const root = resolve(projectRoot);
  const directory = getDirectoryForKind(kind);
  const safeFileName = ensureSafeFileName(fileName);
  await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, directory, safeFileName), typeof content === "string" ? content : "", "utf8");
  return readDocumentMeta(root, kind, safeFileName);
}

export async function createProjectDocument(projectRoot, kind, input = {}) {
  const fileName = normalizeFileName(kind, input.fileName || input.title);
  const content = typeof input.content === "string" && input.content.trim() ? input.content : `# ${toTitle(fileName)}\n\n`;
  return updateProjectDocument(projectRoot, kind, fileName, content);
}
```

- [ ] **Step 3: Create ideation, brief, and sync services under the new namespace**

```js
// lib/project/ideation.js
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

async function readState(projectRoot) {
  const statePath = join(resolve(projectRoot), ".webnovel", "state.json");
  const raw = await readFile(statePath, "utf8");
  return { statePath, state: JSON.parse(raw) };
}

export async function readProjectIdeation(projectRoot) {
  const { state } = await readState(projectRoot);
  const projectInfo = asObject(state.project_info);
  const protagonistState = asObject(state.protagonist_state);
  return {
    title: String(projectInfo.title || ""),
    genre: String(projectInfo.genre || ""),
    targetWords: toNumber(projectInfo.target_words),
    targetChapters: toNumber(projectInfo.target_chapters),
    targetReader: String(projectInfo.target_reader || ""),
    platform: String(projectInfo.platform || ""),
    goldenFingerName: String(projectInfo.golden_finger_name || ""),
    goldenFingerType: String(projectInfo.golden_finger_type || ""),
    goldenFingerStyle: String(projectInfo.golden_finger_style || ""),
    coreSellingPoints: String(projectInfo.core_selling_points || ""),
    protagonistStructure: String(projectInfo.protagonist_structure || ""),
    protagonistName: String(protagonistState.name || ""),
  };
}

export async function updateProjectIdeation(projectRoot, patch = {}) {
  const { statePath, state } = await readState(projectRoot);
  const projectInfo = asObject(state.project_info);
  const protagonistState = asObject(state.protagonist_state);
  const nextState = {
    ...state,
    project_info: {
      ...projectInfo,
      title: String(patch.title ?? projectInfo.title ?? "").trim(),
      genre: String(patch.genre ?? projectInfo.genre ?? "").trim(),
      target_words: toNumber(patch.targetWords ?? projectInfo.target_words),
      target_chapters: toNumber(patch.targetChapters ?? projectInfo.target_chapters),
      target_reader: String(patch.targetReader ?? projectInfo.target_reader ?? "").trim(),
      platform: String(patch.platform ?? projectInfo.platform ?? "").trim(),
      golden_finger_name: String(patch.goldenFingerName ?? projectInfo.golden_finger_name ?? "").trim(),
      golden_finger_type: String(patch.goldenFingerType ?? projectInfo.golden_finger_type ?? "").trim(),
      golden_finger_style: String(patch.goldenFingerStyle ?? projectInfo.golden_finger_style ?? "").trim(),
      core_selling_points: String(patch.coreSellingPoints ?? projectInfo.core_selling_points ?? "").trim(),
      protagonist_structure: String(patch.protagonistStructure ?? projectInfo.protagonist_structure ?? "").trim(),
    },
    protagonist_state: {
      ...protagonistState,
      name: String(patch.protagonistName ?? protagonistState.name ?? "").trim(),
    },
  };
  await writeFile(statePath, JSON.stringify(nextState, null, 2), "utf8");
  return readProjectIdeation(projectRoot);
}

// lib/project/briefs.js
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

function extractChapterNumber(chapterFileName) {
  const match = String(chapterFileName || "").match(/(\d{1,5})/);
  if (!match) throw new Error("Unable to infer chapter number from file name");
  return Number(match[1]);
}

function briefFileName(chapterNumber) {
  return `ch${String(chapterNumber).padStart(4, "0")}.md`;
}

function defaultBriefContent(chapterNumber) {
  return `## Chapter ${String(chapterNumber).padStart(4, "0")} Brief

- Goal:
- Obstacle:
- Cost:
- Coolpoint:
- Strand:
- Antagonist Tier:
- POV:
- Key Entities:
- Change:
- End Question:
- Hook:
`;
}

async function statOrNull(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

export async function readChapterBrief(projectRoot, chapterFileName) {
  const root = resolve(projectRoot);
  const chapterNumber = extractChapterNumber(chapterFileName);
  const fileName = briefFileName(chapterNumber);
  const absolutePath = join(root, ".webnovel", "briefs", fileName);
  const fileStat = await statOrNull(absolutePath);
  if (!fileStat) {
    return { chapterNumber, title: `Chapter ${String(chapterNumber).padStart(4, "0")} Brief`, fileName, relativePath: relative(root, absolutePath), content: defaultBriefContent(chapterNumber), updatedAt: "" };
  }
  return { chapterNumber, title: `Chapter ${String(chapterNumber).padStart(4, "0")} Brief`, fileName, relativePath: relative(root, absolutePath), content: await readFile(absolutePath, "utf8"), updatedAt: fileStat.mtime.toISOString() };
}

export async function updateChapterBrief(projectRoot, chapterFileName, content) {
  const root = resolve(projectRoot);
  const chapterNumber = extractChapterNumber(chapterFileName);
  const fileName = briefFileName(chapterNumber);
  const absolutePath = join(root, ".webnovel", "briefs", fileName);
  await mkdir(join(root, ".webnovel", "briefs"), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
  return readChapterBrief(root, chapterFileName);
}

// lib/project/sync.js
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseChapterBriefContent } from "./brief-format.js";

function chapterKey(chapterNumber) {
  return String(chapterNumber).padStart(4, "0");
}

function asSyncObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function syncChapterArtifacts(projectRoot, chapterFileName, input = {}) {
  const chapterNumber = Number(String(chapterFileName).match(/(\d{1,5})/)?.[1] || 0);
  const key = chapterKey(chapterNumber);
  const root = resolve(projectRoot);
  const statePath = join(root, ".webnovel", "state.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const chapterMeta = asSyncObject(state.chapter_meta);
  const currentMeta = asSyncObject(chapterMeta[key]);
  const parsedBrief = parseChapterBriefContent(input.briefContent);
  const nextMeta = {
    ...currentMeta,
    goal: parsedBrief.goal || currentMeta.goal || "",
    obstacle: parsedBrief.obstacle || currentMeta.obstacle || "",
    cost: parsedBrief.cost || currentMeta.cost || "",
    hook: parsedBrief.hook || parsedBrief.rawHook || currentMeta.hook || "",
    strand: parsedBrief.strand || currentMeta.strand || "",
    updated_at: new Date().toISOString(),
  };
  const nextState = {
    ...state,
    progress: {
      ...asSyncObject(state.progress),
      current_chapter: Math.max(Number(asSyncObject(state.progress).current_chapter || 0), chapterNumber),
      last_updated: new Date().toISOString().replace("T", " ").slice(0, 19),
    },
    chapter_meta: {
      ...chapterMeta,
      [key]: nextMeta,
    },
  };
  await writeFile(statePath, JSON.stringify(nextState, null, 2), "utf8");
  if (typeof input.chapterContent === "string" && input.chapterContent.trim()) {
    await mkdir(join(root, ".webnovel", "summaries"), { recursive: true });
    await writeFile(join(root, ".webnovel", "summaries", `ch${key}.md`), `## Summary
${input.chapterContent.replace(/\s+/g, ' ').trim().slice(0, 180)}
`, "utf8");
  }
  return { chapterNumber, chapterKey: key, chapterMeta: nextMeta };
}
```

```ts
// lib/project/ideation.d.ts
import type { ProjectIdeation } from "@/types/ideation";
export function readProjectIdeation(projectRoot: string): Promise<ProjectIdeation>;
export function updateProjectIdeation(projectRoot: string, patch?: Partial<ProjectIdeation>): Promise<ProjectIdeation>;

// lib/project/briefs.d.ts
import type { ChapterBrief } from "@/types/briefs";
export function readChapterBrief(projectRoot: string, chapterFileName: string): Promise<ChapterBrief>;
export function updateChapterBrief(projectRoot: string, chapterFileName: string, content: string): Promise<ChapterBrief>;

// lib/project/sync.d.ts
export function syncChapterArtifacts(projectRoot: string, chapterFileName: string, input?: { briefContent?: string; chapterContent?: string }): Promise<{ chapterNumber: number; chapterKey: string; chapterMeta: Record<string, unknown> }>;
```


- [ ] **Step 4: Verify the new content services work against the bundled project**

Run: `node --input-type=module -e "const { requireProjectRoot } = await import('./lib/project/root.js'); const { listProjectDocuments } = await import('./lib/project/documents.js'); const { readChapterBrief } = await import('./lib/project/briefs.js'); const root = await requireProjectRoot(); const docs = await listProjectDocuments(root, 'chapter'); const brief = docs[0] ? await readChapterBrief(root, docs[0].fileName) : null; console.log(Array.isArray(docs), brief === null || typeof brief.content === 'string')"`
Expected: `true true`.

- [ ] **Step 5: Checkpoint**

Record Task 2 complete.
### Task 3: Replace Python context extraction and internalize AI guardrails

**Files:**
- Create: `lib/project/context.js`
- Create: `lib/project/context.d.ts`
- Create: `lib/ai/guardrails.js`
- Create: `lib/ai/guardrails.d.ts`
- Modify: `lib/ai/actions.js`

- [ ] **Step 1: Verify the new JavaScript context module is absent**

Run: `Get-Item '.\lib\project\context.js'`
Expected: FAIL with path-not-found.

- [ ] **Step 2: Create a pure JavaScript chapter-context aggregator**

```js
// lib/project/context.js
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

function extractChapterNumber(chapterFileName) {
  const match = String(chapterFileName || "").match(/(\d{1,5})/);
  if (!match) throw new Error("Unable to infer chapter number from file name");
  return Number(match[1]);
}

async function readTextOrEmpty(path) {
  try { return await readFile(path, "utf8"); } catch { return ""; }
}

async function readOutlineExcerpt(projectRoot, chapterNumber) {
  const outlineRoot = join(resolve(projectRoot), "大纲");
  try {
    const entries = await readdir(outlineRoot);
    for (const fileName of entries.filter((name) => name.toLowerCase().endsWith('.md'))) {
      const content = await readTextOrEmpty(join(outlineRoot, fileName));
      const pattern = new RegExp(`###\\s*第?\\s*${chapterNumber}\\s*章[：:].+?(?=###\\s*第?\\s*\\d+\\s*章|$)`, 'su');
      const match = content.match(pattern);
      if (match) return match[0].trim().slice(0, 1500);
    }
  } catch {}
  return "";
}

async function readPreviousSummaries(projectRoot, chapterNumber) {
  const root = resolve(projectRoot);
  const results = [];
  for (let current = Math.max(1, chapterNumber - 3); current < chapterNumber; current += 1) {
    const fileName = `ch${String(current).padStart(4, '0')}.md`;
    const text = await readTextOrEmpty(join(root, '.webnovel', 'summaries', fileName));
    if (!text) continue;
    const match = text.match(/##\s*剧情摘要\s*\r?\n(.+?)(?=\r?\n##|$)/su);
    results.push(match ? match[1].trim() : text.trim().slice(0, 240));
  }
  return results;
}

export async function buildChapterContext(projectRoot, chapterFileName) {
  const chapterNumber = extractChapterNumber(chapterFileName);
  try {
    const [outline, previousSummaries, stateSummary] = await Promise.all([
      readOutlineExcerpt(projectRoot, chapterNumber),
      readPreviousSummaries(projectRoot, chapterNumber),
      readTextOrEmpty(join(resolve(projectRoot), '.webnovel', 'state.json')),
    ]);
    return {
      chapterNumber,
      outline,
      previousSummaries,
      stateSummary: stateSummary ? 'state.json loaded' : '',
      guidanceItems: outline ? ['先对齐大纲目标，再写正文。'] : ['当前章节缺少可匹配的大纲片段。'],
      error: '',
    };
  } catch (error) {
    return { chapterNumber, outline: '', previousSummaries: [], stateSummary: '', guidanceItems: [], error: error instanceof Error ? error.message : 'context_unavailable' };
  }
}
```

```ts
// lib/project/context.d.ts
import type { ChapterContext } from "@/types/context";
export function buildChapterContext(projectRoot: string, chapterFileName: string): Promise<ChapterContext>;
```

- [ ] **Step 3: Move the AI guardrails into a local module and rewire `lib/ai/actions.js`**

```js
// lib/ai/guardrails.js
export const BESTSELLER_GUARDRAILS_TEXT = [
  '只提炼跨作品共性机制，不复用具体作品内容。',
  '只提炼结构、节奏、兑现和升级模式，不复用故事材料。',
  '只借鉴爆款机制，不复用角色骨架、世界装置或关键桥段。',
  '若输出出现可识别的单书设定，应立即回退并改写为机制层表达。',
  '创意约束优先于参考机制，参考机制只能增强原创方案。',
].join('\n');
```

```js
// lib/ai/actions.js - replace imports
import { BESTSELLER_GUARDRAILS_TEXT } from "./guardrails.js";
import { readChapterBrief, updateChapterBrief } from "../project/briefs.js";
import { buildChapterContext } from "../project/context.js";
import { readProjectDocument, listProjectDocuments, updateProjectDocument } from "../project/documents.js";
import { readProjectSummary } from "../project/summary.js";
import { readProjectIdeation } from "../project/ideation.js";
import { syncChapterArtifacts } from "../project/sync.js";

async function loadGuardrails() {
  return BESTSELLER_GUARDRAILS_TEXT;
}
```

Remove the old `.claude/references/bestseller-mechanism-guide.md` file read and remove the Python-path dependency from the context import chain.

- [ ] **Step 4: Verify the new context builder runs without Python or `.claude`**

Run: `node --input-type=module -e "const { requireProjectRoot } = await import('./lib/project/root.js'); const { buildChapterContext } = await import('./lib/project/context.js'); const root = await requireProjectRoot(); const context = await buildChapterContext(root, '第0001章.md'); console.log(typeof context.stateSummary === 'string', Array.isArray(context.previousSummaries), typeof context.error === 'string')"`
Expected: `true true true`.

- [ ] **Step 5: Checkpoint**

Record Task 3 complete.

### Task 4: Rename the runtime API surface to `/api/project/*`

**Files:**
- Create: `app/api/project/ideation/route.ts`
- Create: `app/api/project/documents/route.ts`
- Create: `app/api/project/briefs/route.ts`
- Create: `app/api/project/context/route.ts`
- Create: `app/api/project/actions/route.ts`
- Delete: `app/api/projects/route.ts`
- Delete: `app/api/projects/current/route.ts`
- Delete: `app/api/projects/current/ideation/route.ts`
- Delete: `app/api/projects/current/documents/route.ts`
- Delete: `app/api/projects/current/briefs/route.ts`
- Delete: `app/api/projects/current/context/route.ts`
- Delete: `app/api/projects/current/actions/route.ts`
- Delete: `app/api/projects/current/review/route.ts`

- [ ] **Step 1: Verify the new API route tree is absent**

Run: `Get-ChildItem '.\app\api\project' -Recurse`
Expected: FAIL or empty because the directory does not exist yet.

- [ ] **Step 2: Create the new single-project routes using `requireProjectRoot()`**

```ts
// app/api/project/ideation/route.ts
import { NextResponse } from "next/server";
import { requireProjectRoot } from "@/lib/project/root.js";
import { readProjectIdeation, updateProjectIdeation } from "@/lib/project/ideation.js";

export async function GET() {
  const ideation = await readProjectIdeation(await requireProjectRoot());
  return NextResponse.json({ ok: true, data: ideation });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const ideation = await updateProjectIdeation(await requireProjectRoot(), body ?? {});
  return NextResponse.json({ ok: true, data: ideation });
}
```

```ts
// app/api/project/documents/route.ts
import { NextResponse } from "next/server";
import { createProjectDocument, listProjectDocuments, readProjectDocument, updateProjectDocument } from "@/lib/project/documents.js";
import { readChapterBrief } from "@/lib/project/briefs.js";
import { requireProjectRoot } from "@/lib/project/root.js";
import { syncChapterArtifacts } from "@/lib/project/sync.js";

function asKind(value: string | null) {
  if (value === "setting" || value === "outline" || value === "chapter") return value;
  throw new Error("Unsupported document kind");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kind = asKind(searchParams.get("kind"));
    const fileName = searchParams.get("file");
    const projectRoot = await requireProjectRoot();
    const data = fileName ? await readProjectDocument(projectRoot, kind, fileName) : await listProjectDocuments(projectRoot, kind);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load documents" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kind = asKind(body.kind);
    const projectRoot = await requireProjectRoot();
    const document = await createProjectDocument(projectRoot, kind, { title: body.title, fileName: body.fileName, content: "" });
    if (kind === "chapter") {
      const brief = await readChapterBrief(projectRoot, document.fileName);
      await syncChapterArtifacts(projectRoot, document.fileName, { briefContent: brief.content, chapterContent: document.content });
    }
    const documents = await listProjectDocuments(projectRoot, kind);
    return NextResponse.json({ ok: true, data: { document, documents } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create document" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const kind = asKind(body.kind);
    const projectRoot = await requireProjectRoot();
    const document = await updateProjectDocument(projectRoot, kind, body.fileName, typeof body.content === "string" ? body.content : "");
    if (kind === "chapter") {
      const brief = await readChapterBrief(projectRoot, body.fileName);
      await syncChapterArtifacts(projectRoot, body.fileName, { briefContent: brief.content, chapterContent: document.content });
    }
    const documents = await listProjectDocuments(projectRoot, kind);
    return NextResponse.json({ ok: true, data: { document, documents } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to save document" }, { status: 400 });
  }
}
```

```ts
// app/api/project/briefs/route.ts
import { NextResponse } from "next/server";
import { readChapterBrief, updateChapterBrief } from "@/lib/project/briefs.js";
import { requireProjectRoot } from "@/lib/project/root.js";
import { syncChapterArtifacts } from "@/lib/project/sync.js";

export async function GET(request: Request) {
  try {
    const fileName = new URL(request.url).searchParams.get("file");
    if (!fileName) throw new Error("Chapter file name is required");
    const brief = await readChapterBrief(await requireProjectRoot(), fileName);
    return NextResponse.json({ ok: true, data: brief });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load chapter brief" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const projectRoot = await requireProjectRoot();
    const brief = await updateChapterBrief(projectRoot, body.fileName, typeof body.content === "string" ? body.content : "");
    await syncChapterArtifacts(projectRoot, body.fileName, { briefContent: brief.content });
    return NextResponse.json({ ok: true, data: brief });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to save chapter brief" }, { status: 400 });
  }
}
```

```ts
// app/api/project/context/route.ts
import { NextResponse } from "next/server";
import { buildChapterContext } from "@/lib/project/context.js";
import { requireProjectRoot } from "@/lib/project/root.js";

export async function GET(request: Request) {
  try {
    const fileName = new URL(request.url).searchParams.get("file");
    if (!fileName) throw new Error("Chapter file name is required");
    const context = await buildChapterContext(await requireProjectRoot(), fileName);
    return NextResponse.json({ ok: true, data: context });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load chapter context" }, { status: 400 });
  }
}
```

```ts
// app/api/project/actions/route.ts
import { NextResponse } from "next/server";
import { runDocumentAiAction } from "@/lib/ai/actions.js";
import { requireProjectRoot } from "@/lib/project/root.js";

function validKind(value: unknown) {
  return value === "outline" || value === "chapter";
}

function validMode(value: unknown) {
  return value === "outline_plan" || value === "chapter_plan" || value === "chapter_write";
}

function validApplyMode(value: unknown) {
  return value === "replace" || value === "append";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!validKind(body.kind) || !validMode(body.mode) || !validApplyMode(body.applyMode)) {
      throw new Error("Unsupported AI action payload");
    }
    const result = await runDocumentAiAction({
      projectRoot: await requireProjectRoot(),
      configRoot: process.env.WEBNOVEL_WRITER_CONFIG_ROOT,
      kind: body.kind,
      fileName: String(body.fileName || ""),
      mode: body.mode,
      userRequest: typeof body.userRequest === "string" ? body.userRequest : "",
      applyMode: body.applyMode,
    });
    return NextResponse.json({ ok: true, data: { ...result, generatedText: result.generatedText.slice(0, 100000) } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to run AI action" }, { status: 400 });
  }
}
```

- [ ] **Step 3: Delete the old multi-project routes**

Run: `Remove-Item -Recurse -Force -LiteralPath '.\app\api\projects'`
Expected: the old `projects/current/*` tree is removed.

- [ ] **Step 4: Verify only the new runtime API routes remain**

Run: `Get-ChildItem '.\app\api\project' -Recurse -Filter route.ts | Select-Object -ExpandProperty FullName`
Expected: exactly five `route.ts` files under `actions`, `briefs`, `context`, `documents`, and `ideation`.

- [ ] **Step 5: Checkpoint**

Record Task 4 complete.
### Task 5: Rewire pages and client components to the single-project services and routes

**Files:**
- Modify: `app/ideation/page.tsx`
- Modify: `app/library/page.tsx`
- Modify: `app/outline/page.tsx`
- Modify: `app/writing/page.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `components/document-workspace.tsx`
- Modify: `components/ideation-form.tsx`
- Modify: `components/writing-studio.tsx`
- Delete: `app/dashboard/page.tsx`
- Delete: `app/review/page.tsx`
- Delete: `components/project-workspace-panel.tsx`
- Delete: `components/review-summary-panel.tsx`
- Delete: `lib/dashboard/`
- Delete: `lib/review/`
- Delete: `lib/projects/review.js`
- Delete: `lib/projects/review.d.ts`
- Delete: `types/review.ts`

- [ ] **Step 1: Find all remaining workspace and old-route references before editing**

Run: `rg -n "@/lib/projects|/api/projects/current|/dashboard|/review|project-workspace-panel|review-summary-panel" app components lib types`
Expected: multiple matches across pages and components.

- [ ] **Step 2: Update page loaders to use `@/lib/project/*` and the fixed summary**

```tsx
// app/ideation/page.tsx
import { AppShell } from "@/components/app-shell";
import { IdeationForm } from "@/components/ideation-form";
import { WorkspaceIntro } from "@/components/workspace-intro";
import { requireProjectRoot } from "@/lib/project/root.js";
import { readProjectSummary } from "@/lib/project/summary.js";
import { readProjectIdeation } from "@/lib/project/ideation.js";

export default async function IdeationPage() {
  const [projectRoot, project] = await Promise.all([requireProjectRoot(), readProjectSummary()]);
  const ideation = await readProjectIdeation(projectRoot);

  return (
    <AppShell currentPath="/ideation" project={project} title="立项台" description="题材、读者定位、主角与卖点的固定入口。">
      <section className="workspace-panel">
        <WorkspaceIntro eyebrow="立项工作区" title="先定定位，再推进大纲与写作" description="这里直接写入固定单项目的 state.json。" />
        <IdeationForm initialIdeation={ideation} />
      </section>
    </AppShell>
  );
}
```

```tsx
// app/library/page.tsx
import { requireProjectRoot } from "@/lib/project/root.js";
import { readProjectSummary } from "@/lib/project/summary.js";
import { listProjectDocuments, readProjectDocument } from "@/lib/project/documents.js";

const [projectRoot, project] = await Promise.all([requireProjectRoot(), readProjectSummary()]);
const documents = await listProjectDocuments(projectRoot, "setting");
const initialDocument = documents[0] ? await readProjectDocument(projectRoot, "setting", documents[0].fileName) : null;

// app/outline/page.tsx
import { requireProjectRoot } from "@/lib/project/root.js";
import { readProjectSummary } from "@/lib/project/summary.js";
import { listProjectDocuments, readProjectDocument } from "@/lib/project/documents.js";

const [projectRoot, project] = await Promise.all([requireProjectRoot(), readProjectSummary()]);
const documents = await listProjectDocuments(projectRoot, "outline");
const initialDocument = documents[0] ? await readProjectDocument(projectRoot, "outline", documents[0].fileName) : null;

// app/writing/page.tsx
import { requireProjectRoot } from "@/lib/project/root.js";
import { readProjectSummary } from "@/lib/project/summary.js";
import { buildChapterContext } from "@/lib/project/context.js";
import { readChapterBrief } from "@/lib/project/briefs.js";
import { listProjectDocuments, readProjectDocument } from "@/lib/project/documents.js";

const [projectRoot, project] = await Promise.all([requireProjectRoot(), readProjectSummary()]);
const documents = await listProjectDocuments(projectRoot, "chapter");
const selectedMeta = requestedFile && documents.some((item) => item.fileName === requestedFile) ? documents.find((item) => item.fileName === requestedFile) || documents[0] : documents[0];
const initialDocument = selectedMeta ? await readProjectDocument(projectRoot, "chapter", selectedMeta.fileName) : null;
const initialBrief = selectedMeta ? await readChapterBrief(projectRoot, selectedMeta.fileName) : null;
const initialContext = selectedMeta ? await buildChapterContext(projectRoot, selectedMeta.fileName) : null;

// app/settings/page.tsx
import { readProjectSummary } from "@/lib/project/summary.js";
const project = await readProjectSummary();
```

- [ ] **Step 3: Repoint all client fetches to `/api/project/*` and remove null-project branches**

```tsx
// components/document-workspace.tsx
await fetch(`/api/project/documents?kind=${kind}&file=${encodeURIComponent(fileName)}`);
await fetch("/api/project/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, title: newTitle }) });
await fetch("/api/project/documents", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, fileName: selectedDocument.fileName, content: draftContent }) });
await fetch("/api/project/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, fileName: selectedDocument.fileName, mode, userRequest: assistantRequest, applyMode }) });
```

```tsx
// components/ideation-form.tsx
await fetch("/api/project/ideation", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(form),
});
```

```tsx
// components/writing-studio.tsx
await fetch("/api/project/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "chapter", title: newTitle }) });
await fetch(`/api/project/briefs?file=${encodeURIComponent(fileName)}`);
await fetch(`/api/project/context?file=${encodeURIComponent(fileName)}`);
await fetch("/api/project/briefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: selectedDocument.fileName, content: briefContent }) });
await fetch("/api/project/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "chapter", fileName: selectedDocument.fileName, mode, userRequest: overrideRequest ?? assistantRequest, applyMode: mode === "chapter_plan" ? "replace" : "append" }) });
```

- [ ] **Step 4: Delete dashboard and review surfaces after the rewiring is complete**

Run:
```powershell
Remove-Item -Recurse -Force -LiteralPath '.\app\dashboard'
Remove-Item -Recurse -Force -LiteralPath '.\app\review'
Remove-Item -Force -LiteralPath '.\components\project-workspace-panel.tsx'
Remove-Item -Force -LiteralPath '.\components\review-summary-panel.tsx'
Remove-Item -Recurse -Force -LiteralPath '.\lib\dashboard'
Remove-Item -Recurse -Force -LiteralPath '.\lib\review'
Remove-Item -Force -LiteralPath '.\lib\projects\review.js','.\lib\projects\review.d.ts','.\types\review.ts'
```
Expected: all dashboard and review runtime surfaces are removed.

- [ ] **Step 5: Confirm no surviving app code still references the removed workspace paths**

Run: `rg -n "@/lib/projects|/api/projects/current|/dashboard|/review|project-workspace-panel|review-summary-panel" app components lib types`
Expected: no matches in surviving runtime files.

- [ ] **Step 6: Checkpoint**

Record Task 5 complete.

### Task 6: Trim package scripts, remove legacy assets, and verify the slim product

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Delete: `.claude/`
- Delete: `tests/`
- Delete: `scripts/`
- Delete: `playwright.config.mjs`
- Delete: `pytest.ini`
- Delete: `.coveragerc`
- Delete: `CHANGELOG.md`
- Delete: runtime artifact directories and files
- Delete: `webnovel-project/.git`
- Delete: `webnovel-project/.webnovel/index.db`
- Delete: `webnovel-project/.webnovel/workflow_state.json`
- Delete: `webnovel-project/.webnovel/observability/`
- Delete: `webnovel-project/.webnovel/archive/`
- Delete: `webnovel-project/.webnovel/backups/`

- [ ] **Step 1: Shrink `package.json` and `tsconfig.json` to the runtime-only shape**

```json
// package.json - scripts section
{
  "scripts": {
    "dev": "node ./node_modules/next/dist/bin/next dev",
    "build": "node ./node_modules/next/dist/bin/next build",
    "start": "node ./node_modules/next/dist/bin/next start"
  }
}
```

```json
// tsconfig.json - include section
{
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ]
}
```

- [ ] **Step 2: Delete test, QA, workflow, and cached build artifacts**

Run:
```powershell
Remove-Item -Recurse -Force -LiteralPath '.\.next','.\.next-manual-inspect','.\.next-playwright','.\.playwright','.\playwright-report','.\test-results' -ErrorAction SilentlyContinue
Remove-Item -Force -LiteralPath '.\.coverage','.\tsconfig.tsbuildinfo','.\playwright.config.mjs','.\pytest.ini','.\.coveragerc','.\CHANGELOG.md' -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force -LiteralPath '.\tests','.\scripts','.\.claude' -ErrorAction SilentlyContinue
```
Expected: the repository no longer contains cached build outputs, test trees, or legacy workflow assets.

- [ ] **Step 3: Delete non-runtime project artifacts from `webnovel-project/`**

Run:
```powershell
Remove-Item -Recurse -Force -LiteralPath '.\webnovel-project\.git','.\webnovel-project\.webnovel\observability','.\webnovel-project\.webnovel\archive','.\webnovel-project\.webnovel\backups' -ErrorAction SilentlyContinue
Remove-Item -Force -LiteralPath '.\webnovel-project\.webnovel\index.db','.\webnovel-project\.webnovel\workflow_state.json' -ErrorAction SilentlyContinue
```
Expected: only real content and required `.webnovel` runtime files remain.

- [ ] **Step 4: Run type-check and production build verification**

Run:
```powershell
node .\node_modules\typescript\bin\tsc --noEmit
npm run build
```
Expected: both commands PASS with no unresolved imports.

- [ ] **Step 5: Run the local dev server and verify the kept routes**

Run: `npm run dev`
Expected: Next.js starts successfully and prints a local URL, typically `http://localhost:3000`.

Manual checks while the server is running:
- open `/writing` and confirm chapter list, brief editor, context panel, and chapter editor render
- open `/outline` and confirm outline documents load and save
- open `/settings` and confirm provider config still loads and saves
- open `/ideation` and confirm state-backed ideation fields still save
- open `/library` and confirm setting documents load and save

- [ ] **Step 6: Verify AI fallback and real AI generation behavior**

Manual checks:
- without a provider API key, confirm local editing still works and AI actions return a clear unavailable message
- with a valid provider API key, confirm `/outline` AI planning and `/writing` chapter plan or chapter write produce real file updates under `webnovel-project/`

- [ ] **Step 7: Checkpoint**

Record Task 6 complete and confirm the slim single-project runtime matches the acceptance criteria.




