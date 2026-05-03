# Tier 6 Audit Report — 2026-05-03

**对应设计**：`docs/superpowers/specs/2026-05-03-tier-6-design.md`
**基线 commit**：`dea7eb1`（`docs(spec): Tier 6 design`）+ `b8b0455`（`docs(plan): Pass 1 plan`）
**Pass 1 commit**：`56c61be`（`docs(audit): Tier 6 Pass 1 closeout — 17 findings + 4 sub-tier candidates`）
**Pass 1 tag**：`tier-6-audit`

---

## 0. 基线快照

| 项目 | 值 |
|------|-----|
| Node | v22.22.2 |
| npm | 10.9.7 |
| Next | 16.1.7（`package.json` `dependencies.next`） |
| React | 19.2.0 |
| TypeScript | 5.9.3 |
| `tsc --noEmit` exit | 0 |
| `tsc --noEmit` 耗时 | real 1.828s（user 3.023s） |
| `npm test` 总数 | 134 pass / 0 fail / 0 skipped |
| `npm test` 耗时 | duration_ms 2380（real 2.609s） |
| Git 工作树 | clean（pre-Pass 1） |
| `npm ci` 提示 | 2 vulnerabilities（1 moderate, 1 high）— 详见 §4.1（Task 7） |

## 1. 性能 & Bundle

### 1.1 `npm run build` 静态产物

**构建器**：Next.js 16.1.7 + Turbopack

**重要观察**：Next 16 + Turbopack 的默认 build 输出**不再打印路由级 First Load JS 列**（仅列路由名 + 静态/动态标记）。本节的字节数从 `.next/build-manifest.json` + `.next/static/chunks/*.js` 实测。

**路由清单（15 条）**

```
Route (app)
┌ ƒ /                                       ← homepage (dynamic)
├ ○ /_not-found                             ← static
├ ƒ /api/projects
├ ƒ /api/projects/current
├ ƒ /api/projects/current/actions
├ ƒ /api/projects/current/briefs
├ ƒ /api/projects/current/context
├ ƒ /api/projects/current/documents
├ ƒ /api/projects/current/export
├ ƒ /api/projects/current/ideation
├ ƒ /api/projects/current/review
├ ƒ /api/settings/providers
├ ƒ /api/settings/providers/test
└ ○ /icon.svg                               ← static

ƒ Proxy (Middleware)
```

**Page-load chunk 分布（rootMain + polyfill，对所有页面共载）**

| chunk | raw | gzip |
|-------|-----:|------:|
| 396f90e8b7ccb31f.js | 224,636 B (220 KB) | **70,066 B (68 KB)** |
| 24eda359065fdf45.js | 131,658 B (129 KB) | 36,009 B (35 KB) |
| a6dad97d9634a72d.js (polyfills) | 112,594 B (110 KB) | 39,499 B (39 KB) |
| 68a088aa49e6124a.js | 33,724 B (33 KB) | 7,351 B (7 KB) |
| turbopack-3377a737344e67ee.js | 10,232 B | 4,051 B |
| 7f87a2b7b5fd9ec8.js | 9,925 B | 3,113 B |
| **总计（concat 后 gzip）** | **522,769 B (511 KB)** | **157,585 B (154 KB)** |

**构建警告（1 条）**

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
   https://nextjs.org/docs/messages/middleware-to-proxy
```

**构建耗时**：compile 2.8s + 静态页生成 258.8ms

**判定（对照设计 §2.3 阈值）：**

- 首页（`/`）First Load JS：**≈ 154 KB gzipped**，目标 ≤ 90 KB / 红线 > 130 KB → **🔴 红线超出**（154 > 130，触发 sub-tier 6.1 候选）
- 任一路由 First Load JS（按页面共载估）：**≈ 154 KB gzipped**，目标 ≤ 110 KB / 红线 > 160 KB → 🟡 警告区（154 在 110–160 之间）
- 构建警告：**1 条**（middleware → proxy 迁移）→ 🟡 sub-tier 6.4 候选（DX / 文档同步）

> ⚠ 注意：本节字节数是"page-load chunk 集合 concat 后 gzip"，与浏览器实际并行下载多份 .js.gz 的体积有偏差（实际可能略小，因为浏览器有缓存命中、HTTP/2 头压缩）。Task 5 用 `@next/bundle-analyzer` 的 client.html `parsedSize` 与 `gzipSize` 字段做精确归因。

### 1.2 Bundle composition（`ANALYZE=1 npm run build` + `--webpack`）

**重要兼容性发现**：`@next/bundle-analyzer@16.2.4` 是 webpack-only 插件；Next 16 默认用 **Turbopack** 构建，因此 `ANALYZE=1 npm run build` 时插件被静默忽略，**不产出任何 html 报告**。需要 `next build --webpack` 显式切换才能让 analyzer 生效。

切到 `--webpack` 后 build 在 TypeScript / 静态页生成阶段失败：

```
> Build failed because of webpack errors

ModuleParseError: Webpack supports "data:" and "file:" URIs by default.
You may need an additional plugin to handle "node:" URIs.

Import trace:
  node:path
  ./lib/utils.js
  ./components/creative-workspace.tsx
```

但 `@next/bundle-analyzer` 在 webpack 失败之前已经写完了 3 份 html 报告，仍可用于模块归因。**生产实际跑的是 Turbopack 路径，154 KB gz 是真实的产出大小（§1.1）；以下数据用于 attribution 而非生产体积**。

**Top 10 client modules（webpack analyzer / `static/chunks/*.js`）**

| parsed | gzip | chunk | source |
|-------:|-----:|-------|--------|
| 193.8 KB | **60.8 KB** | `4bd1b696-*.js` | `node_modules/next/dist/compiled/react-dom/cjs` |
| 185.1 KB | **58.3 KB** | `framework-*.js` | `node_modules` |
| 182.9 KB | **47.7 KB** | `794-*.js` | `node_modules` |
| 130.0 KB | **37.0 KB** | `main-*.js` | `node_modules` |
| 74.1 KB | **23.5 KB** | `app/page-*.js` | `components/` |
| 8.4 KB | 3.4 KB | `500-*.js` | `node_modules/next/dist` |
| 0.4 KB | 0.3 KB | `app/global-error-*.js` | `app/` |
| 0.3 KB | 0.3 KB | `app/error-*.js` | `app/` |
| 0.0 KB | 0.0 KB | `app/layout-*.js` | `app/` |

**Top 10 server / nodejs modules**

| parsed | gzip | chunk | source |
|-------:|-----:|-------|--------|
| 270.4 KB | 65.2 KB | `256.js` | `node_modules` |
| 138.2 KB | 37.9 KB | `445.js` | `node_modules/next/dist` |
| 107.9 KB | 34.9 KB | `app/page.js` | entry modules (concatenated) |
| 30.4 KB | 10.2 KB | `868.js` | `node_modules/next/dist` |
| 25.5 KB | 10.2 KB | `813.js` | `node_modules/next/dist` |
| 23.0 KB | 7.7 KB | `app/_global-error/page.js` | entry |
| 22.4 KB | 7.5 KB | `app/_not-found/page.js` | entry |
| 10.3 KB | 4.5 KB | `433.js` | `lib/` |
| 4.7 KB | 2.2 KB | `app/api/projects/current/ideation/route.js` | `lib/` |
| 4.1 KB | 2.0 KB | `app/api/projects/current/route.js` | `lib/` |

**Edge runtime middleware**

| parsed | gzip | chunk | source |
|-------:|-----:|-------|--------|
| 58.2 KB | 19.1 KB | `middleware.js` | `node_modules/next/dist` |

**模块归因（推断 §1.1 154 KB gz 的构成）**

> 注：webpack 与 Turbopack 的 chunking 策略不同，下表是粗略推断而非精确映射。

| 来源 | 估算占比（gz） | 控制成本 |
|------|--------------:|----------|
| react-dom | ~60 KB | ⚠️ 框架核心，不能砍 |
| Next 框架 chunk | ~58 KB | ⚠️ 框架核心，不能砍 |
| polyfills | ~39 KB | 🟡 可以瘦身（targeting 现代 browser 减 polyfill） |
| 业务 page + components | ~23 KB | ✅ 可以拆分（dynamic import 重型 modal） |
| 其它 | ~10 KB | — |
| **合计** | **~190 KB**（gz 之和，未压缩比 Turbopack 总 gz 大；因 webpack 与 Turbopack chunk 划分差异） | |

**判定（对照设计 §2.2 触发条件）：**

设计 §2.2 规定 sub-tier 6.1 触发条件：① 任一路由 First Load JS 超 §2.3 红线；② 单 module 占该路由 chunk ≥ 30% 且不属于 `next` / `react` / `react-dom` 框架包。

- ① 已在 §1.1 触发：154 KB gz > 130 KB 红线 → **6.1 候选成立**
- ② 单 module 占比 ≥ 30%：
  - `react-dom` 60.8 / 154 ≈ 39%（属框架包，**不算**）
  - `framework` 58.3 / 154 ≈ 38%（属 next 框架，**不算**）
  - polyfills 39.5 / 154 ≈ 26%（小于 30% 阈值，且属浏览器 polyfill，归类为框架）
  - 业务代码（components）23.5 KB ≈ 15%
  - 没有非框架包 ≥ 30% 单 module → **②不触发**
- 结论：sub-tier 6.1 仅由①触发，根因是页面常载量本身偏大（主要是 polyfills + framework + react-dom 的组合累计），缺乏单点 30%+ "巨无霸"。优化空间偏向降级 polyfill 目标 + 拆分页面级 dynamic import；改造 ROI 中等。

**附加 finding**：`lib/utils.js` 用 `import "node:path"`（明确指定 node 协议）；该 URI 在 Turbopack 上无碍，但 webpack 默认不支持，导致 `next build --webpack` 失败。这是 sub-tier 6.4 候选（DX / 兼容性）。

## 2. a11y

### 2.1 测试范围
- 已有 E2E（`tests/e2e/*.spec.mjs`）通过 `helpers/a11y.mjs` 的 `assertNoAxeCriticalViolations`：仅 critical 失败、serious / moderate 走 `console.warn`。
- 本次 Pass 1 Task 8 临时创建 `tests/e2e/_audit-a11y.spec.mjs` 把 critical + serious + moderate 全部抓出来；跑完即删，**不进 commit**（已用 `git status --porcelain | grep _audit-a11y` 确认 exit=1）。
- 扫描点：`/` 首屏初始态（`home:initial`）+ 主题 toggle 后（`home:theme-toggled`）。

### 2.2 扩级结果

总数：**4 条 violations**（去重后 **2 个根因**，每个根因在 2 个扫描点重复出现）。

| impact | id | help | tag | nodes | sample selector |
|--------|----|------|-----|-------|-----------------|
| critical | `aria-allowed-attr` | Elements must only use supported ARIA attributes | `home:initial` | 2 | `header > .dropdown-container[aria-haspopup="listbox"]` |
| critical | `aria-allowed-attr` | （同上） | `home:theme-toggled` | 2 | （同上） |
| moderate | `page-has-heading-one` | Page should contain a level-one heading | `home:initial` | 1 | `html` |
| moderate | `page-has-heading-one` | （同上） | `home:theme-toggled` | 1 | （同上） |

### 2.3 根因初判

1. **`aria-allowed-attr` × 2 nodes**：`header > .dropdown-container` 元素带 `aria-haspopup="listbox"`，但该元素的 role 或类型不支持 `aria-haspopup`。修复方向之一：
   - 选 a：把 `.dropdown-container` 的 role 显式改为 `combobox` / `button`（这两个 role 允许 `aria-haspopup`）
   - 选 b：把 `aria-haspopup` 移到嵌套的 `<button>` 元素上（dropdown 触发按钮才是合理位置）
   - 选 c：删 `aria-haspopup`，改用 `aria-controls` + `aria-expanded`

2. **`page-has-heading-one`**：整页没有 `<h1>`。toolbar 顶部目前用 `<header>` + 项目名等，但没有 semantic h1。修复方向：把项目名 / 应用名包成 `<h1>`（可视觉隐藏，仅给 SR 读）。

### 2.4 与 §3.1 E2E fail 的关系

§3.1 的 3 个 E2E fail（`dark-mode:toggle` / `dark-mode:system` / `export:menu-open`）报的也是 `aria-allowed-attr × 2 nodes`，**同一个根因**。修 §2.3 选 a/b/c 任一即可同时让 §3.1 那 3 处恢复绿。也就是说 sub-tier 6.2 修复一处可同时解决 §2.3 + §3.1.a11y。

### 2.5 判定（对照设计 §2.3 阈值）

- critical + serious：**2 个根因（共 4 nodes）** → 🔴 红线（目标 0 / 红线 ≥ 1）→ **sub-tier 6.2 候选 (高，预估 S 工作量)**
- moderate：**1 个根因（共 2 occurrences，2 nodes）** → 🟢 不在红线（< 5 条无说明）；可低成本修复（添加 visually-hidden h1，~5 行 JSX + CSS）→ **sub-tier 6.2 候选 (中，S 工作量)**

> **覆盖范围限制**：本次 a11y 扫只扫了 `/` 首屏 + 主题切换两个状态。模态框打开后（如 export menu）的 a11y 状态没扩级扫到 —— §3.1 通过 E2E 间接观测到 export 菜单打开后也有同样的 `aria-allowed-attr` critical（同一个 dropdown 组件），但 a11y serious / moderate 范围内的额外问题（如对话框焦点序、aria-modal 缺失）需要 sub-tier 6.2 的实施计划阶段在更多交互点上做扫描。本次 Pass 1 不深入。



## 3. 测试覆盖与缺口

### 3.1 E2E 跑（mock AI，不含 live-ai）

**重大 finding**：实测结果与 README 标榜的 *"134 tests passing · 6 Playwright E2E specs · axe-core critical = 0"* 之间存在显著漂移。

| 指标 | README 标榜 | 实测（2026-05-03） |
|------|-------------|---------------------|
| 单元 + 组件测试 | 134 passing | ✅ **134/134** 一致 |
| E2E specs | 6 | 实际有 **7 个 spec 文件**（含 `app-smoke`），共 **11 个 test 用例** |
| E2E pass / fail / skip | 全绿 | **1 passed / 4 failed / 6 skipped** ⚠️ |
| axe-core critical | 0 violation | **3 处 critical 违例触发失败** ⚠️ |

**11 个测试用例的明细**

| # | spec | 用例 | 结果 | 详情 |
|---|------|------|------|------|
| 1 | `app-smoke.spec.mjs:45` | legacy routes redirect to home | ✓ pass (5.3s) | — |
| 2 | `app-smoke.spec.mjs:52` | covers toolbar, modals, editor bottom actions, and API-backed persistence | ✘ FAIL (21.5s) | `TimeoutError`：`.project-row` 内 `getByRole('button', { name: '切换' })` 10s 内未找到。`app-smoke.spec.mjs:76`。**非 a11y 错误**，UI 选择器漂移或项目列表为空 |
| 3 | `batch-generate.spec.mjs` | 3-chapter mocked run completes | - SKIP | 跳过原因待查（疑似缺少 mock 上游或前置数据） |
| 4 | `dark-mode.spec.mjs:5` | toggle persists across reload | ✘ FAIL (2.6s) | **axe critical**：`aria-allowed-attr` × 2 nodes（`Elements must only use supported ARIA attributes`） |
| 5 | `dark-mode.spec.mjs:20` | system preference honored when no manual preference stored | ✘ FAIL (2.0s) | 同上 axe critical `aria-allowed-attr` × 2 |
| 6 | `export.spec.mjs:5` | opens and lists two items when a project exists | ✘ FAIL (2.1s) | 同上 axe critical `aria-allowed-attr` × 2（点开 export 菜单后） |
| 7 | `live-ai.spec.mjs:23` | @live-ai enables AI actions ... | - SKIP | `@live-ai` 标签默认过滤（无 API key） |
| 8 | `live-ai.spec.mjs:65` | @live-ai review repair loop ... | - SKIP | 同上 |
| 9 | `live-ai.spec.mjs:109` | @live-ai outline planning ... | - SKIP | 同上 |
| 10 | `reference-analysis.spec.mjs` | renders mocked analysis output | - SKIP | 跳过原因待查 |
| 11 | `scaffold-generate.spec.mjs` | generates checked items | - SKIP | 跳过原因待查 |

**总耗时**：3.1 分钟（其中失败 + 重试占用大量时间）

**非 critical（moderate）axe 提示**（来自 helper console.warn，未触发失败）：

```
[a11y:dark-mode:toggle]  1 non-critical finding(s): page-has-heading-one(moderate) ×1
[a11y:dark-mode:system]  1 non-critical finding(s): page-has-heading-one(moderate) ×1
[a11y:export:menu-open]  1 non-critical finding(s): page-has-heading-one(moderate) ×1
```

**判定（对照设计 §2.3 阈值）：**
- E2E 全绿（不变量 I5）：**🔴 失败** — 4 个用例 fail。这是必须立即记入 finding 的高优先级问题。
- axe-core critical：3 处违例（每处 2 nodes）→ **🔴 红线** （目标 0 / 红线 ≥ 1）→ **触发 sub-tier 6.2 候选 (高)**
- axe-core moderate：3 条 `page-has-heading-one`（每页一条）→ **🟡 警告区**（< 5 条但已有连续 3 处）→ **触发 sub-tier 6.2 候选 (中)**
- E2E 选择器漂移（`app-smoke:76` 找不到"切换"按钮）：**🔴 行为回归** → **触发 sub-tier 6.3 候选 (高)**
- 6 个用例被 skip（其中 3 个非 live-ai 应能跑）：**🟡 覆盖率黑洞** → **触发 sub-tier 6.3 候选 (中)**

**结论**：Pass 2 sub-tier 6.2 + 6.3 已被强证据触发。具体修复（包括 `aria-allowed-attr` 的根因定位、`app-smoke:76` 选择器修复、batch/reference/scaffold 三 spec 跳过原因） 留给 Pass 2 各 sub-tier 实施计划。

**注意**：本次 E2E 运行需要 `env -u HTTP_PROXY HTTPS_PROXY http_proxy https_proxy`，否则 Playwright 的 webServer 端口探测因系统级 HTTP 代理（`http://127.0.0.1:10808`）返回 503 而误判端口已占用 → spec 全部不执行。这一点也是 DX finding（详见 §4.2）。

### 3.2 单元 + 组件覆盖率（`npm run test:coverage`）

**c8 配置**：`--include=lib --include=app --exclude=tests --exclude=**/*.test.mjs`

**Coverage summary**

```
Statements   : 83.13% ( 2952/3551 )
Branches     :  68.60% (  518/ 755 )
Functions    : 88.62% (  148/ 167 )
Lines        : 83.13% ( 2952/3551 )
```

**重要观察**：c8 只采到 `lib/` 下的文件覆盖率。`app/api/**/route.ts` 由于：① 是 TS 文件，运行时由 Next 服务端编译；② 单元测试不直接 import；③ 实际通过 Playwright E2E 运行（c8 没包到 E2E 进程）—— 没有进入覆盖率统计。这是**统计盲区**而非"未覆盖"，但属于一项 reporting finding。

**关键目录覆盖率（lib/ai / lib/projects / lib/settings 等）**

| 目录 | Stmt | Branch | Func | Line |
|------|------|--------|------|------|
| lib | 100% | 85.71% | 100% | 100% |
| lib/ai | 77.64% | **73.29%** | 67.5% | 77.64% |
| lib/ai/prompts | 56.58% | **37.5%** | 81.81% | 56.58% |
| lib/editor | 100% | 100% | 100% | 100% |
| lib/projects | 90.33% | **62.9%** | 97.5% | 90.33% |
| lib/review | 100% | 100% | 100% | 100% |
| lib/settings | 84.95% | 75% | 90.9% | 84.95% |
| lib/ui | 100% | 100% | 100% | 100% |

**Branch coverage 最低 10 文件**

| 排名 | branch% | 文件 | 备注 |
|------|--------:|------|------|
| 1 | 22.72% | `lib/ai/prompts/_shared.js` | 共享 prompt 工具，分支基本未走 |
| 2 | 27.77% | `lib/projects/state.js` | state 工具，分支盲点 |
| 3 | 28.35% | `lib/projects/review.js` | review 序列化逻辑分支 |
| 4 | 30.76% | `lib/ai/prompts/chapter.js` | 章节 prompt 分支 |
| 5 | 45.94% | `lib/ai/providers.js` | 9-provider adapter，多数分支未走 |
| 6 | 50.00% | `lib/ai/prompts/outline.js` | outline prompt 分支 |
| 7 | 50.00% | `lib/projects/workspace.js` | workspace 状态机分支 |
| 8 | 57.14% | `lib/projects/file-lock.js` | 文件锁错误路径 |
| 9 | 66.66% | `lib/projects/context.js` | 上下文构建分支 |
| 10 | 66.66% | `lib/projects/documents.js` | document IO 分支 |

**Statement coverage 极低文件**（statement < 10%，意味着函数体几乎从未被调用）

| stmt% | 文件 | 备注 |
|------:|------|------|
| 2.29% | `lib/ai/prompts/setting.js` | setting prompt 模块，单测无 import |
| 5.88% | `lib/ai/prompts/reference.js` | reference prompt 模块，单测无 import |

> 这两个文件 branch% 显示 100% 是因为分母极小（只跑过 default export 行），不代表真覆盖。

**判定（对照设计 §2.3 阈值）：**

- Statement coverage（`lib/` 整体）：**83.13%** → ✅ 满足 ≥ 80% 目标。
- Statement coverage（`app/api`）：**未测量**（c8 盲区）→ 🟡 sub-tier 6.3 候选 (中)：把 app/api 路由放进可测范围（要么改 unit-level，要么把 c8 包到 E2E 进程）。
- Branch coverage（`lib/ai`）：**73.29%** → 🟡 just below 75% target，目标线擦肩；不触发红线。
- Branch coverage（`lib/projects`）：**62.9%** → 🟡 警告区（介于 60% 红线和 75% 目标之间）；优先级中等。
- Branch coverage（`lib/api`）：n/a，本仓不存在 `lib/api` 子目录（API 路由都在 `app/api/**`）—— 设计文档此项原本指错；改为读 `app/api` 但因 c8 盲区也无法直接量化。
- 极低覆盖文件：5 个 branch < 50%，2 个 statement < 10% → **触发 sub-tier 6.3 候选 (高)**，可针对性补 7 个文件的单测，预估 M 级工作量。
- E2E 路径缺口：见 §3.1 已记录的 4 fail + 6 skip → 与 6.3 共修。

**6.3 触发结论**：sub-tier 6.3 候选成立，主因是 §3.1 的 E2E 红 + §3.2 的 7 个文件低 branch；ROI 中。

---

## 4. 安全 & DX

### 4.1 npm audit

**Runtime-only**（`npm audit --omit=dev`）

```json
{
  "info": 0,
  "low": 0,
  "moderate": 1,
  "high": 1,
  "critical": 0,
  "total": 2
}
```

**Full（含 devDeps）** —— 所有 advisories 都在 runtime 路径里，dev 路径无新增。

```json
{
  "info": 0,
  "low": 0,
  "moderate": 1,
  "high": 1,
  "critical": 0,
  "total": 2
}
```

**Advisories 明细**

| pkg | severity | CVE | 标题 | 受影响 range | 当前 | 修复 |
|-----|----------|-----|------|-------------|------|------|
| `next` | **high** | [GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3)（CWE-770） | Denial of Service with Server Components | 9.3.4-canary.0 — 16.3.0-canary.5 | `^16.1.7` ⚠️ 在范围内 | `npm audit fix` 可升 minor |
| `postcss` | **moderate** | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)（CWE-79） | XSS via Unescaped `</style>` in CSS Stringify | < 8.5.10 | 通过 `next` 间接引入 | 升级 `next` 即随之解决 |

**判定（对照设计 §2.3 阈值）：**

- Runtime `high` advisory：**1** → 🔴 **红线触发**（目标 0 / 红线 ≥ 1）→ **sub-tier 6.4 候选 (高)**
- Runtime `critical` advisory：0 → ✅
- Dev `high` advisory：0 → ✅（实际所有 high 都在 runtime 树）
- 修复路径：`npm install next@latest` 或 `npm audit fix`，预估 S 工作量；但需 Pass 2 验证升级后 build / 测试 / E2E 不退化（Next 16 minor 版本之间通常稳定，但 16.1 → 16.3 期间引入了"middleware → proxy" 迁移建议——见 §1.1 build warning，可能也在 16.3 实际生效）。



### 4.2 DX 卷宗

**代码中引用的 envvar（去重）**

```
ANALYZE
COMPUTERNAME
HOSTNAME
NEXT_DIST_DIR
NODE_ENV
SKIP_API_KEY_VALIDATION
TRUST_PROXY
WEBNOVEL_DISABLE_PROMPT_CACHE
WEBNOVEL_WRITER_CONFIG_ROOT
WEBNOVEL_WRITER_KEY
```

**README ↔ 代码 envvar 同步差异**

- 在代码但不在 README：6 个
  - `ANALYZE` ← Task 5 新增（Task 10 收尾会补 README）
  - `COMPUTERNAME` / `HOSTNAME` ← 用作项目目录默认值的回退（OS 平台差异），用户不直接用
  - `NEXT_DIST_DIR` ← `next.config.ts` 用，Playwright 隔离构建路径用，user-facing 度低
  - `NODE_ENV` ← 标准 Node 变量，框架自己处理，无需 README 提及
  - `SKIP_API_KEY_VALIDATION` ← 测试逃生通道（`lib/settings/encryption.js:102`，跳过 OpenAI/Anthropic key 格式校验）—— 用户**不应该**用，但若要给开发者文档化也可以
- 在 README 但代码无引用：**0 个**（同步无遗漏）

**未配置 API key 时的错误文案**

错误抛出点：`lib/ai/actions.js:133`
```js
throw new Error(`Active provider ${provider} is missing an API key`);
```

- 文案为英文 + 仅描述事实，**未引导用户去 Connection Wizard**。
- 没有"点击这里打开配置"的 CTA。

Connection Wizard 入口：`components/connection-wizard.tsx`，由 `ConnectionModal` 包装；首页 toolbar 触发，但缺 key 时的错误 toast / banner **不直接 deep-link 到 wizard**。

**额外 DX 痛点（来自 Pass 1 实操遇到的）**

1. **系统级 HTTP 代理拦截 E2E**（§3.1 已记）：
   - `HTTP_PROXY=http://127.0.0.1:10808` 之类的代理变量会让 Playwright 的 `webServer.url` 端口探测对所有 `127.0.0.1:N` 端口收到 503，误判端口已占用 → spec 全部不执行。
   - 当前 `package.json` `test:e2e` 不做 `env -u`；用户首次跑 E2E 直接踩坑，且错误信息（`is already used`）误导。
   - 建议修复：`scripts/run-playwright-e2e.mjs` 启动子进程前显式 `delete env.HTTP_PROXY` 等 4 个变量，或在 README "测试" 段写明遇到 503 时的 workaround。

2. **E2E 端口随机化 PID-based 容易碰撞旧残留**（§3.1 + 4.1 触发链路）：
   - 现状：`run-playwright-e2e.mjs:16` 用 `3201 + (process.pid % 2000)` 计算 dev port。
   - 风险：上一次 E2E 异常退出未释放 `next dev` 时，新 PID 可能恰好命中同一个端口 → 残留进程冲突。
   - 建议修复：选择"扫描可用端口"或更大随机域避免快速碰撞。

3. **Next 16 + Turbopack 与 `@next/bundle-analyzer` 不兼容**（§1.2 已记）：
   - `npm run analyze` 静默无输出（不报错也不产 html）。
   - 建议修复：`next.config.ts` 在 `ANALYZE=1` 时打印一条 `console.warn`：*"Note: bundle analyzer is webpack-only; Next 16 default Turbopack ignores this wrapper. Use `next build --webpack` to regenerate reports."*

4. **Build warning 文档同步**（§1.1 已记）：
   - `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` —— 当前 `middleware.ts` 仍按旧约定，README / ARCHITECTURE 也都还称为 "middleware"。建议在 README 加 footer note 标"已知遗留警告 - 待 6.4 迁移"。

**判定（对照设计 §2.3 / sub-tier 6.4 触发条件）：**

- envvar 同步差异 6 条（其中 1 条 `ANALYZE` Task 10 自动补）→ 🟡 5 条遗漏
- 错误文案缺 CTA / deep-link → 🟡 中等 DX 痛点
- HTTP_PROXY 拦截 E2E + 端口碰撞 + analyzer 静默 + middleware deprecation → 🔴 多个具体可改 DX 缺陷叠加

→ **sub-tier 6.4 候选成立 (高，预估 M 工作量)**



## 5. Findings 汇总（按 severity / ROI 排序）

| # | finding | 来源 | severity | ROI | 工作量 | 建议 |
|---|---------|------|----------|-----|--------|------|
| **F1** | E2E 4 fail（`app-smoke:52` 选择器漂移 + `dark-mode×2` + `export×1` 因 axe critical 红） | §3.1 | 🔴 critical | H | M | **Pass 2 / 6.2 + 6.3** |
| **F2** | axe critical `aria-allowed-attr` × 2 nodes —— `header > .dropdown-container[aria-haspopup="listbox"]`（同一根因导致 F1 中 3 个失败） | §2.2 / §3.1 | 🔴 critical | H | S | **Pass 2 / 6.2** —— 修一处同时解 F1 中 3 个 fail |
| **F3** | npm runtime advisory：`next ^16.1.7` 命中 GHSA-q4gf-8mx6-v5v3（high，DoS via Server Components） | §4.1 | 🔴 high | H | S | **Pass 2 / 6.4** —— `npm install next@latest` + 验证 |
| **F4** | npm runtime advisory：`postcss <8.5.10` 命中 GHSA-qx2v-qp2m-jg93（moderate，XSS via unescaped `</style>`） | §4.1 | 🟡 moderate | H | S | **Pass 2 / 6.4** —— 随 F3 一并解决（postcss 是 next 的 transitive） |
| **F5** | First Load JS（page-load）154 KB gzipped，超首页红线 130 KB | §1.1 | 🟡 high (架构) | M | M | **Pass 2 / 6.1** —— polyfills 现代浏览器 target 瘦身 + 重型 modal `dynamic()` import |
| **F6** | E2E 6 个用例 skip（含 3 个非 live-ai：`batch-generate` / `reference-analysis` / `scaffold-generate`），跳过原因待查 | §3.1 | 🟡 moderate | M | S | **Pass 2 / 6.3** —— 排查 skip 触发条件，至少恢复 3 个非 live-ai |
| **F7** | 7 个文件 branch coverage < 60%（_shared.js 22% / state.js 27% / review.js 28% / chapter.js 30% / providers.js 45% / outline.js 50% / workspace.js 50%） | §3.2 | 🟡 moderate | M | M | **Pass 2 / 6.3** —— 针对性补单测 |
| **F8** | 2 个 prompt 模块 statement coverage < 10%（`setting.js` 2% / `reference.js` 6%）—— 单测从未 import | §3.2 | 🟡 moderate | M | S | **Pass 2 / 6.3** —— 至少 import 跑 smoke 路径 |
| **F9** | `app/api/**/route.ts` 在 c8 覆盖率盲区（c8 没插到 server runtime / E2E 进程） | §3.2 | 🟡 moderate | L | M | **Pass 2 / 6.3 (低)** 或 backlog —— 可把 c8 包到 E2E 进程或单测里 partial-mount route handler |
| **F10** | axe moderate `page-has-heading-one`（整页无 `<h1>`） | §2.2 | 🟡 moderate | M | S | **Pass 2 / 6.2** —— 加 visually-hidden h1 (~5 行) |
| **F11** | `npm run test:e2e` 在系统级 HTTP_PROXY=127.0.0.1:10808 时 503 误判端口占用 → 完全跑不起来 | §3.1 / §4.2 | 🟡 high (DX) | H | S | **Pass 2 / 6.4** —— `scripts/run-playwright-e2e.mjs` 启 child 前 delete env.HTTP_PROXY 等 4 个变量，或 README 加 workaround |
| **F12** | `@next/bundle-analyzer` 在 Next 16 Turbopack 下静默无输出 —— 0 用户提示 | §1.2 / §4.2 | 🟢 minor | M | S | **Pass 2 / 6.4** —— `next.config.ts` 在 `ANALYZE=1 && Turbopack` 时打印 warn |
| **F13** | Build warning：`middleware` 文件约定 deprecated（Next 16），建议迁 `proxy`；README/ARCHITECTURE 仍称 "middleware" | §1.1 / §4.2 | 🟢 minor | L | M | **Backlog**（涉及 middleware.ts 迁移，需要 e2e 全绿基础上做） |
| **F14** | E2E port 选用 `3201 + (pid % 2000)` 容易与残留进程碰撞 | §3.1 / §4.2 | 🟢 minor | L | S | **Pass 2 / 6.4 (低)** 或 backlog |
| **F15** | 错误文案 "Active provider X is missing an API key"（`actions.js:133`）无 CTA / deep-link 到 Connection Wizard | §4.2 | 🟢 minor | M | S | **Pass 2 / 6.4** —— 把错误经过 catch / banner 转成可点击的"配置 Provider"按钮 |
| **F16** | 5 个 envvar 在代码但 README 未提（`COMPUTERNAME` / `HOSTNAME` / `NEXT_DIST_DIR` / `NODE_ENV` / `SKIP_API_KEY_VALIDATION`） | §4.2 | 🟢 minor | L | S | **Pass 2 / 6.4 (低)** 或 backlog —— 需要的写 README，纯内部的写 ADR/comment |
| **F17** | webpack-mode build（`next build --webpack`）失败：`lib/utils.js` 用 `import "node:path"` URI，webpack 默认不支持 | §1.2 | 🟢 minor | L | M | **Backlog** —— 我们用 Turbopack 不影响生产，但限制了 analyzer 维度 |

**汇总**

| severity | 数量 |
|----------|-----:|
| 🔴 critical / high | 4 (F1 / F2 / F3 / F11) |
| 🟡 moderate | 8 |
| 🟢 minor | 5 |
| **合计** | **17** |

## 6. 建议进入 Pass 2 的修复项

> 入选标准（设计 §2.1）：ROI ≥ M（修复成本 ≤ 1 个分级 commit、收益可被一条具体验收信号验证）。

### 6.1 性能 & Bundle（M 工作量）

| sub-finding | 验收信号 |
|------------|----------|
| F5：page-load 154 KB → 目标 ≤ 130 KB | `npm run build` 后从 `.next/build-manifest.json` + chunk gzip 实测 page-load gz < 130 KB |

### 6.2 a11y（S 工作量）

| sub-finding | 验收信号 |
|------------|----------|
| F2 + F10：`aria-allowed-attr` × 2 + `page-has-heading-one` | 重跑临时 a11y spec（同 Task 8 步骤）后 violations 数 = 0 critical / 0 serious / ≤ 1 moderate；同时 `npm run test:e2e` 中 dark-mode + export 三个用例由红转绿 |

### 6.3 测试覆盖（M 工作量）

| sub-finding | 验收信号 |
|------------|----------|
| F1 (`app-smoke:52`) | `app-smoke.spec.mjs:52` 用例由红转绿（与 6.2 协同：先修 a11y 再修选择器） |
| F6 (3 个非 live-ai spec skip) | `batch-generate` / `reference-analysis` / `scaffold-generate` 三个 spec 至少 1 个 / 3 个由 skip 转 pass |
| F7 + F8 (低 branch / 极低 stmt 文件) | `npm run test:coverage` 后 `lib/projects` branch ≥ 70%；`lib/ai/prompts` statements ≥ 50% |

### 6.4 安全 & DX（M 工作量，组合修复）

| sub-finding | 验收信号 |
|------------|----------|
| F3 + F4：runtime advisories | `npm audit --omit=dev` 后 high = 0 / moderate = 0 |
| F11 (HTTP_PROXY E2E 拦截) | `npm run test:e2e` 在 HTTP_PROXY 环境下能正常启动（无 503 误判） |
| F12 (analyzer 静默) | `ANALYZE=1 npm run build` 在 Turbopack 下打印明确 warn 提示 |
| F15 (错误文案 CTA) | "missing API key" 错误转化为带 deep-link 的可视化 banner |

### 进入 backlog（不修，文档化）

- F9（c8 盲区到 app/api）：基础架构变更成本不对应当下 ROI
- F13（middleware → proxy 迁移）：等 6.2 + 6.3 把 E2E 全绿后才能安全迁
- F14（E2E 端口随机化）：上次碰撞是偶发；F11 修好后实际不会再触发
- F16 中纯内部 envvar：comment 即可
- F17（webpack mode build 失败）：Turbopack 是生产路径，影响低



## 附录 A：原始命令与日志摘录

### A.0 基线（Task 1）

```
$ git status --porcelain
（空，工作树 clean）

$ time npx tsc --noEmit
real  0m1.828s
user  0m3.023s
sys   0m0.581s
（exit 0，stdout 空）

$ time npm test
# tests 134
# pass 134
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2380.218993
real  0m2.609s
```

### A.2 Build (Task 2)

```
$ time npm run build
▲ Next.js 16.1.7 (Turbopack)
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
✓ Compiled successfully in 2.8s
✓ Generating static pages using 11 workers (15/15) in 258.8ms
```

Page-load chunk inventory taken from `.next/build-manifest.json` (`rootMainFiles` + `polyfillFiles`):

```
raw=224636B gz= 70066B  396f90e8b7ccb31f.js
raw=131658B gz= 36009B  24eda359065fdf45.js
raw=112594B gz= 39499B  a6dad97d9634a72d.js  (polyfill)
raw= 33724B gz=  7351B  68a088aa49e6124a.js
raw= 10232B gz=  4051B  turbopack-3377a737344e67ee.js
raw=  9925B gz=  3113B  7f87a2b7b5fd9ec8.js
---------------------------------------------------
SUM (concat then gzip):  raw=522,769B  gz=157,585B
```

### A.3 Dev smoke (Task 3)

冷启动到首次 200：**~2 秒**（loop iteration 2，第 1 次返回 503，第 2 次成功）。

5 次连续探测 `/`：

```
probe-1: 200 0.106682s
probe-2: 200 0.113101s
probe-3: 200 0.089867s
probe-4: 200 0.080690s
probe-5: 200 0.079278s
```

- min = 79.3ms / max = 113.1ms / p50 ≈ 90ms / p95 ≈ 113ms
- 全部 HTTP 200
- 服务命令：`PORT=3299 npm run dev`
- 关闭：`pkill -P` + `kill`，二次探测 = `DEAD`

### A.4 E2E (Task 4)

```
$ env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
      WEBNOVEL_WRITER_E2E_DIRECT=1 WEBNOVEL_WRITER_E2E_PORT=3300 \
      npm run test:e2e

  4 failed
    tests/e2e/app-smoke.spec.mjs:52:3 › ... ─────
    tests/e2e/dark-mode.spec.mjs:5:3 ──────────────
    tests/e2e/dark-mode.spec.mjs:20:3 ─────────────
    tests/e2e/export.spec.mjs:5:3 ─────────────────
  6 skipped
  1 passed (3.1m)
```

**注**：第一次运行时 `npm run test:e2e` 因 `HTTP_PROXY=http://127.0.0.1:10808` 系统代理，导致 Playwright webServer 端口探测对所有 127.0.0.1 端口收到 503，误判"端口已占用"立即退出。`env -u` 清掉代理后才能跑。这一点本身也是 finding（详见 §4.2 DX）。
