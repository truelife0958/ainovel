# Tier 6 Audit Report — 2026-05-03

**对应设计**：`docs/superpowers/specs/2026-05-03-tier-6-design.md`
**基线 commit**：`dea7eb1`（`docs(spec): Tier 6 design`）+ `b8b0455`（`docs(plan): Pass 1 plan`）
**Pass 1 commit**：（Task 10 完成后填写）
**Pass 1 tag**：`tier-6-audit`（Task 10 完成后填写）

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
（Task 8 写入）

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
（Task 6 写入）

## 4. 安全 & DX

### 4.1 npm audit
（Task 7 写入）

### 4.2 DX 卷宗
（Task 9 写入）

## 5. Findings 汇总（按 severity / ROI 排序）
（Task 10 写入）

## 6. 建议进入 Pass 2 的修复项
（Task 10 写入）

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
