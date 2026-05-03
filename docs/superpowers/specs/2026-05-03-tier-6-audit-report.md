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

### 1.2 Bundle composition（`ANALYZE=1 npm run build`）
（Task 5 写入）

## 2. a11y
（Task 8 写入）

## 3. 测试覆盖与缺口

### 3.1 E2E 跑（mock AI，不含 live-ai）
（Task 4 写入）

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
