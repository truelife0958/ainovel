# Tier 4 精简整合 — 设计文档

**日期**：2026-04-19
**作者**：结对 brainstorm（Claude + 项目维护者）
**状态**：已用户批准设计；下一步写实施计划
**前置**：Tier 1/2/3 已完成并合并到 main（tags：`polish-tier-1`、`polish-tier-2`、`polish-tier-3`）

---

## 1. 目标与非目标

### 1.1 背景

前三个 Tier 以 "补能力" 为主（correctness、features、quality foundation）。合并后代码库已具备高水位，但在执行过程中累积了新的冗余：

- `lib/ai/prompt-cache.js` T2.2 时作为 helper 发布，从未接入 prompt builders。
- `lib/ai/repair-link.js` / `repair-request.js` 来自更早架构，UI 未接入。
- `@testing-library/user-event` 在 `tests/setup/react.mjs` 仅被再导出，无实际使用。
- 10 个 API route 各有 catch 块，18 处重复写了 `log.error` + `sanitizeErrorMessage` 的样板。
- 4 个 modal + 1 个 dropdown 各自手写 `new AbortController()` + loading/error state，T1 造的 `useAbortableFetch` 只在 `creative-workspace` 用了一处。
- `lib/ai/providers.js` 491 行里，9 家 provider 共享相同骨架（验密 → URL 校验 → 超时 + signal 链 → fetch → 计时 + 限长），却复制了 5 份实现。
- `app/globals.css` 2318 行末尾堆了 12 段 T1/T2 标注的小分区，应该归入上方已有逻辑章节。
- `components/creative-workspace.tsx` 555 行承担过多职责；`lib/ai/actions.js` 622 行里大部分是 prompt 字符串拼接。

### 1.2 目标

- **减少 ~500-700 行生产代码 + ~200 行测试**（死代码 + 样板）
- **统一 5 处 AbortController 重复**为 `useModalResource` hook
- **CSS 重分区**：消除末尾 12 段碎片，全部并入逻辑分区
- **3 个大文件拆分**：
  - `lib/ai/actions.js` → `lib/ai/prompts/`
  - `components/creative-workspace.tsx` → 三个 hooks
  - `components/connection-wizard.tsx`（可选，低优先级）
- 全部动作保持 **零用户可见行为变化**

### 1.3 非目标

- 不引入任何新依赖（包括 devDep）
- 不重做架构（单页 + 模态 + provider 适配层保持不变）
- 不删除 Tier 1-3 的 tag / plan / ADR 等历史制品
- 不改变 API 路由合同（请求/响应 JSON 形状不动）
- 不引入 Zustand/Redux 等状态库

### 1.4 总体约束

- 每个子任务保持 `npm test` 全绿 + `tsc --noEmit` 0 + `npm run build` 干净
- **Tier 4a 先行**（零行为变化的清理）：删死代码、抽 wrapper、合并 hook、CSS 重分区
- **Tier 4b 紧随**（结构重构）：provider adapter、prompts 拆分、workspace hooks
- 每个 Tier 独立分支 + tag，可独立回滚

---

## 2. Tier 4a · 零行为变化清理

### 2.1 任务清单

| # | 内容 | 文件 | 预计行数变化 |
|---|------|------|------------|
| T4.1 | 删 `prompt-cache.js` + `.d.ts` + 测试 | `lib/ai/prompt-cache.*`, `tests/ai/prompt-cache.test.mjs` | -120 |
| T4.2 | 删 `repair-link.js` + `repair-request.js` + 各自测试 | `lib/ai/repair-*.{js,d.ts}`, `tests/ai/repair-*.test.mjs` | -250 |
| T4.3 | 删 devDep `@testing-library/user-event` + 引用 | `package.json`, `tests/setup/react.mjs` | -2 + lockfile |
| T4.4 | 抽 `withRouteLogging(route, handler)` 高阶函数 | `lib/api/with-route-logging.ts`（新），10 个 route 文件 | -180（消除重复） |
| T4.5 | 抽 `useModalResource<T>(url, open)` hook | `lib/api/use-modal-resource.ts`（新），5 个消费者 | -50 净减 |
| T4.6 | CSS 重分区：12 段 T1/T2 末尾碎片合并进逻辑分区 | `app/globals.css` | 行数不变，可读性大升 |

### 2.2 关键实现决定

**T4.4 withRouteLogging 接口**

```ts
// lib/api/with-route-logging.ts
import { NextResponse } from "next/server";
import { log } from "@/lib/log.js";
import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";

export type RouteHandler = (request: Request, ctx: { requestId: string }) =>
  Promise<Response>;

export function withRouteLogging(
  routeLabel: string,
  handler: RouteHandler,
  fallbackMessage = "Unable to process request",
): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = request.headers.get("x-request-id") ?? "unknown";
    try {
      return await handler(request, { requestId });
    } catch (error) {
      if ((error as Error)?.name === "AbortError" || request.signal.aborted) {
        return NextResponse.json(
          { ok: false, error: "Request cancelled" },
          { status: 499 },
        );
      }
      log.error("route_failed", {
        route: routeLabel,
        requestId,
        error: (error as Error)?.message ?? String(error),
      });
      return NextResponse.json(
        { ok: false, error: sanitizeErrorMessage(error, fallbackMessage) },
        { status: 500 },
      );
    }
  };
}
```

每个路由由 ~30 行 try/catch 缩成 ~5 行包装调用。`actions` 路由的 499 分支由 `withRouteLogging` 统一处理。

**T4.5 useModalResource 接口**

```ts
// lib/api/use-modal-resource.ts
export type ModalResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
};

export function useModalResource<T>(url: string, open: boolean): ModalResourceState<T> {
  // 内部：持有 AbortController + loading/error + data
  // open → true：发起 fetch，用内部 controller 带 signal
  // open → false：abort，reset
  // retry：重新 fetch（保留 open 状态）
}
```

替换 `ideation-modal`、`connection-modal`、`review-modal`、`projects-modal`、`project-dropdown` 的重复初始化模式。

**T4.6 CSS 重分区映射**

| 末尾 Tier 分区 (废弃) | 并入到 |
|--------------------|---------|
| `Downgrade Notice (T1.5b)` | `AI Loading Spinner` 紧邻 |
| `Auto-save Error Toast (T1.1)` | `Save Toast` + `Auto-save indicator` 合成新"Auto-save feedback"段 |
| `Error Boundary Fallback (T1.8)` | `Error Pages` |
| `Button Spinner (T1.10)` | `Buttons` |
| `AI Cancel Button (T2.3)` | `AI Loading Spinner` |
| `AI Status Line (T2.4)` | `Bottom Bar` |
| `Markdown Preview (T2.5)` | `Textarea Enhancement` 前新建 "Editor Preview" 分区 |
| `Chapter Search (T2.6)` | `Bottom Bar` 或 `Dropdown` |
| `Export Menu (T2.7)` | `Toolbar` |
| `Word-count Ring (T2.8)` | `Word Count Progress` |
| `Dark Mode Refinements` (2032) | `Dark Mode` (39) |

合并原则：保留所有规则内容不变，仅移动位置 + 重写头注释。

### 2.3 Tier 4a 验收

- `npm test`：死代码删除后测试数减 ~14，其余全绿
- `npx tsc --noEmit`：0 错误
- `npm run build`：编译干净，路由仍是 15
- 手动验证：浏览器打开 → 切暗色 → 打开 modal → ESC → 刷新；样式不改变、API 行为不变
- commit: `refactor: tier 4a — drop dead code + extract route-logging / modal-resource hooks + CSS regroup`
- tag: `polish-tier-4a`

---

## 3. Tier 4b · 结构重构

### 3.1 任务清单

| # | 内容 | 文件 | 预计行数变化 |
|---|------|------|------------|
| T4.7 | `providers.js` 抽 `createProviderAdapter` 策略模式 | `lib/ai/providers.js` (重写) | 491 → ~340 |
| T4.8 | `actions.js` 拆分 prompts | `lib/ai/actions.js` (-350)、`lib/ai/prompts/{outline,chapter,setting,reference,_shared}.js`（新） | 总量不变 |
| T4.9 | `creative-workspace.tsx` 拆 hooks | `components/creative-workspace.tsx` (555 → ~300)、`components/hooks/{use-auto-save,use-ai-runner,use-keyboard-shortcuts}.ts`（新） | 总量不变 |

### 3.2 关键实现决定

**T4.7 createProviderAdapter 策略**

```js
// lib/ai/providers.js
function createAdapter({ defaultBaseUrl, buildRequest, extractText, extractUsage }) {
  return async function callAdapter(config, invocation) {
    const apiKey = getDecryptedApiKey(config, invocation.provider);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    if (invocation.signal) {
      if (invocation.signal.aborted) controller.abort();
      else invocation.signal.addEventListener("abort", () => controller.abort());
    }
    const startedAt = Date.now();
    try {
      const baseUrl = config.baseUrl || defaultBaseUrl;
      validateBaseUrl(baseUrl);
      const init = buildRequest({ apiKey, baseUrl, invocation });
      const response = await fetch(init.url, { ...init.fetchInit, signal: controller.signal });
      const payload = await parseJsonResponse(response);
      const text = extractText(payload);
      if (!text) throw new Error(`${invocation.provider} returned no text output`);
      const MAX = 500000;
      return {
        text: text.slice(0, MAX),
        usage: extractUsage(payload),
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

const callOpenAi = createAdapter({
  defaultBaseUrl: "https://api.openai.com/v1",
  buildRequest: ({ apiKey, baseUrl, invocation }) => ({
    url: joinUrl(baseUrl, "/responses"),
    fetchInit: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: invocation.model,
        instructions: invocation.instructions,
        input: invocation.prompt,
      }),
    },
  }),
  extractText: extractOpenAiText,
  extractUsage: (p) => p.usage || null,
});

// Anthropic 保留自己的 cache_control 注入逻辑；其他 OpenAI 兼容 9 行声明即可。
```

预期：5 个 call 函数（OpenAI、Anthropic、OpenRouter、OpenAiCompatible、Gemini）+ 4 个 thin wrapper（DeepSeek/Qwen/GLM/Mistral）合成 5 个 createAdapter 声明 + 4 个 wrapper。Anthropic 的 `cache_control` 逻辑单独保留 15 行。

**T4.8 prompts 拆分结构**

```
lib/ai/prompts/
  _shared.js       formatSummary / formatIdeation / formatDocument / formatContext
  outline.js       buildOutlinePrompt
  chapter.js       chapterBriefTemplate + buildChapterPlanPrompt + buildChapterWritePrompt
  setting.js       buildSettingPrompt (6 个 mode)
  reference.js     buildReferenceAnalysisPrompt
  index.js         导出 buildPrompt(input) 分发器
```

`actions.js` 仅保留 `applyResult`、`modeRole`、`modeInstructions`、`runDocumentAiAction`；buildPrompt 从 `./prompts` 引入。

**T4.9 creative-workspace hooks**

```
components/hooks/
  use-auto-save.ts        迁出 T1.1 的 autoSaveFailures + effect + retry toast 状态
  use-ai-runner.ts        迁出 T2.3 的 runAi + aiAbortRef + downgradeNotice
  use-keyboard-shortcuts.ts  迁出 Ctrl+S / Ctrl+B / Escape 处理
```

`creative-workspace.tsx` 留下核心状态（selectedDocument/chapterContent/briefContent/viewMode）+ render 分发。

### 3.3 Tier 4b 验收

- `npm test`：137 → ≥137（hooks 抽出后新增测试覆盖）
- `npx tsc --noEmit`：0
- `npm run build`：编译干净
- 手动浏览器回归：4a 的所有用例继续通过；AI 批量 + 单章生成路径不变
- commit: `refactor: tier 4b — provider adapter + prompts split + workspace hooks`
- tag: `polish-tier-4b`

---

## 4. 风险与回滚

### 4.1 具体风险点

| 任务 | 风险 | 缓解 |
|------|------|------|
| T4.1 删 prompt-cache | 未来接入 prompt builders 时丢失代码 | git 历史保留；`polish-tier-2` tag 可复原；删得果断 |
| T4.4 withRouteLogging | route handler 改写回归 | 逐路由转换 + 每次 smoke；rate-limit/sanitize 顺序用断言覆盖 |
| T4.5 useModalResource | 5 个 modal 行为差异 | hook 签名保留 `retry()`；逐个迁移；每次 tsc + test |
| T4.7 providers 策略重构 | 9 家 API 签名微差 | adapter 接受 `buildRequest` + `extractText/Usage` 三个策略；Anthropic cache_control 保留；现有 Anthropic 3 个 cache 测试是回归锚点 |
| T4.8 拆 prompts | 循环依赖 | `_shared.js` 只导出无状态函数；prompt 文件只从 `_shared` 导入，不互相引用 |
| T4.9 拆 workspace hooks | 接触面最大 | 三个 hooks 各自单元测试 + tsc 0；分三个 commit，每 commit 跑一次 smoke |
| T4.6 CSS 重分区 | 选择器优先级 cascade 变化 | grep 确保每类名只一处；重分区后手动浏览器回归；Playwright dark-mode/export 两条 E2E 作为 gate |

### 4.2 回滚

- **Tier 4a** 问题：`git revert <merge-4a>`；不影响 Tier 1-3
- **Tier 4b** 问题：`git revert <merge-4b>`；4a 保留
- 任一子任务独立 commit，必要时 cherry-revert
- 大重构前打 tag `pre-t4b-refactor` 作为保险点

---

## 5. 分支拓扑

```
main (合并 Tier 1-3 后稳态，commit 988686d)
  └── polish/tier-4a
        ├── T4.1 .. T4.6 (6 commits)
        │    验证 → merge 回 main，tag polish-tier-4a
        └── polish/tier-4b
              ├── T4.7 .. T4.9 (3 commits)
              │    验证 → merge 回 main，tag polish-tier-4b
              └── 总 tag polish-tier-4 指向 4b merge commit
```

---

## 6. 工作量

- **Tier 4a**：6 任务 ≈ 一份实施计划 ≈ 15-18 个 plan step（主要是机械清理）
- **Tier 4b**：3 任务 ≈ 一份实施计划 ≈ 20-25 个 plan step（需仔细拆分 + 每拆一个跑 smoke）

**推荐**：为 4a 写 plan 并落地至全绿 → 再为 4b 写 plan → 实施 → tag。

---

## 7. 开放问题（留给实施时决策）

- **T4.9 creative-workspace**：拆出 hooks 后，`creative-workspace.tsx` 的 JSX 仍可能 300 行。如果拆完后单文件 > 400 行，再拆出子组件（如 `EditorBody`、`EditorMeta`）—— **触发阈值：拆完 > 400 行**。
- **T4.7 adapter**：OpenAI 的 `/responses` vs OpenRouter 的 `/chat/completions` 端点差异大（前者 instructions+input，后者 messages 数组）。若 adapter 抽象导致 Anthropic 独立分支超过 30 行，放弃该家的 adapter 化，让 `callAnthropic` 保留手写。
- **Tier 4c**（可选，不在本次范围）：若 4a+4b 完成后发现 CHANGELOG / README 需要再次调整，那是 Tier 4c 的工作，不在本次 spec 覆盖。

---

## 附录 A · 受影响文件清单

**删除（Tier 4a）**
- `lib/ai/prompt-cache.js` / `.d.ts`
- `lib/ai/repair-link.js` / `.d.ts`
- `lib/ai/repair-request.js` / `.d.ts`
- `tests/ai/prompt-cache.test.mjs`
- `tests/ai/repair-link.test.mjs`
- `tests/ai/repair-request.test.mjs`

**新增（Tier 4a）**
- `lib/api/with-route-logging.ts`
- `lib/api/use-modal-resource.ts`

**新增（Tier 4b）**
- `lib/ai/prompts/_shared.js` / `.d.ts`
- `lib/ai/prompts/outline.js` / `.d.ts`
- `lib/ai/prompts/chapter.js` / `.d.ts`
- `lib/ai/prompts/setting.js` / `.d.ts`
- `lib/ai/prompts/reference.js` / `.d.ts`
- `lib/ai/prompts/index.js` / `.d.ts`
- `components/hooks/use-auto-save.ts`
- `components/hooks/use-ai-runner.ts`
- `components/hooks/use-keyboard-shortcuts.ts`

**修改**（Tier 4a）
- 10 个 API route：`app/api/**/route.ts`
- 5 个消费 modal resource：`components/{connection,ideation,review,projects}-modal.tsx`、`components/project-dropdown.tsx`
- `app/globals.css` 重分区
- `package.json` 删 devDep
- `tests/setup/react.mjs` 删 userEvent 导出

**修改**（Tier 4b）
- `lib/ai/providers.js` 改为 adapter 声明
- `lib/ai/actions.js` buildPrompt 改为 `./prompts` import
- `components/creative-workspace.tsx` 消费三个 hooks

---

*本设计已获得用户批准。下一步：调用 `superpowers:writing-plans` 为 Tier 4a 编写可执行计划，开始实施。*
