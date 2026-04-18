# 设计文档 — Webnovel Writer 精益打磨至 9.9 分

**日期**：2026-04-19
**作者**：结对 brainstorm（Claude + 项目维护者）
**状态**：已经用户批准设计；下一步写实施计划

---

## 0. 背景与目标

### 0.1 当前水位（2026-04-19 基线）

- Next.js 16 + React 19 + TypeScript 5.9，零运行时业务依赖
- 单元测试 **62/62** 通过；`tsc --noEmit` **0 错误**；构建干净
- 源代码无 `TODO` / `FIXME` / `@ts-ignore` / `as any`；业务代码无 `console.*`
- 安全基线到位：AES-256-GCM 密钥加密、速率限制、SSRF 黑名单、输入净化、文件锁、原子写
- 最近一次大改动（`0864c5e`）已完成：暗色模式、编辑器工具栏、批量生成、专注模式、自动保存、安全加固

### 0.2 为什么还不到 9.9

经过全代码审阅，距离 9.9 的差距集中在 8 个维度：

| 维度 | 差距描述 |
|------|---------|
| 正确性 | `creative-workspace` 的 `saveDocument`/`saveDocumentImpl` 双路径 + ref 提升不稳定；`scaffold-modal` 有 no-op 重置 |
| 韧性 | auto-save 静默失败；批量生成 3 req/章 × 限流 10/min → 3-4 章后必触 429；无 AbortController；无重试 |
| AI 质量 | 无 Anthropic prompt caching；`applyResult` 静默把 append 降级为 replace；无 token/延迟度量 |
| UX | 无 Markdown 预览、无导出、无章节搜索、无 AI 取消按钮、字数目标只在底部条体现 |
| 可观测 | 无结构化日志、无 request-id、失败路径只返回字符串错误 |
| 测试 | 只有 `lib/` 单元测试；E2E 仅 `app-smoke`；批量/骨架/参考/暗色/a11y 全无断言 |
| 文档 | 无 `ARCHITECTURE.md` / `CONTRIBUTING.md` / ADR；CHANGELOG 单薄 |
| 无障碍 | Modal 焦点只落 `dialogRef`（tabIndex=-1），无焦点陷阱与返回；部分 live region 缺失 |

### 0.3 目标 · 非目标

**目标**

- 消除 5 类可触达 bug：数据丢失、限流雪崩、焦点失陷、静默降级、无可视失败
- 新增 4 类写作端价值：AI 可取消、Markdown 预览、导出、章节搜索
- 建 3 类质量地基：结构化日志、组件/E2E/a11y 测试、架构/ADR 文档

**非目标**

- 不引入新 AI provider
- 不重写模态框架构或加入新路由
- 不加 i18n
- 不引入 Zustand/Redux 等重型状态管理

### 0.4 总体原则

- **零新增运行时依赖**：保持 `next` / `react` / `react-dom` 三件套；测试侧允许加 devDep（`@testing-library/react`、`@axe-core/playwright`、`linkedom` 或 `jsdom`）
- **所有改动必须保持 `tsc --noEmit` 0 错误 + 全量测试绿**
- **每个 Tier 结束提交一个 commit 并打 tag**；保持可回滚
- **先封漏水，再做增值，最后筑底座**：Tier 顺序即风险顺序

---

## 1. Tier 1 · 正确性与韧性（先行必做）

### 1.1 概览

| # | 问题 | 验收信号 |
|---|------|---------|
| T1.0 | RTL/DOM shim 前置（迁自 Tier 3） | `npm test` 可运行 `tests/components/**/*.test.mjs` |
| T1.1 | auto-save 静默失败 | 注入网络错误 → 可点击 toast 出现 |
| T1.2 | saveDocument 双路径 | 单一实现；useCallback 依赖数组正确 |
| T1.3 | 无 AbortController | 切换章节 / 关闭 modal 时 devtools 看到请求被 aborted |
| T1.4 | 批量生成 429 雪崩 | 手工将限流调至 5/min，批量 10 章全部完成 |
| T1.5 | append 静默降级 | 原稿 > 30KB 时 UI 明确提示 |
| T1.6 | Modal 无焦点陷阱 | Tab 键不跳出 dialog；关闭后焦点返回 trigger |
| T1.7 | 脏态遮罩关闭丢数据 | IdeationModal / ConnectionModal dirty 状态 ESC 弹确认 |
| T1.8 | 无 error boundary | 注入渲染异常 → 友好回退 UI + 错误 id 可复制 |
| T1.9 | scaffold 无意义重置 | 代码审阅消除 no-op 表达式 |
| T1.10 | provider test 无 loading | 按钮 spinner + 禁用 + 分色结果 |

### 1.2 详细方案

**T1.0 · RTL / DOM shim 前置**

- 原计划放在 Tier 3（T3.3），但 Tier 1 多项测试（T1.1/T1.2/T1.3/T1.6/T1.8）都依赖组件级断言，故上移为 Tier 1 首项
- devDep：`@testing-library/react`、`@testing-library/dom`、`@testing-library/user-event`、`linkedom`
- 新建 `tests/setup/dom.mjs`：注入 `document` / `window` / `HTMLElement` / `requestAnimationFrame` 等 global
- 新建 `tests/setup/react.mjs`：导出常用 `render` / `screen` / `fireEvent` 的封装
- `package.json` 脚本更新：`"test": "node --import=./tests/setup/dom.mjs --test tests/**/*.test.mjs"`
- 新建 `tests/components/_smoke.test.mjs`：最简 `render(<div>hi</div>)` 断言，证明环境可用
- T3.3 后续只负责"扩充组件测试覆盖到剩余组件"

**T1.1 · auto-save 失败可见 + 指数退避**

- 现状：`saveDocumentImpl` catch 只 `setMessage("网络错误，保存失败")`，30s 定时器不重试
- 方案：
  - 新增状态 `autoSaveError: { message, retryAt } | null`
  - toast 组件增加 `action` 变体：`[标题] [操作按钮]`，a11y `role="alert"`
  - 失败时 `autoSaveError` 置值，toast 显示 "自动保存失败 [立即重试]"
  - 退避：连续失败时 30s → 60s → 120s → 300s 封顶；恢复 200 响应后复位
  - 成功路径不变
- 测试：组件测试 mock `fetch` 返回 500，断言 toast 出现；点击重试后二次调用；响应 200 后 toast 消失

**T1.2 · saveDocument 双路径统一**

- 现状：
  ```ts
  const saveRef = useRef(saveDocument);  // 函数提升
  saveRef.current = saveDocument;         // 重复赋值
  function saveDocument() { ... startTransition(async () => { const doc = await saveDocumentImpl(); ... }) }
  async function saveDocumentImpl() { ... }
  ```
- 方案：合并为单一 `saveDocument = useCallback(async ({ silent = false } = {}) => { ... }, [deps])`；`saveRef` 保留（因为 useEffect 里用，避免 effect 重订阅），但声明一致在 useCallback 后
- 测试：现有 save 相关测试继续通过；新增：连续快速 Ctrl+S 不触发并发保存

**T1.3 · AbortController**

- 新增 `lib/api/use-abortable-fetch.ts`：
  ```ts
  export function useAbortableFetch() {
    const ctrlRef = useRef<AbortController | null>(null);
    function run(url: RequestInfo, init?: RequestInit) {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      return fetch(url, { ...init, signal: ctrl.signal });
    }
    useEffect(() => () => ctrlRef.current?.abort(), []);
    return { run, abort: () => ctrlRef.current?.abort() };
  }
  ```
- `creative-workspace`、`connection-modal`、`ideation-modal` 切换到此 hook
- `selectDocument` 切换章节前先 abort 旧请求
- 测试：组件测试模拟快速连点切换章节，断言 `fetch` 仅最后一次解析

**T1.4 · 批量生成限流感知**

- 新建 `lib/ai/batch-scheduler.ts`：
  ```ts
  export type BatchTask<T> = () => Promise<T>;
  export async function runBatch<T>(
    tasks: BatchTask<T>[],
    opts: { onProgress, onWait, signal },
  ): Promise<void>
  ```
- 特性：
  - 顺序执行（并发 1）
  - 捕获 HTTP 429，读 `Retry-After` 头，调用 `onWait(seconds)` 后 sleep
  - 通用错误连续 ≥3 次自动暂停并返回
  - 支持外部 signal 取消
- `batch-generate-modal`：
  - UI 新增 "等待限流重置 (12s)" 行
  - 429 后恢复时切回 running 态
- 测试：e2e mock provider 前 3 次返回 429，第 4 次 OK；断言 UI 正确显示等待态

**T1.5 · append 降级显式提示**

- `lib/ai/actions.js` 的 `applyResult` 返回 `{ content, downgraded: boolean }`
- API 响应 `data` 增加 `applyModeUsed: 'append' | 'replace'` 与 `downgraded`
- 前端若 `downgraded`，顶部条 5 秒 toast："原稿超 30KB，本次使用替换模式"
- 测试：actions 单元测试覆盖两条分支；e2e 省略（UI 已有 toast 测试）

**T1.6 · Modal 焦点陷阱**

- `components/ui/modal.tsx`：
  ```ts
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusables = () => dialog.querySelectorAll<HTMLElement>(
      'a, button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables()[0];
    first?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const items = focusables();
      const active = document.activeElement;
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && active === firstEl) { lastEl.focus(); e.preventDefault(); }
      else if (!e.shiftKey && active === lastEl) { firstEl.focus(); e.preventDefault(); }
    }
    dialog.addEventListener('keydown', trap);
    return () => {
      dialog.removeEventListener('keydown', trap);
      previousFocus?.focus?.();
    };
  }, [open]);
  ```
- 测试：组件测试触发打开→Tab 循环→关闭，断言焦点返回 trigger

**T1.7 · 脏态关闭确认**

- `IdeationModal` / `ConnectionModal` 增加 `dirty` 状态派生
- Modal 组件接受 `confirmCloseIfDirty?: () => boolean` 回调
- 若 dirty 且遮罩/ESC 触发关闭 → `window.confirm("有未保存的更改，确定放弃吗？")`
- 测试：e2e 输入内容 → ESC → 点消 → 内容仍在

**T1.8 · Error Boundary**

- 新建 `components/error-boundary.tsx`（class component，React 要求）：
  - `componentDidCatch` 生成 `errorId = crypto.randomUUID()`
  - `lib/log.ts` 打日志（若 Tier 3 未到位，先用简单 `console.error`）
  - 回退 UI：标题 + "复制错误 ID" 按钮 + "重试"（重置 state）
- 包裹：`app/page.tsx` 根容器 + 每个 Modal 的 children
- 测试：组件测试 throw 子组件，断言回退 UI；单元测试 errorId 唯一性

**T1.9 · scaffold 清理**

- 删除 `scaffold-generate-modal.tsx` 第 72-76 行的 no-op 重置：
  ```ts
  status: item.checked ? "waiting" as const : "waiting" as const,
  ```
  → 统一为 `status: "waiting" as const`
- 测试：不需要（纯重构）

**T1.10 · provider test loading**

- `connection-wizard.tsx` 测试按钮点击后本地 state `testing: boolean`
- loading 时：按钮禁用 + 文本 "测试中..." + 旋转 spinner
- 结果区域分色：成功绿、失败红、超时黄
- 测试：e2e 断言 testing 态 DOM 出现

### 1.3 Tier 1 验收

- `npm test` 全部通过（预计 62 + ~15 新增）
- `npm run test:e2e` 全部通过（现有 smoke 不回归）
- 手动注入：关网保存、批量 429、ESC 脏表单 → 行为符合预期
- commit: `fix(polish): tier 1 correctness & resilience`
- tag: `polish-tier-1`

---

## 2. Tier 2 · 价值功能

### 2.1 概览

| # | 能力 | 验收信号 |
|---|------|---------|
| T2.1 | Anthropic prompt caching | cache hit 在第二次调用 ≥ 60% |
| T2.2 | OpenAI 兼容 prefix 复用 | DeepSeek/GLM 等支持 cache 的 provider 复用 guardrails |
| T2.3 | AI 请求可取消 | 正在生成时"取消"按钮立即中断 |
| T2.4 | Token/延迟遥测 | 状态条显示 `1.2s · 2.3k→1.1k tokens` |
| T2.5 | Markdown 预览 / 分屏 | 三态切换正确渲染 |
| T2.6 | 章节搜索 | 下拉顶部搜索框过滤章节列表 |
| T2.7 | 导出 | 单章 .md + 全部合并 .txt（zip 延期） |
| T2.8 | 字数目标 ring | 编辑器标题旁 SVG 环进度 |

### 2.2 详细方案

**T2.1 · Anthropic prompt caching**

- `lib/ai/providers.js` 的 `callAnthropic`：
  ```js
  body: JSON.stringify({
    model, max_tokens,
    system: [
      { type: 'text', text: invocation.instructions,
        cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: invocation.prompt }],
  })
  ```
- 返回值新增 `usage`：从 `payload.usage` 提取 `input_tokens` / `output_tokens` / `cache_creation_input_tokens` / `cache_read_input_tokens`
- env kill-switch：`WEBNOVEL_DISABLE_PROMPT_CACHE=1` 时不加 `cache_control`
- 测试：单元测试 mock fetch，断言请求体含 `cache_control`；返回值含 `usage`

**T2.2 · OpenAI 兼容 prefix 复用**

- `lib/ai/actions.js` 抽取 `buildStaticPromptParts({ project, ideation, guardrails })` → 返回"稳定段"
- OpenAI 兼容调用把稳定段放 system，动态段放 user
- DeepSeek/Qwen/GLM 的 prefix cache 是基于内容哈希，我们只要保证 system 内容稳定即可自动命中；不需要额外 header（除 GLM `Authorization` 之后的 `X-Session-Id` 可选，暂不加）
- 测试：单元测试断言 system 段在两次调用间完全相同

**T2.3 · AI 请求可取消**

- 传播路径：
  - `components/creative-workspace.tsx` `runAi` 创建 `AbortController`，存到 ref
  - 发起请求带 signal
  - UI：`aiRunning` 期间编辑器顶部显示 "取消" 小按钮
- 服务端：
  - `app/api/projects/current/actions/route.ts` 把 `request.signal` 透传
  - `runDocumentAiAction` 接受 `{ signal }`
  - `invokeProviderModel` 接受 `{ signal }` 并传给 fetch
- 取消后前端：aiRunning=false；toast "已取消"；不回滚文档（因为还没写）
- 测试：e2e mock provider 慢速返回 5s，取消按钮点击 100ms 内 aiRunning=false

**T2.4 · Token/延迟遥测**

- `invokeProviderModel` 返回 `{ text, usage, latencyMs }`（所有 provider 统一）
- `actions.js` 的返回从 `string` 升级为 `{ text, usage, latencyMs }`；`generatedText` 继续兼容
- API response `data.lastCall = { latencyMs, usage, provider, model }`
- 前端 `components/bottom-bar.tsx` 右侧显示：`1.2s · 2.3k→1.1k tokens`
- localStorage key `webnovel-writer:ai-history`，保留最近 20 条
- 工具栏齿轮菜单加"显示 AI 调用"开关；开启后底部出现可折叠 history 面板
- 测试：单元测试断言 usage 被正确抽取；组件测试断言 bottom-bar 显示

**T2.5 · Markdown 预览 / 分屏**

- 新建 `components/markdown-preview.tsx`（零依赖，手写最小 Markdown 渲染器）
- 支持语法：
  - `#` / `##` / `###` 标题
  - `**bold**` / `*italic*`
  - `- list` / `1. list`
  - `> quote`
  - \`\`\`code\`\`\`
  - `---` 分割线
  - 空行分段
  - `[text](url)` 链接
- 严格 escape HTML；不支持任意 HTML 注入
- 编辑器工具栏右端加三态切换：`✎ 编辑 | ◨ 分屏 | ◪ 预览`
- 分屏：`grid-template-columns: 1fr 1fr`；预览滚动与编辑器同步（编辑器 scroll 百分比同步）
- 测试：组件测试覆盖各语法；e2e 切换预览断言 DOM

**T2.6 · 章节搜索**

- `components/bottom-bar.tsx` 的章节下拉顶部加 `<input placeholder="搜索章节...">`
- 过滤逻辑：`title.toLowerCase().includes(q) || fileName.includes(q) || chapterNumber.toString() === q`
- ArrowDown 聚焦第一个结果，Enter 选择
- 测试：组件测试键盘导航与过滤

**T2.7 · 导出**

- 新建 `app/api/projects/current/export/route.ts`：
  - `?format=md&file=xxx` → 单章 .md
  - `?format=txt-all` → 全部章节按序合并为一个 .txt（章与章之间两空行）
  - zip 延期（需要手写 PKZIP 头，本次不做）
- 新建 `components/export-menu.tsx`：下拉菜单（复用 dropdown 样式）
- 工具栏放入"导出"按钮（仅 project 存在且有章节时显示）
- 测试：API 路由单元测试；e2e 点击导出断言下载触发

**T2.8 · 字数目标 ring**

- 编辑器标题旁 SVG 环：`<svg 24×24><circle bg/><circle progress stroke-dasharray=/></svg>`
- 超过 100% 变金色 `#d4a017`
- tooltip：`1842 / 2500 字 (73%)`
- 测试：组件测试计算 stroke-dasharray

### 2.3 Tier 2 验收

- 所有 Tier 1 测试继续通过
- 新增 e2e：取消 AI、预览切换、搜索过滤、导出下载
- prompt caching 前后手动验证：相同章节调用两次，第二次 `cache_read_input_tokens > 0`
- commit: `feat(polish): tier 2 value features`
- tag: `polish-tier-2`

---

## 3. Tier 3 · 质量地基

### 3.1 概览

| # | 内容 | 验收信号 |
|---|------|---------|
| T3.1 | 结构化日志 | `npm run dev` 错误路径输出 JSON 单行 |
| T3.2 | Request id | 响应头含 `X-Request-Id` |
| T3.3 | RTL 组件测试 | `npm test` 包含 components/ 测试 |
| T3.4 | E2E 扩展 | 5 条新 spec 通过 |
| T3.5 | a11y 断言 | axe 0 critical |
| T3.6 | ARCHITECTURE.md | 文件存在且覆盖 6 层架构 |
| T3.7 | CONTRIBUTING.md | 文件存在含提交规范 |
| T3.8 | CHANGELOG 扩写 | 新增 2026-04-19 段，按 Tier 分小节 |
| T3.9 | ADR 目录 | ≥ 4 篇 |
| T3.10 | README 升级 | 质量基线徽章段 |

### 3.2 详细方案

**T3.1 · 结构化日志**

- 新建 `lib/log.ts`：
  ```ts
  type LogFields = Record<string, unknown>;
  function emit(level: 'info'|'warn'|'error', event: string, fields: LogFields = {}) {
    const base = { ts: new Date().toISOString(), level, event, ...fields };
    if (process.env.NODE_ENV === 'production') {
      process.stdout.write(JSON.stringify(base) + '\n');
    } else {
      const colors = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
      console.log(`${colors[level]}[${level}] ${event}\x1b[0m`, fields);
    }
  }
  export const log = {
    info: (e: string, f?: LogFields) => emit('info', e, f),
    warn: (e: string, f?: LogFields) => emit('warn', e, f),
    error: (e: string, f?: LogFields) => emit('error', e, f),
  };
  ```
- 所有 API route 在 `catch` 块打 `log.error('route_failed', { route, requestId, error: err.message })`
- 测试：单元测试 spy `process.stdout.write`，断言 JSON 格式

**T3.2 · Request id 中间件**

- 新建 `middleware.ts`：
  ```ts
  import { NextResponse } from 'next/server';
  export function middleware(req: Request) {
    const requestId = crypto.randomUUID();
    const res = NextResponse.next();
    res.headers.set('X-Request-Id', requestId);
    return res;
  }
  export const config = { matcher: '/api/:path*' };
  ```
- Route handler 通过 `request.headers.get('x-request-id')` 读取（middleware 写入 request 头需要 `NextResponse.next({ request: { headers } })`）
- 客户端错误 toast 加 "复制错误 ID" 按钮
- 测试：e2e 断言响应头

**T3.3 · RTL 组件测试扩充**

- 基础 RTL 环境已在 T1.0 建立，本项只负责扩充覆盖到剩余组件
- 补充组件测试：
  - `bottom-bar.test.mjs` — 章节搜索过滤（如 T2.6 实施时已写可跳过）
  - `editor-toolbar.test.mjs` — 插入粗体/标题/引用正确
  - `markdown-preview.test.mjs` — 各语法渲染正确、HTML escape
  - `export-menu.test.mjs` — 下拉与格式切换
  - `project-dropdown.test.mjs` — 键盘导航
- 目标：组件测试总数 ≥ 10 条，覆盖所有交互型组件

**T3.4 · E2E 扩展**

- 新建 spec：
  - `tests/e2e/dark-mode.spec.mjs` — 切换、持久化、系统偏好跟随
  - `tests/e2e/batch-generate.spec.mjs` — mock provider 成功 3 章
  - `tests/e2e/scaffold-generate.spec.mjs` — 勾选 + 取消、完成态
  - `tests/e2e/reference-analysis.spec.mjs` — 输入名称 → 生成
  - `tests/e2e/export.spec.mjs` — 单章 md、全合并 txt
- 所有 mock 通过 `page.route('/api/projects/current/actions', ...)` 拦截

**T3.5 · a11y 断言**

- devDep: `@axe-core/playwright`
- `tests/e2e/helpers/a11y.mjs`：
  ```js
  import { AxeBuilder } from '@axe-core/playwright';
  export async function assertNoAxeViolations(page, tag = 'page') {
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter(v => v.impact === 'critical');
    if (critical.length) throw new Error(`[${tag}] ${critical.length} critical a11y violations: ${JSON.stringify(critical, null, 2)}`);
  }
  ```
- 每条 e2e 末尾调用一次；Modal 打开态专项调用

**T3.6 · ARCHITECTURE.md**

- 结构：
  1. 总览图（ASCII）
  2. 单页 + 模态壳
  3. API 分层：route → lib → storage
  4. Provider 适配层：`invokeProviderModel` 派发
  5. 安全基线：加密、限流、SSRF、净化、锁
  6. Claude Code 子系统（`.claude/`）的边界说明

**T3.7 · CONTRIBUTING.md**

- 结构：
  1. 本地开发：`npm install && npm run dev`
  2. 测试要求：`npm test` + `npm run test:e2e` 全绿才能合并
  3. 提交规范：Conventional Commits（feat/fix/docs/refactor/test/chore）
  4. 安全要求：不要提交真实 API Key、`.env.local` 必在 `.gitignore`
  5. PR 检查清单：tsc 0、测试通过、CHANGELOG 更新、ADR 若架构决策

**T3.8 · CHANGELOG 扩写**

- 新增 `## 2026-04-19` 节，按 Tier 分小节；每 Tier 下分 Added/Fixed/Security/Perf/Docs

**T3.9 · ADR 目录**

- `docs/adr/TEMPLATE.md`
- `docs/adr/0001-single-page-shell.md` — 为什么单页 + 模态，而不是多路由
- `docs/adr/0002-aes-gcm-config-encryption.md` — 密钥存储方案
- `docs/adr/0003-no-runtime-deps.md` — 为什么坚持零运行时依赖
- `docs/adr/0004-prompt-caching.md` — prompt caching 的使用与 kill-switch

**T3.10 · README 升级**

- 顶部徽章：`tests 77 passing` / `tsc 0` / `e2e 5 specs`
- 新增 "质量基线" 段落指向 CHANGELOG

### 3.3 Tier 3 验收

- `npm test` 包含组件测试通过
- `npm run test:e2e` 5 条新 spec 通过 + axe 0 critical
- `ARCHITECTURE.md` / `CONTRIBUTING.md` / 4 篇 ADR 入库
- commit: `docs(polish): tier 3 quality foundation`
- tag: `polish-tier-3`

---

## 4. 全局验收矩阵（9.9 打分依据）

| 维度 | 基线 | 目标 | 验收命令 / 信号 |
|------|------|------|---------------|
| 正确性 | 62 tests / tsc 0 | +~15 组件 & 集成，0 Red | `npm test` |
| 韧性 | 多静默失败路径 | 全部失败可见 + 可恢复 | 手动注入 429 / 断网 |
| AI 质量 | 无缓存 / 无遥测 | cache hit ≥ 60%，token 面板可见 | 第二次调用日志 |
| UX | 仅编辑 | 预览/搜索/导出/取消/进度环 5 项 | E2E |
| 可观测 | 无 | JSON 日志 + requestId + 调用面板 | 日志 + UI |
| 测试 | smoke only | 5 条 E2E + 组件测试 + a11y | `test:e2e` |
| 文档 | README 150 行 | +ARCH/CONTRIB/ADR/CHANGELOG 扩写 | 文件存在 |
| 无障碍 | 部分 aria | 焦点陷阱 + 返回 + axe 0 critical | axe 报告 |

---

## 5. 回滚策略

- 每个 Tier 一个 commit + tag：`polish-tier-1`、`polish-tier-2`、`polish-tier-3`
- Tier 1 若回归：`git revert polish-tier-1`（理论上不影响 Tier 2/3，但建议同时回滚）
- Tier 2 prompt caching 受 `WEBNOVEL_DISABLE_PROMPT_CACHE=1` 控制，无需 revert
- Tier 3 纯加法（测试 + 文档），不会回归业务

---

## 6. 工作量与执行顺序

- **Tier 1**（10 项）→ 一份实施计划约 25-30 plan step
- **Tier 2**（8 项）→ 一份实施计划约 20-25 plan step
- **Tier 3**（10 项）→ 一份实施计划约 20 plan step

**推荐流程**：
1. 先为 Tier 1 写一份 `writing-plans` 产出的详细步骤
2. 实施 Tier 1 至全绿，commit + tag
3. 再为 Tier 2 写计划，实施，tag
4. 再为 Tier 3 写计划，实施，tag

每层独立闭环，任何一层中断都不会留半成品。

---

## 7. 开放问题（留给实施时决策）

- **T2.5 Markdown 渲染器**：目前方案是"手写最小子集"。如果实施时发现测试覆盖语法超过 500 行代码，考虑引入 `marked` 或 `micromark-core` 作为例外依赖。**触发阈值：渲染器代码 > 500 行**。
- **T2.7 导出 zip**：本次仅 .md + .txt。zip 延期到独立 plan。
- **T1.0 DOM shim**：优先 `linkedom`（~80KB），失败回退 `jsdom`（~10MB 但成熟）。在 Tier 1 实施第一天验证。
- **T3.2 middleware 兼容性**：Next.js 16 的 middleware 写入请求头的 API 稳定；若遇怪异行为，回退到 route handler 自行生成 requestId。

---

## 附录 A · 受影响文件清单

**新增**
- `lib/api/use-abortable-fetch.ts`
- `lib/ai/batch-scheduler.ts`
- `lib/log.ts`
- `middleware.ts`
- `components/error-boundary.tsx`
- `components/markdown-preview.tsx`
- `components/export-menu.tsx`
- `app/api/projects/current/export/route.ts`
- `tests/setup/dom.mjs`
- `tests/components/**/*.test.mjs`（≥ 5）
- `tests/e2e/{dark-mode,batch-generate,scaffold-generate,reference-analysis,export}.spec.mjs`
- `tests/e2e/helpers/a11y.mjs`
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `docs/adr/{TEMPLATE,0001,0002,0003,0004}.md`

**修改**
- `components/creative-workspace.tsx`（T1.1/T1.2/T1.3/T1.5/T2.3/T2.5/T2.8）
- `components/ui/modal.tsx`（T1.6/T1.8）
- `components/batch-generate-modal.tsx`（T1.4）
- `components/scaffold-generate-modal.tsx`（T1.9）
- `components/connection-wizard.tsx`（T1.10）
- `components/ideation-modal.tsx` / `connection-modal.tsx`（T1.7）
- `components/bottom-bar.tsx`（T2.4/T2.6）
- `components/editor-toolbar.tsx`（T2.5）
- `components/toolbar.tsx`（T2.7）
- `lib/ai/providers.js`（T2.1/T2.3/T2.4）
- `lib/ai/actions.js`（T1.5/T2.2/T2.3/T2.4）
- `app/api/projects/current/actions/route.ts`（T2.3/T3.1/T3.2）
- 所有 API route（T3.1/T3.2）
- `app/globals.css`（T1.1/T1.8/T2.5/T2.8）
- `app/page.tsx`（T1.8）
- `package.json`（T1.0 RTL devDeps、T3.5 axe devDep）
- `README.md`（T3.10）
- `CHANGELOG.md`（T3.8）

---

*本设计已获得用户批准。下一步：调用 `superpowers:writing-plans` 为 Tier 1 编写可执行计划，开始实施。*
