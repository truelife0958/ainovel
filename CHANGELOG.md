# Changelog

## 2026-05-03 — Tier 6 Pass 2 / sub-tier 6.3（测试覆盖）

### Added (test smoke)
- `tests/projects/state-branches.test.mjs` — 6 个测试覆盖 `lib/projects/state.js`
  的 5 个错误分支 + 1 个写入回读：state.json 缺失（ENOENT）、损坏 JSON、
  数组、null、合法对象、updateProjectIdeation 写入并 trim 字段。
  state.js branch% 由 27.77% 升至 **77.27%**。
- `tests/ai/prompts-coverage.test.mjs` — 4 个测试覆盖
  `lib/ai/prompts/setting.js`（5 modes + unsupported throw）+
  `lib/ai/prompts/reference.js`（基本路径 + 空 guardrails）。
  setting.js stmt% 由 2.29% 升至 **100%**；reference.js stmt% 由 5.88% 升至 **100%**。
  总体覆盖率：Statements 83.13% → **88.21%** / Branches 68.6% → **72.43%**。

### Backlog (deferred from §6 candidates)
- **F1 `app-smoke:52`** — selector 修复尝试后 仍 TimeoutError；实际症状是模态
  状态分支（titleField vs .project-row）双不可见，超出简单 selector 修复范围。
  需要重设计该 spec 的项目 setup 流。
- **F6 batch/reference/scaffold spec skip** — toolbar AI 按钮可见性由 SSR-time
  `aiAvailable` 决定，仅 `page.route()` mock /api/settings/providers 不够。
  graceful-skip 是 design 行为，不是 bug。本轮保留。

### Tag
- `polish-tier-6.3`

## 2026-05-03 — Tier 6 Pass 2 / sub-tier 6.4（安全 + DX）

### Fixed
- **Security (high CVE → 0)** — `next` 升级到 16.2.4，CVE 数据库不再标
  GHSA-q4gf-8mx6-v5v3（DoS via Server Components）为该版本的 high 风险。
- **Security (moderate XSS → 0)** — 加 `package.json` `overrides.postcss: ^8.5.10`
  解 GHSA-qx2v-qp2m-jg93（PostCSS XSS via unescaped `</style>`）。
  最终 `npm audit --omit=dev` 全清零（info/low/moderate/high/critical 都 0）。
- **DX** — `scripts/run-playwright-e2e.mjs` 抽出 `makeChildEnv()` 帮助函数，
  子进程 env 自动剥离 `HTTP_PROXY` / `HTTPS_PROXY` / `http_proxy` / `https_proxy`
  避免某些 WSL/容器代理环境下 Playwright 端口探测被误判 503（finding F11）。
- **DX** — `next.config.ts` 在 `ANALYZE=1` + Turbopack 环境下打印 warn 提示
  用户 `next build --webpack` 才能产出 html 报告（finding F12）。
- **DX** — `lib/ai/actions.js` 缺 API Key 错误对象带 `code: "AI_PROVIDER_MISSING_KEY"`
  与中文文案"请在「连接设置」中配置"（finding F15）。
  `tests/ai/actions.test.mjs` 已有测试加强：同时断言 err.code、中文文案与 api key。

### Tag
- `polish-tier-6.4`

## 2026-05-03 — Tier 6 Pass 2 / sub-tier 6.2（a11y）

### Fixed
- **a11y critical** — `Dropdown` 外层 `<div>` 移除 `aria-haspopup` / `aria-expanded`
  (`components/ui/dropdown.tsx`)：两个属性在无 role 的 div 上是非法，
  调用方的 trigger 按钮（如 `export-menu.tsx`）已经自带这两个属性。
- **a11y moderate** — AppShell / WelcomeShell 加 visually-hidden `<h1>`，
  并把 WelcomeShell 顶层 `<div class="welcome-content">` 升格为 `<main>`，
  让 h1 落在 landmark 内；消除 `page-has-heading-one` + `region` 两个 violation。
- **E2E** — 由 a11y critical 引发的 3 个 E2E fail（`dark-mode:toggle` /
  `dark-mode:system` / `export:menu-open`）由 ✘ 转 ✓。E2E 由 1/4/6 改善到 4/1/6
  （仅余 `app-smoke:52` selector 漂移，留 sub-tier 6.3 修）。

### Tag
- `polish-tier-6.2`

## 2026-05-03 — Tier 6 Pass 1（audit · 跑通取证）

### Added (devDep / scripts only — runtime deps unchanged)

- `@next/bundle-analyzer ^16.2.4` devDep + `next.config.ts`
  `ANALYZE=1` env-gated 包装 + `npm run analyze` script。
  注：插件是 webpack-only，Next 16 默认 Turbopack 静默忽略；
  `next build --webpack` 才能产出 html 报告（详见 §1.2）。
- `c8 ^11.0.0` devDep + `npm run test:coverage` script
  （c8 text-summary + per-file table over `lib` + `app`）。

### Audited（"经审"凭证）

- `tsc --noEmit`：0 错误（耗时 1.828s）。
- `npm test`：134/134（duration 2380ms）。
- `npm run build`：Next 16.1.7 + Turbopack；page-load 154 KB gz；
  1 build warning（`middleware` 文件约定 deprecated → `proxy`）。
- `npm run test:e2e`：⚠ **1 passed / 4 failed / 6 skipped**
  （README "axe-core critical = 0" 不实，3 处 critical
  `aria-allowed-attr × 2` 同根因；1 个 selector 漂移）。
- a11y 扩级（critical+serious+moderate）：4 violations，去重 2 根因。
- Bundle composition：top-10 client/server modules（webpack analyzer
  output before webpack build error；用于模块归因）。
- Coverage：Statements 83.13% / Branches 68.6% / Functions 88.62%。
- `npm audit`：runtime **1 high (next DoS)** + 1 moderate (postcss XSS)。
- DX：6 envvar 在代码但 README 未提；HTTP_PROXY 系统代理拦截
  E2E 端口探测；@next/bundle-analyzer 在 Turbopack 下静默无输出。

### Findings

- 详见 `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md`
  §5（17 个 finding：4 critical/high · 8 moderate · 5 minor）+
  §6（4 个 sub-tier 6.1–6.4 候选）。
- Pass 2 触发：**是**，待用户决策启动哪些 sub-tier。

### Pass 1 invariants

- 运行时依赖仍为 `next` / `react` / `react-dom` 三件套（不变量 I4）。
- `tsc --noEmit` / `npm test` / `npm run build` 全绿（I1–I3）。
- 业务代码、组件、API 路由、CSS **0 行**变化。
- `npm run test:e2e` 红色（不变量 I5 失守）—— 但这是**审计前已存在**的回归，
  Pass 1 仅观测而不修；Pass 2 sub-tier 6.2 + 6.3 修复后 I5 将恢复。

### Tag

- `tier-6-audit`（Pass 1 完成）。

## 2026-04-19 — Polish to 9.9 (Tiers 1-5 + post-audit fix)

### Post-audit fix

- **Fixed** — Removed dead `initialAssistantRequest` prop chain
  (URL param → `app/page.tsx` → `CreativeWorkspace`) that was
  declared and destructured but never read (tsc strict
  `--noUnusedLocals` caught it).
- **Fixed** — `lib/ai/batch-scheduler.js` `defaultSleep` now listens
  for `AbortSignal`; user "Stop" during a 429 rate-limit wait takes
  effect immediately instead of waiting up to 30 s.
- **Chore** — Added `.omc/` to `.gitignore` and untracked four
  runtime state files that shouldn't live in version control.

### Tier 5 · Finer-grained cleanup (tag polish-tier-5)

- **Chore** — Dropped unused workspace state: `context` / `messageType`
  / `showMessage`; removed the dead `/api/projects/current/context`
  client fetch + server-side `buildChapterContext` pre-render.
- **Refactor** — Extracted `EditorSurface` sub-component
  (`creative-workspace.tsx` 459 → 407).
- **Refactor** — Extracted `BatchProgressSection` sub-component
  (`batch-generate-modal.tsx` 318 → 249).
- **Docs** — Added "EXECUTED in commits X..Y" status banners to 5
  historical plan files under `docs/superpowers/plans/`.

### Tier 4b · Structural refactor (tag polish-tier-4b)

- **Refactor** — `providers.js` uses a `createAdapter` strategy
  pattern. Each of 9 providers is now a ~10-line declaration;
  Anthropic keeps its `cache_control: ephemeral` via a
  `buildRequest` closure. 491 → 347 lines.
- **Refactor** — Split prompts out of `actions.js` into
  `lib/ai/prompts/{_shared,outline,chapter,setting,reference,index}.js`.
  `actions.js` 622 → 218.
- **Refactor** — Extracted `useAutoSave` / `useAiRunner` /
  `useKeyboardShortcuts` hooks from `creative-workspace.tsx`.

### Tier 4a · Zero-behavior cleanup (tag polish-tier-4a)

- **Chore** — Dropped unused `lib/ai/prompt-cache.js` helper and
  its tests.
- **Chore** — Dropped unused `@testing-library/user-event` devDep.
- **Refactor** — New `lib/api/with-route-logging.ts` higher-order
  handler collapses 18 `catch` blocks across 10 routes.
- **Refactor** — New `lib/api/use-modal-resource.ts` hook DRYs
  five modal `AbortController` + loading + error + retry sites.
- **Style** — Stripped `(T1.x)` / `(T2.x)` tier tags from CSS
  section headers.

## 2026-04-19 (earlier) — Polish to 9.9 (Tiers 1-3)

### Tier 1 · Correctness & resilience

- **Fixed** — Auto-save silent failure now surfaces a sticky retry
  toast with exponential backoff (30→60→120→300 s).
- **Fixed** — `saveDocument` consolidated into a single
  `useCallback({ silent? })`; the ref-to-hoisted-function workaround
  is gone.
- **Fixed** — `useAbortableFetch` hook cancels in-flight chapter loads
  when the user switches chapters.
- **Fixed** — Batch generation detects HTTP 429, honors `Retry-After`,
  and auto-pauses after three consecutive non-429 errors.
- **Fixed** — `applyResult` now returns `{ content, downgraded }` so a
  >30 KB append that silently falls back to replace raises a visible
  warning banner.
- **Fixed** — Modal focus trap: focus moves to the first interactive
  element on open, wraps on Tab, and returns to the trigger on close.
- **Fixed** — Ideation / Connection modals prompt before discarding
  dirty form data via overlay click or ESC.
- **Added** — Root `ErrorBoundary` with copyable error id.
- **Fixed** — Connection wizard test button shows a spinner during
  the request and an aria-live result banner.
- **Chore** — Scaffold modal no-op `item.checked ? "waiting" :
  "waiting"` removed.
- **DX** — `@testing-library/react` + `linkedom` wired; tests now run
  React components under `node:test`.

### Tier 2 · Value features

- **Added** — Anthropic prompt caching (`cache_control: ephemeral` on
  the system prompt); `WEBNOVEL_DISABLE_PROMPT_CACHE=1` reverts. All
  providers now return a unified `{ text, usage, latencyMs }`.
- **Added** — `splitPromptParts` helper for cacheable static prefix
  (consumer migration deferred).
- **Added** — End-to-end `AbortSignal` from UI → API route → provider;
  "取消" button in the AI loading overlay; server returns HTTP 499
  on cancellation.
- **Added** — AI call telemetry (`lib/ai/telemetry.js`): normalized
  usage across Anthropic / OpenAI / Gemini shapes; `AiStatusLine` in
  the bottom bar renders `"1.2s · 2.3k→1.1k tokens"` with cache-hit
  hint.
- **Added** — Zero-dep Markdown preview with edit / split / preview
  view modes.
- **Added** — Chapter quick-search in the bottom bar dropdown (title
  + filename substring, numeric-exact by chapter number).
- **Added** — Export menu: current chapter as `.md`, all chapters
  combined as `.txt`.
- **Added** — SVG word-count progress ring next to the chapter title.

### Tier 3 · Quality foundation

- **Added** — `lib/log.js` structured logger; JSON in production,
  colored in dev, silent in tests.
- **Added** — `middleware.ts` injects `X-Request-Id`; every API
  route's catch block records `{ route, requestId, error }`.
- **Added** — `lib/editor/format.js` pure helper extracted from
  `editor-toolbar.tsx`; enables unit testing of wrap / prefix / insert
  logic.
- **Added** — Playwright E2E specs: `dark-mode`, `export`,
  `batch-generate`, `scaffold-generate`, `reference-analysis`
  (mocked AI). Plus `@axe-core/playwright` critical-violation checks
  on `dark-mode` and `export`.
- **Added** — `ARCHITECTURE.md`, `CONTRIBUTING.md`,
  `docs/adr/0001`–`0005`.
- **Changed** — README quality-baseline badges + section.

### Summary numbers

- Tests: **62 → 137+** (unit + component + E2E + a11y).
- TypeScript: **0 errors** maintained.
- Build: **15 routes + middleware**; unchanged runtime dependency
  list (`next`, `react`, `react-dom`).
- Tags: `polish-tier-1`, `polish-tier-2`, `polish-tier-3`.
- Design: `docs/superpowers/specs/2026-04-19-polish-to-9_9-design.md`.
- Implementation plans:
  - `docs/superpowers/plans/2026-04-19-polish-tier-1-plan.md`
  - `docs/superpowers/plans/2026-04-19-polish-tier-2-plan.md`
  - `docs/superpowers/plans/2026-04-19-polish-tier-3-plan.md`

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
