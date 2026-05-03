# Tier 6 Pass 1 Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用真实 build / dev / E2E / a11y serious / coverage / bundle / npm audit / DX 数据替换 README 中的"号称 9.9"，落盘成可独立提交的 Tier 6 Audit Report，仅做最小限度的 devDep + config 改动，业务代码与组件 0 行变化。

**Architecture:** 10 个串行任务，每任务一次"运行 + 捕获 + 写入 audit-report 单一节"的循环。任务 5–6 是仅有的 2 处代码改动（`package.json` + `next.config.ts`）。任务 8 创建 → 运行 → 删除一份临时 a11y spec，全程不进 commit。任务 10 合并 findings + 打 tag `tier-6-audit`。

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5.9 / Playwright 1.55 / `@axe-core/playwright` 4.11 / 新增 devDep `c8` + `@next/bundle-analyzer`。

**前置基线（commit `dea7eb1` `main`）:** `tsc --noEmit` 0 错误、`npm test` 134/134、工作树 clean。

---

## 文件结构（本计划新建/修改的全部文件）

| 路径 | 动作 | 责任 |
|------|------|------|
| `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` | **create** | 唯一审计报告，所有任务向它追加 |
| `package.json` | **modify** | `devDependencies` 加 `c8`, `@next/bundle-analyzer`；`scripts` 加 `test:coverage`, `analyze` |
| `package-lock.json` | **modify**（自动） | npm install 副产物 |
| `next.config.ts` | **modify** | env-gated `withBundleAnalyzer` 包装（`ANALYZE=1` 时启用，默认无变化） |
| `tests/e2e/_audit-a11y.spec.mjs` | **create + delete in same task** | 临时 a11y serious/moderate 探测 spec；不进 commit |
| `CHANGELOG.md` | **modify** | 顶部新增 `## 2026-05-03 — Tier 6 Pass 1 (audit)` 段 |
| `README.md` | **modify** | 新增 `analyze` / `test:coverage` 脚本说明，徽章保留至 Pass 2 决策后再升级 |

非目标（这些不动）：`app/**`、`components/**`、`lib/**`、`tests/{components,api,projects,ui,settings,review,scripts}/**`、`tests/e2e/{batch-generate,reference-analysis,dark-mode,export,scaffold-generate,live-ai,app-smoke}.spec.mjs`、`middleware.ts`、`tsconfig.json`、`playwright.config.mjs`、`.gitignore`、`.claude/**`。

---

### Task 1: 基线快照 + 报告骨架

**Files:**
- Create: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md`
- Verify: `package.json:1`, `tsconfig.json:1`

- [ ] **Step 1.1: 确认工作树 clean、依赖锁定**

Run:
```bash
git status --porcelain && npm ci 2>&1 | tail -10
```
Expected: 第一行无输出（clean）；第二行 `added N packages` 或 `up to date`。

- [ ] **Step 1.2: 跑 tsc 取耗时**

Run:
```bash
{ time npx tsc --noEmit; } 2>&1 | tail -5
```
Expected: stdout 空 + `real <time>`。记下 `<tsc_duration>`。

- [ ] **Step 1.3: 跑全量 unit + component 测试取耗时**

Run:
```bash
{ time npm test; } 2>&1 | tail -10
```
Expected: `# tests 134` / `# pass 134` / `# fail 0` + `real <time>`。记下 `<test_count>` `<test_duration>`。

- [ ] **Step 1.4: 创建报告骨架**

写入 `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md`：
````markdown
# Tier 6 Audit Report — 2026-05-03

**对应设计**：`docs/superpowers/specs/2026-05-03-tier-6-design.md`
**基线 commit**：`dea7eb1`（`docs(spec): Tier 6 design`）
**Pass 1 commit**：（Task 10 完成后填写）
**Pass 1 tag**：`tier-6-audit`（Task 10 完成后填写）

---

## 0. 基线快照

| 项目 | 值 |
|------|-----|
| Node | <node_version>（`node -v`） |
| npm | <npm_version>（`npm -v`） |
| Next | 16.x（`package.json` `dependencies.next`） |
| React | 19.x |
| TypeScript | 5.9.x |
| `tsc --noEmit` exit | 0 |
| `tsc --noEmit` 耗时 | <tsc_duration> |
| `npm test` 总数 | 134 pass / 0 fail / 0 skip |
| `npm test` 耗时 | <test_duration> |
| Git 工作树 | clean（pre-Pass 1） |

## 1. 性能 & Bundle
（Task 2 + Task 5 写入）

## 2. a11y
（Task 8 写入）

## 3. 测试覆盖与缺口
（Task 4 + Task 6 写入）

## 4. 安全 & DX
（Task 7 + Task 9 写入）

## 5. Findings 汇总（按 severity / ROI 排序）
（Task 10 写入）

## 6. 建议进入 Pass 2 的修复项
（Task 10 写入）

## 附录 A：原始命令与日志摘录
（各任务追加片段）
````

把 `<node_version>` / `<npm_version>` / `<tsc_duration>` / `<test_duration>` 用 Step 1.1–1.3 实测值替换。

- [ ] **Step 1.5: 提交（仅报告骨架）**

```bash
git add docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git commit -m "$(cat <<'EOF'
docs(audit): Tier 6 Pass 1 report scaffold + §0 baseline snapshot

Captures pre-Pass-1 baseline: tsc 0 errors, npm test 134/134,
versions of Node/npm/Next/React/TS. Subsequent tasks append
§1–§4 sections.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: `1 file changed, X insertions(+)`。

---

### Task 2: 生产构建 + 路由 First Load JS 表

**Files:**
- Modify: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` (`§1`)

- [ ] **Step 2.1: 跑 next build**

Run:
```bash
{ time npm run build 2>&1; } | tee /tmp/tier6-build.log | tail -80
```
Expected: 末尾出现路由表（`Route (app)` ... `First Load JS`），exit 0，无 webpack `WARN`/`ERROR`。

- [ ] **Step 2.2: 提取路由表 + 警告**

Run:
```bash
sed -n '/Route (app)/,/First Load JS/p' /tmp/tier6-build.log
sed -n '/^warn/Ip' /tmp/tier6-build.log | head -20
```
Expected: 完整路由 First Load JS 数字列；warn 行 0–N 条。

- [ ] **Step 2.3: 写入报告 §1.1**

把 `§1. 性能 & Bundle` 节追加为：
````markdown
## 1. 性能 & Bundle

### 1.1 `npm run build` 静态产物

```
<paste path & first-load-js table from Step 2.1 here>
```

**构建警告**：

```
<paste warn lines from Step 2.2; if empty write "无">
```

**构建耗时**：<build_duration>

**判定（对照设计 §2.3 阈值）：**
- 首页 First Load JS：<value> KB <gzipped|raw>，目标 ≤ 90 KB / 红线 > 130 KB → **<在阈值内 / 警告区 / 红线>**
- 任一路由 First Load JS 最大值：<value> KB（路由 `<name>`），目标 ≤ 110 KB / 红线 > 160 KB → **<判定>**
- 构建警告：<判定>

### 1.2 Bundle composition（Task 5 写入）
````

- [ ] **Step 2.4: 提交**

```bash
git add docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git commit -m "docs(audit): §1.1 next build first-load-js table + warnings"
```

Expected: `1 file changed`。

---

### Task 3: Dev server smoke probe

**Files:**
- Modify: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` (`§4` DX 子节预留)

- [ ] **Step 3.1: 启动 dev server 后台、等待就绪**

Run:
```bash
PORT=3299 nohup npm run dev > /tmp/tier6-dev.log 2>&1 &
echo $! > /tmp/tier6-dev.pid
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3299/; then echo "READY $i"; break; fi
  sleep 1
done
```
Expected: 看到 `READY <n>` 且 `<n> < 30`；否则查 `/tmp/tier6-dev.log` 排错。

- [ ] **Step 3.2: 探测 `/` 5 次取耗时分布**

Run:
```bash
for i in 1 2 3 4 5; do
  curl -o /dev/null -s -w "probe-$i: %{http_code} %{time_total}s\n" http://127.0.0.1:3299/
done
```
Expected: 5 行 `probe-N: 200 <Xs>`。

- [ ] **Step 3.3: 关闭 dev server**

Run:
```bash
kill "$(cat /tmp/tier6-dev.pid)" && wait 2>/dev/null; rm -f /tmp/tier6-dev.pid
```
Expected: 无错误（kill 后进程退出）。

- [ ] **Step 3.4: 写入报告附录 A**

把以下追加到 `## 附录 A` 节：
````markdown
### A.3 Dev smoke (Task 3)

```
<paste 5 probe lines>
```

首次冷启动到 200：<n> 秒；后续探测 p50 <X>s / p95 <Y>s。
````

- [ ] **Step 3.5: 提交**

```bash
git add docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git commit -m "docs(audit): §A.3 dev smoke probe latencies"
```

---

### Task 4: E2E baseline 跑 (Playwright + axe critical)

**Files:**
- Modify: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` (`§3.1`)

- [ ] **Step 4.1: 跑 mock-AI E2E（不含 live-ai）**

Run:
```bash
npx playwright install --with-deps chromium 2>&1 | tail -5
npm run test:e2e 2>&1 | tee /tmp/tier6-e2e.log | tail -60
```
Expected: 末尾 `<N> passed`（N ≥ 6），exit 0。

- [ ] **Step 4.2: 提取统计 + a11y critical 结果**

Run:
```bash
grep -E '(passed|failed|skipped|\[a11y:)' /tmp/tier6-e2e.log | head -40
```
Expected: 看到 `<N> passed`；任何 `[a11y:<tag>]` 行（应为 0 个 critical）。

- [ ] **Step 4.3: 写入报告 §3.1**

```markdown
## 3. 测试覆盖与缺口

### 3.1 E2E 跑（mock AI，不含 live-ai）

| 指标 | 值 |
|------|-----|
| Specs | 6（dark-mode / export / batch-generate / scaffold-generate / reference-analysis / app-smoke） |
| Pass / Fail / Skip | <p> / <f> / <s> |
| 总耗时 | <duration> |
| axe-core critical violations | <count>（应 = 0） |

非 critical 提示（来自 helper console.warn）：

```
<paste relevant [a11y:...] lines from Step 4.2; if none write "无">
```

### 3.2 单元 + 组件覆盖率（Task 6 写入）
```

- [ ] **Step 4.4: 提交**

```bash
git add docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git commit -m "docs(audit): §3.1 E2E baseline + axe critical = 0"
```

---

### Task 5: Bundle analyzer 集成

**Files:**
- Modify: `package.json` (`devDependencies`, `scripts`)
- Modify: `next.config.ts`
- Modify: `package-lock.json` (auto)
- Modify: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` (`§1.2`)

- [ ] **Step 5.1: 安装 devDep**

Run:
```bash
npm install --save-dev @next/bundle-analyzer
```
Expected: `package.json` 多一行 `"@next/bundle-analyzer": "^X.Y.Z"`。

- [ ] **Step 5.2: 验证只进 devDependencies、不进 dependencies**

Run:
```bash
node -e "const p=require('./package.json'); console.log('runtime keys:', Object.keys(p.dependencies))"
```
Expected: `runtime keys: [ 'next', 'react', 'react-dom' ]` —— 三件套不变（不变量 I4）。

- [ ] **Step 5.3: 修改 `next.config.ts` 加 env-gated 包装**

把 `next.config.ts` 整文件替换为：
```typescript
import withBundleAnalyzerFactory from "@next/bundle-analyzer";

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingRoot: __dirname,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: true },
      { source: "/settings", destination: "/", permanent: true },
      { source: "/library", destination: "/", permanent: true },
      { source: "/outline", destination: "/", permanent: true },
      { source: "/writing", destination: "/", permanent: true },
      { source: "/workspace", destination: "/", permanent: true },
      { source: "/ideation", destination: "/", permanent: true },
      { source: "/review", destination: "/", permanent: true },
      { source: "/projects", destination: "/", permanent: true },
      { source: "/connection", destination: "/", permanent: true },
    ];
  },
};

const withBundleAnalyzer = withBundleAnalyzerFactory({
  enabled: process.env.ANALYZE === "1",
  openAnalyzer: false,
});

export default withBundleAnalyzer(nextConfig);
```

- [ ] **Step 5.4: 加 `analyze` script**

`package.json` `scripts` 节加：
```json
"analyze": "ANALYZE=1 node ./node_modules/next/dist/bin/next build"
```
（紧跟 `start` 行之后；其它 script 不动。）

- [ ] **Step 5.5: 验证默认行为零回归**

Run:
```bash
{ time npm run build 2>&1; } | tail -20
npx tsc --noEmit
```
Expected: build exit 0、`tsc` exit 0；路由表与 Task 2 一致（同 First Load JS 数字 ± 0.1 KB）。

- [ ] **Step 5.6: 跑 `analyze` 模式**

Run:
```bash
npm run analyze 2>&1 | tee /tmp/tier6-analyze.log | tail -40
ls .next/analyze/ 2>/dev/null || ls .next-analyze/ 2>/dev/null || ls .next/server/analyze*.html 2>/dev/null || true
find .next -maxdepth 3 -name '*.html' -path '*analyze*' -o -name 'client.html' -o -name 'edge.html' -o -name 'nodejs.html' 2>/dev/null | head
```
Expected: build exit 0；至少 1 个 `.html` 报告文件存在（`@next/bundle-analyzer` 默认在 `.next/analyze/` 输出 `client.html` / `edge.html` / `nodejs.html`）。

- [ ] **Step 5.7: 提取 top modules**

Run:
```bash
node <<'EOF'
const fs = require('fs');
const path = require('path');
const candidates = ['.next/analyze/client.html', '.next/analyze/nodejs.html'];
for (const p of candidates) {
  if (!fs.existsSync(p)) continue;
  const html = fs.readFileSync(p, 'utf8');
  const m = html.match(/window\.chartData\s*=\s*(\[[\s\S]+?\]);/);
  if (!m) { console.log(p, '<no chartData>'); continue; }
  const data = JSON.parse(m[1]);
  console.log('=== ' + p + ' ===');
  data
    .flatMap(c => (c.groups || []).map(g => ({ chunk: c.label, mod: g.label, parsed: g.parsedSize })))
    .sort((a,b) => b.parsed - a.parsed)
    .slice(0, 10)
    .forEach(r => console.log((r.parsed/1024).toFixed(1).padStart(8) + ' KB   ' + r.chunk + '  ←  ' + r.mod));
}
EOF
```
Expected: 客户端 / 服务端两组各 top 10。

- [ ] **Step 5.8: 写入报告 §1.2**

```markdown
### 1.2 Bundle composition（`ANALYZE=1 npm run build`）

**Top 10 client modules（按 parsed size 倒排）**

```
<paste client-side top 10 from Step 5.7>
```

**Top 10 server / edge modules**

```
<paste server-side top 10 from Step 5.7>
```

**判定（对照设计 §2.3 + 设计 §2.2 触发条件）：**
- 单 module 占该路由 chunk ≥ 30% 且非 `next` / `react` / `react-dom` 框架包：<列出所有命中项 / "无">
```

- [ ] **Step 5.9: 提交**

```bash
git add package.json package-lock.json next.config.ts docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git commit -m "$(cat <<'EOF'
build: add @next/bundle-analyzer (devDep) + ANALYZE=1 gate

- next.config.ts: env-gated withBundleAnalyzer wrapper, default off
- package.json: new "analyze" script
- runtime dependencies unchanged (next/react/react-dom)
- audit-report §1.2 records top-10 client/server modules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Coverage (c8) 集成

**Files:**
- Modify: `package.json` (`devDependencies`, `scripts`)
- Modify: `package-lock.json` (auto)
- Modify: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` (`§3.2`)

- [ ] **Step 6.1: 安装 c8**

Run:
```bash
npm install --save-dev c8
node -e "const p=require('./package.json'); console.log('runtime keys:', Object.keys(p.dependencies))"
```
Expected: 第二行仍为 `[ 'next', 'react', 'react-dom' ]`。

- [ ] **Step 6.2: 加 `test:coverage` script**

`package.json` `scripts` 节加（在 `test` 之后）：
```json
"test:coverage": "c8 --reporter=text-summary --reporter=text --include='lib/**' --include='app/**' --exclude='**/*.test.mjs' --exclude='tests/**' npm test"
```

- [ ] **Step 6.3: 跑覆盖率**

Run:
```bash
npm run test:coverage 2>&1 | tee /tmp/tier6-cov.log | tail -120
```
Expected: c8 末尾打出 `=============== Coverage summary ===============` 加 4 行（Statements / Branches / Functions / Lines）+ 详细文件表。

- [ ] **Step 6.4: 提取关键目录覆盖率**

Run:
```bash
grep -E '^(File|---|All files|lib/api|lib/ai|lib/projects|lib/ui|lib/editor|lib/log|app/api)' /tmp/tier6-cov.log | head -60
```
Expected: 关键目录 + All files 行；按 Statements / Branches / Functions / Lines 4 列。

- [ ] **Step 6.5: 找 branch coverage 最低 10 个文件**

Run:
```bash
awk '
  /\| *[0-9]+(\.[0-9]+)? *\| *[0-9]+(\.[0-9]+)? *\| *[0-9]+(\.[0-9]+)? *\| *[0-9]+(\.[0-9]+)? *\|/ {
    line = $0
    gsub(/^ *\| */, "", line); gsub(/ *\| *$/, "", line)
    n = split(line, parts, /\| */)
    if (n >= 5 && parts[1] !~ /^All files/) {
      printf "%s\t%s\n", parts[3], parts[1]
    }
  }
' /tmp/tier6-cov.log | sort -n -k1 | head -10
```
Expected: 10 行 `<branch%>\t<file>`，最低 branch 在前。

- [ ] **Step 6.6: 写入报告 §3.2**

```markdown
### 3.2 单元 + 组件覆盖率（`npm run test:coverage`）

**汇总（c8 text-summary）**

```
<paste 4 lines from Step 6.3 tail "Coverage summary">
```

**关键目录覆盖率（lib/api / lib/ai / lib/projects / lib/ui / lib/editor / lib/log / app/api）**

```
<paste from Step 6.4>
```

**Branch coverage 最低 10 文件**

```
<branch%>\t<file>
<...10 rows...>
```

**判定（对照设计 §2.3 阈值）：**
- Statement coverage（`lib/` + `app/api`）：<X>%，目标 ≥ 80% / 红线 < 65% → **<判定>**
- Branch coverage（`lib/api` / `lib/ai` / `lib/projects`）：<X> / <Y> / <Z>%，目标 ≥ 75% / 红线 < 60% → **<判定>**
- 触发 sub-tier 6.3 的具体文件清单：<逐个列 + 当前 branch% / "无">
```

- [ ] **Step 6.7: 提交**

```bash
git add package.json package-lock.json docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git commit -m "$(cat <<'EOF'
test: add c8 coverage (devDep) + test:coverage script

- c8 in devDependencies; runtime deps still next/react/react-dom
- test:coverage: text-summary + per-file table over lib/** + app/**
- audit-report §3.2 records summary, key dirs, lowest 10 branch files

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: npm audit (runtime + full)

**Files:**
- Modify: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` (`§4.1`)

- [ ] **Step 7.1: 跑 runtime-only audit**

Run:
```bash
npm audit --omit=dev --json > /tmp/tier6-audit-runtime.json 2>/dev/null || true
node -e "const a=require('/tmp/tier6-audit-runtime.json'); console.log(JSON.stringify(a.metadata?.vulnerabilities || a, null, 2))"
```
Expected: JSON metadata 含 `info` / `low` / `moderate` / `high` / `critical` 五桶计数（理想全 0）。

- [ ] **Step 7.2: 跑 full audit（含 dev）**

Run:
```bash
npm audit --json > /tmp/tier6-audit-full.json 2>/dev/null || true
node -e "const a=require('/tmp/tier6-audit-full.json'); console.log(JSON.stringify(a.metadata?.vulnerabilities || a, null, 2))"
```
Expected: 同上，可能 dev 端有低危项。

- [ ] **Step 7.3: 列出每个 advisory（如有）**

Run:
```bash
node <<'EOF'
const a = require('/tmp/tier6-audit-full.json');
const v = a.vulnerabilities || {};
for (const [name, info] of Object.entries(v)) {
  console.log(`- ${name}  severity=${info.severity}  via=${(info.via||[]).map(x=>typeof x==='string'?x:x.title||x.source).join(', ')}  fix=${info.fixAvailable === true ? 'yes' : info.fixAvailable && info.fixAvailable.name || 'no'}`);
}
EOF
```
Expected: 0 行（理想）或 N 行 advisories。

- [ ] **Step 7.4: 写入报告 §4.1**

```markdown
## 4. 安全 & DX

### 4.1 npm audit

**Runtime-only（`npm audit --omit=dev`）**

```json
<paste vulnerabilities metadata from Step 7.1>
```

**Full（含 devDeps）**

```json
<paste from Step 7.2>
```

**Advisories 明细（如有）**

```
<paste from Step 7.3; if empty write "无">
```

**判定（对照设计 §2.3 阈值）：**
- runtime high/critical：<X>，红线 ≥ 1 → **<判定>**
- dev high/critical：<X>，红线 ≥ 1（仅文档化，不一定触发 sub-tier 6.4） → **<判定>**

### 4.2 DX 卷宗（Task 9 写入）
```

- [ ] **Step 7.5: 提交**

```bash
git add docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git commit -m "docs(audit): §4.1 npm audit (runtime + full) + advisories detail"
```

---

### Task 8: a11y serious + moderate 扩级（临时 spec，跑完即删）

**Files:**
- Create+Delete (within this task, never committed): `tests/e2e/_audit-a11y.spec.mjs`
- Modify: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` (`§2`)

- [ ] **Step 8.1: 创建临时 spec**

写入 `tests/e2e/_audit-a11y.spec.mjs`：
```javascript
// TEMPORARY — created and deleted within Tier 6 Pass 1 Task 8.
// Must not be committed (Task 8 final step rm + git status confirm).
import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const REPORT = [];

async function scanCurrent(page, tag) {
  const results = await new AxeBuilder({ page }).analyze();
  for (const v of results.violations) {
    if (!["critical", "serious", "moderate"].includes(v.impact)) continue;
    REPORT.push({
      tag,
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.target?.[0] || "",
    });
  }
}

test.describe("Tier 6 a11y extended audit", () => {
  test("home + theme toggle", async ({ page }) => {
    await page.goto("/");
    await scanCurrent(page, "home:initial");
    const toggle = page.getByRole("button", { name: /切换.*模式/ });
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await scanCurrent(page, "home:theme-toggled");
    }
  });

  test.afterAll(() => {
    // eslint-disable-next-line no-console
    console.log("===TIER6_A11Y_BEGIN===");
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(REPORT, null, 2));
    // eslint-disable-next-line no-console
    console.log("===TIER6_A11Y_END===");
  });
});
```

- [ ] **Step 8.2: 跑这一份 spec**

Run:
```bash
npx playwright test tests/e2e/_audit-a11y.spec.mjs 2>&1 | tee /tmp/tier6-a11y.log | tail -120
```
Expected: 看到 `===TIER6_A11Y_BEGIN===` 与 `===TIER6_A11Y_END===` 中间夹一个 JSON 数组（可为空 `[]`）；测试 `passed`。

- [ ] **Step 8.3: 提取 JSON 段**

Run:
```bash
awk '/===TIER6_A11Y_BEGIN===/{flag=1; next} /===TIER6_A11Y_END===/{flag=0} flag' /tmp/tier6-a11y.log > /tmp/tier6-a11y.json
node -e "const a=require('/tmp/tier6-a11y.json'); console.log('count=', a.length); a.forEach(v => console.log(v.impact.padEnd(8), v.id.padEnd(40), v.tag, '×', v.nodes, '  ', v.sample))"
```
Expected: `count= <N>`；后续每行为一条违例摘要。

- [ ] **Step 8.4: 删除临时 spec、确认未污染**

Run:
```bash
rm tests/e2e/_audit-a11y.spec.mjs
git status --porcelain | grep _audit-a11y
echo exit=$?
```
Expected: 第 2 行无输出；`exit=1`（grep 0 match → exit 1，证明 git 看不到这文件）。

- [ ] **Step 8.5: 写入报告 §2**

```markdown
## 2. a11y

### 2.1 测试范围
- 已有 E2E（`tests/e2e/*.spec.mjs`）通过 `helpers/a11y.mjs` 的 `assertNoAxeCriticalViolations`：仅 critical 失败、serious/moderate 走 `console.warn`。
- 本次（Pass 1 Task 8）临时创建 `tests/e2e/_audit-a11y.spec.mjs` 把 critical + serious + moderate 全部抓出来；跑完即删，不进 commit。

### 2.2 扩级结果

总数：<N> 条 violations。

| impact | id | help | tag | nodes | sample selector |
|--------|----|------|-----|-------|-----------------|
| <paste rows from Step 8.3 — one per violation> |

**判定（对照设计 §2.3 阈值）：**
- critical + serious：<X>，目标 0 / 红线 ≥ 1 → **<判定>**
- moderate：<X>，目标"全部记入 + 低成本者修复"
- 触发 sub-tier 6.2 的具体 violation：<逐项列 / "无">
```

- [ ] **Step 8.6: 提交**

```bash
git add docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git status --porcelain
git commit -m "docs(audit): §2 a11y extended scan (critical+serious+moderate)"
```

Expected: `git status --porcelain` 输出仅 `M docs/superpowers/specs/2026-05-03-tier-6-audit-report.md`；commit 1 file changed。

---

### Task 9: DX 卷宗

**Files:**
- Modify: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` (`§4.2`)

- [ ] **Step 9.1: grep 出所有 envvar**

Run:
```bash
grep -rEho '(process\.env\.[A-Z_][A-Z0-9_]+|\$\{?[A-Z_][A-Z0-9_]+\}?)' app lib middleware.ts next.config.ts 2>/dev/null \
  | sort -u | head -40
```
Expected: 一份去重 envvar 列表。

- [ ] **Step 9.2: 对照 README 检查覆盖**

Run:
```bash
{ grep -rEho 'process\.env\.[A-Z_][A-Z0-9_]+' app lib middleware.ts next.config.ts 2>/dev/null | sed 's/process\.env\.//' | sort -u; } > /tmp/tier6-env-code.txt
{ grep -Eho '`[A-Z_][A-Z0-9_]+`' README.md | tr -d '`' | sort -u; } > /tmp/tier6-env-readme.txt
echo '--- 在代码但不在 README ---'
comm -23 /tmp/tier6-env-code.txt /tmp/tier6-env-readme.txt | head
echo '--- 在 README 但代码未引用 ---'
comm -13 /tmp/tier6-env-code.txt /tmp/tier6-env-readme.txt | head
```
Expected: 两份差异清单。

- [ ] **Step 9.3: 抓"未配置 API key"启动后用户面错误文案样本**

Run:
```bash
grep -rEn "(未配置|未设置|API.{0,10}[Kk]ey|provider not configured)" app components 2>/dev/null | head -20
```
Expected: N 条文案命中行（用于评估 DX 引导面是否友好）。

- [ ] **Step 9.4: 写入报告 §4.2**

```markdown
### 4.2 DX 卷宗

**代码中引用的 envvar（去重）**

```
<paste from Step 9.1>
```

**README ↔ 代码 envvar 同步差异**

- 在代码但不在 README：<paste / "无">
- 在 README 但代码未引用：<paste / "无">

**未配置 API key 时的用户面错误文案样本**

```
<paste from Step 9.3>
```

**判定：**
- 文档同步差异：<X> 条 → 触发 sub-tier 6.4 的依据：<是 / 否>
- 错误文案是否引导用户去 Connection Wizard：<是 / 否 / 部分>，证据 <文件:行>
```

- [ ] **Step 9.5: 提交**

```bash
git add docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git commit -m "docs(audit): §4.2 DX (envvar sync diff + error copy survey)"
```

---

### Task 10: Findings 汇总 + Pass 2 候选 + tag tier-6-audit

**Files:**
- Modify: `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` (`§5`, `§6`, header)
- Modify: `CHANGELOG.md`
- Modify: `README.md`

- [ ] **Step 10.1: 通读 §1–§4 各「判定」行，汇总为 §5**

把 `§5. Findings 汇总` 改写为：
````markdown
## 5. Findings 汇总（按 severity / ROI 排序）

| # | finding | 来源 | severity | ROI 估 | 工作量 | 建议 |
|---|---------|------|----------|--------|--------|------|
| F1 | <文字> | §<X.Y> | <critical/serious/moderate/info> | <H/M/L> | <S/M/L> | Pass 2 / backlog / 不动 |
| F2 | ... |
| ... |

> 若全部维度均"在阈值内"，本节填 "无 finding"。
````

逐条把 §1.1 / §1.2 / §2.2 / §3.1 / §3.2 / §4.1 / §4.2 中触发警告区或红线的判定提取出来填表。**没有触发任何阈值的维度直接跳过，不要凑数。**

- [ ] **Step 10.2: 写入 §6**

```markdown
## 6. 建议进入 Pass 2 的修复项

> 入选标准（设计 §2.1）：ROI ≥ M（修复成本 ≤ 1 个分级 commit、收益可被一条具体验收信号验证）。

| sub-tier | finding | 验收信号 | 工作量 |
|----------|---------|----------|--------|
| 6.1 性能 & Bundle | <F#> | <verify cmd 期望 exit 0> | <S/M/L> |
| 6.2 a11y | <F#> | ... |
| 6.3 测试覆盖 | <F#> | ... |
| 6.4 安全 & DX | <F#> | ... |

> 若 §5 为"无 finding"，本节填 "Pass 2 不启用，Tier 6 以 0-finding 方式收尾"。
```

- [ ] **Step 10.3: 更新报告头 + CHANGELOG + README**

更新 `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` 头部 `Pass 1 commit` / `Pass 1 tag` 两行（暂填 `<待 Step 10.5 commit 后回填>`，因为 commit hash 此刻还不知道——Step 10.5 之后 amend 一次 SHA）。

`CHANGELOG.md` 顶部插入：
```markdown
## 2026-05-03 — Tier 6 Pass 1（audit）

### Added (devDep / scripts only)

- `@next/bundle-analyzer` devDep + `next.config.ts` `ANALYZE=1`
  env-gated 包装 + `npm run analyze` script。
- `c8` devDep + `npm run test:coverage` script（c8 text-summary +
  per-file table over `lib/**` + `app/**`）。

### Audited

- `tsc --noEmit`：0 错误（耗时 <X>s）。
- `npm test`：134/134（耗时 <X>s）。
- `npm run build`：路由 First Load JS / 警告完整记录。
- `npm run test:e2e`：6 specs 全绿；axe-core critical 0。
- a11y 扩级：critical+serious+moderate <N> 条，明细见 audit-report §2。
- Bundle composition：top-10 client/server modules，明细见 §1.2。
- Coverage：summary + 关键目录 + 最低 branch 10 文件，明细见 §3.2。
- `npm audit` runtime + full：<X>/<Y> 高危，明细见 §4.1。
- DX：envvar sync diff <X> 条；错误文案抽样 <Y> 行；明细见 §4.2。

### Findings

- 详见 `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` §5 / §6。
- Pass 2 触发：<是 / 否>，待用户决策。

### Pass 1 invariants

- 运行时依赖仍为 `next` / `react` / `react-dom` 三件套（不变量 I4）。
- `tsc --noEmit` / `npm test` / `npm run build` / `npm run test:e2e` 全绿（I1–I3 + I5）。
- 业务代码、组件、API 路由、CSS 0 行变化。
```

`README.md` 的「快速开始」节加两行（在 `npm run test:e2e` 之后）：
```markdown
npm run test:coverage  # c8 单元 + 组件覆盖率
npm run analyze        # ANALYZE=1 next build，输出 .next/analyze/*.html
```

- [ ] **Step 10.4: 跑全套验证（最后一道关）**

Run:
```bash
npx tsc --noEmit && \
npm test 2>&1 | tail -10 && \
npm run build 2>&1 | tail -20
```
Expected: tsc exit 0；`# pass <N>`（N ≥ 134）/ `# fail 0`；build exit 0。

- [ ] **Step 10.5: 提交 + tag**

```bash
git add docs/superpowers/specs/2026-05-03-tier-6-audit-report.md CHANGELOG.md README.md
git commit -m "$(cat <<'EOF'
docs(audit): Tier 6 Pass 1 closeout — findings + Pass 2 candidates

- audit-report §5 lists all findings (severity/ROI/effort).
- audit-report §6 maps findings → sub-tier 6.1-6.4 candidates.
- CHANGELOG: 2026-05-03 Tier 6 Pass 1 entry (devDep additions only).
- README: surface npm run test:coverage / analyze in quick-start.

Pass 1 invariants verified: tsc 0 errors, npm test ≥134 pass,
build clean, runtime deps unchanged (next/react/react-dom).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
PASS1_SHA=$(git rev-parse HEAD)
echo "Pass 1 commit SHA: $PASS1_SHA"
git tag tier-6-audit
```

Expected: commit 成功、`git rev-parse HEAD` 输出 SHA、`git tag` 无错。

- [ ] **Step 10.6: 把 SHA 回填进 audit-report 头部**

把 `audit-report.md` 头部的：
```
**Pass 1 commit**：（Task 10 完成后填写）
**Pass 1 tag**：`tier-6-audit`（Task 10 完成后填写）
```
改为：
```
**Pass 1 commit**：`<PASS1_SHA 前 7 位>`
**Pass 1 tag**：`tier-6-audit`
```

Run:
```bash
git add docs/superpowers/specs/2026-05-03-tier-6-audit-report.md
git commit -m "docs(audit): backfill Pass 1 commit SHA in report header"
```

Expected: commit 成功，`git status --porcelain` 空。

- [ ] **Step 10.7: 最终全绿确认**

Run:
```bash
git status --porcelain && \
git log --oneline tier-6-audit~1..HEAD && \
npx tsc --noEmit && \
npm test 2>&1 | grep -E '# (tests|pass|fail)' && \
node -e "const p=require('./package.json'); console.log('runtime keys:', Object.keys(p.dependencies))"
```
Expected:
- 第 1 行：无输出（clean）
- 第 2 行：从 `tier-6-audit` 起 9 个 commit（Tasks 1–10）
- 第 3 行：tsc exit 0、stdout 空
- 第 4 行：`# tests 134` / `# pass 134` / `# fail 0`
- 第 5 行：`runtime keys: [ 'next', 'react', 'react-dom' ]`

---

## Pass 1 验收信号（对照设计 §1.4）

- [x] 报告产出 + commit 入仓 ✅（Task 1 + Task 10）
- [x] I1（tsc 0 错误）✅（Step 10.7）
- [x] I2（npm test ≥ 134 pass / 0 fail）✅（Step 10.7）
- [x] I3（build 干净）✅（Step 10.4）
- [x] I4（运行时依赖未增）✅（Steps 5.2 / 6.1 / 10.7）
- [x] I5（E2E 全绿）✅（Task 4 + 临时 spec 已删）
- [x] 报告 §5 给出显式 finding 列表（可为空集）✅（Task 10.1）
- [x] 报告 §6 列出 Pass 2 候选项（按 ROI 倒排，每项标注预估工作量 S/M/L）✅（Task 10.2）

---

## 失败情景预案

| 情景 | 处理 |
|------|------|
| Step 1.3 npm test 不为 134 | 先停下；与 README 标称数对照，找出来源。这本身就是一条 finding（"baseline drift"），但要更新 audit-report §0 实测值；不阻断 Pass 1 推进 |
| Step 2.1 next build 失败或出 webpack `WARN`/`ERROR` | 这是 finding F#，正常落入 §1 + §5；不要修代码；继续后续任务 |
| Step 4.1 E2E 任一 spec 红 | finding F#；如果是新发现的 a11y critical 那就是高 severity，记入 §2；不修，继续 |
| Step 5.6 `analyze` 不产出 html | 检查 `@next/bundle-analyzer` 版本与 Next 16 兼容性；如不兼容，§1.2 标 "analyzer 不兼容"，作为 finding；不强行装老版本 |
| Step 6.3 c8 与 node:test 集成失败 | 改 `npm run test:coverage` 为 `c8 --reporter=text-summary node --test tests/...`，与 `package.json` 里的 `test` 命令保持等价；记入附录 A |
| Step 8.2 临时 spec 跑红 | 这正是要找的 a11y 信号；记 §2.2，删 spec 继续 |
| 任一步骤涉及业务代码改动 | **立刻停下**——Pass 1 设计禁止业务代码改动（§1.3）；把"必须改"作为 finding 提交 Pass 2 决策 |

任何处理后仍卡死时：`git stash` + `git status` 干净后 ping 用户。

---

## Self-Review（写完 plan 后逐项核）

| 检查项 | 结果 |
|--------|------|
| 设计 §1.1 P1.0 (`npm ci`) 有任务 | ✅ Task 1 Step 1.1 |
| 设计 §1.1 P1.1 (`tsc`) 有任务 | ✅ Task 1 Step 1.2 |
| 设计 §1.1 P1.2 (`npm test`) 有任务 | ✅ Task 1 Step 1.3 |
| 设计 §1.1 P1.3 (`npm run build`) 有任务 | ✅ Task 2 |
| 设计 §1.1 P1.4 (dev smoke) 有任务 | ✅ Task 3 |
| 设计 §1.1 P1.5 (`test:e2e`) 有任务 | ✅ Task 4 |
| 设计 §1.1 P1.6 (a11y 扩级) 有任务 | ✅ Task 8（含临时 spec 创建/删除） |
| 设计 §1.1 P1.7 (analyzer) 有任务 | ✅ Task 5 |
| 设计 §1.1 P1.8 (coverage) 有任务 | ✅ Task 6 |
| 设计 §1.1 P1.9 (`npm audit`) 有任务 | ✅ Task 7 |
| 设计 §1.1 P1.10 (DX 卷宗) 有任务 | ✅ Task 9 |
| 设计 §1.3 仅 2 类代码改动 | ✅ Task 5（next.config.ts + package.json）+ Task 6（package.json） |
| 设计 §1.4 报告 §5 + §6 | ✅ Task 10.1 / 10.2 |
| 设计 §1.4 tag `tier-6-audit` | ✅ Task 10.5 |
| 设计 不变量 I1–I5 验证 | ✅ Step 10.7 一次性回归 |
| 占位符（TBD/TODO/FIXME/XXX） | ✅ 0 处（角括号 `<...>` 仅指实测值代填位，不是占位符；每处都有"用 Step X.Y 实测值替换"说明） |
| 函数 / 路径 / SHA 一致性 | ✅ `_audit-a11y.spec.mjs` 路径在 §文件结构 / Task 8 / Self-Review 三处对齐 |

---

**Plan 完成。下一步**：用户选择执行模式（subagent-driven / inline）。
