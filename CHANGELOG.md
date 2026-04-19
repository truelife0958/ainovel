# Changelog

## 2026-04-19 — Polish to 9.9 (Tiers 1-3)

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
