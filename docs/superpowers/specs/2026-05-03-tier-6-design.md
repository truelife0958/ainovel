# 设计文档 — Webnovel Writer Tier 6 · 经审 9.9

**日期**：2026-05-03
**作者**：结对 brainstorm（Claude + 项目维护者）
**状态**：已经用户分节批准；下一步规范自审 → 用户复核 spec → 调用 writing-plans
**前置基线**：`tier-5` 之后；`main` 工作树 clean；`tsc --noEmit` 0 错误；`npm test` 134/134 通过

---

## 0. 背景与目标

### 0.1 当前水位（2026-05-03 实测）
- Next.js 16 + React 19 + TypeScript 5.9，零运行时业务依赖（仅 `next` / `react` / `react-dom`）
- 已完成 5 轮分级 polish：Tier 1（韧性）→ 2（功能）→ 3（质量）→ 4a / 4b（清理 / 重构）→ 5（精简）
- 静态指标：`tsc --noEmit` 0 错误（已实测）；`npm test` 134/134 通过（已实测，3.2 s）；Git 工作树 clean
- 文档地基：README + ARCHITECTURE + CONTRIBUTING + 5 ADR + 历史 specs / plans 完整
- 代码量：9,233 行 / 125 文件（lib + app + components）

### 0.2 为什么还要 Tier 6
当前 README 与 CHANGELOG 标注的"9.9 polish 完成"基于**自评**：
- 5 轮 polish 都是"先设计 → 实施 → 报告"的开方式审计，**没有用真实 build / dev / E2E / a11y serious / coverage / bundle / npm audit 数据反向验证**。
- "号称 9.9" ≠ "经审 9.9"。Tier 6 的唯一目的就是用客观数据替换主观自评。

### 0.3 用户决策（brainstorming 阶段固化）
1. 核心交付：**两段闭环**——先跑通取证，再证据驱动修复（方案 C）。
2. 审计维度（全选 4 项）：性能 & Bundle / a11y 深度 + 键盘全路径 / 代码及测试覆盖 / 安全复查 + DX。
3. 允许新增 devDep：`c8`（coverage）、`@next/bundle-analyzer`（bundle 体积分析）。运行时依赖**不增**。

### 0.4 目标 / 非目标
**目标**
1. 用真实运行 / 扫描数据替换 README 与 CHANGELOG 里的"号称 9.9"，落盘成可独立提交、可被外部 reviewer 审阅的 **Tier 6 Audit Report**。
2. **证据驱动修复**：仅修 Pass 1 中已观测到的真实 finding；空 finding 维度直接跳过。
3. 保持 9.9 基线：`tsc --noEmit` 0 错误 / `npm test` ≥ 134 全绿 / `npm run build` 干净 / 0 运行时新依赖。

**非目标**
- 不引入新 AI provider、不动模态框架构、不加 i18n、不引入运行时依赖、不重写历史 polish 的成果。
- 不为了"凑改动"而改代码：Pass 2 改动量正比于 (Pass 1 finding 数 × 单点修复成本)，可以为 0。
- 不在本轮做规模扩张性新功能（新页面、新 modal、写作能力扩展）。

### 0.5 硬不变量（贯穿 Pass 1 + Pass 2）

| # | 不变量 | 验收信号 |
|---|--------|----------|
| I1 | 类型零错误 | `npx tsc --noEmit` exit 0、stdout 空 |
| I2 | 测试零失败 | `npm test` `# fail 0`、`# pass ≥ 134` |
| I3 | 构建干净 | `npm run build` exit 0，无 webpack 警告升级为错误 |
| I4 | 零运行时依赖增长 | `package.json` `dependencies` 仍为 `next` / `react` / `react-dom`；新增只能进 `devDependencies` |
| I5 | 行为零回归 | 所有 Playwright E2E（含 axe-core critical）继续通过 |
| I6 | 文档与代码同步（Pass 2 强制 / Pass 1 仅当新增 npm script 或 env gate 时强制） | 任何 polish 引发的承诺（新 envvar、新脚本）必须在 README / ARCHITECTURE / CHANGELOG 中体现 |

---

## 1. Pass 1 · Audit Pass（只读取证）

### 1.1 步骤与产物（按顺序执行）

| 步 | 动作 | 产物 / 落盘位置 |
|----|------|------------------|
| P1.0 | `npm ci` 确认 lockfile 锁定的依赖完整安装 | 终端日志 → 报告附录 A |
| P1.1 | `npx tsc --noEmit` | 已通过；记录耗时与文件覆盖数 |
| P1.2 | `npm test` 全量 | 已通过；保留 134 总数 + duration 至报告 |
| P1.3 | `npm run build` | `.next/` 构建输出 + 路由级 First Load JS 表（Next 自带）→ 报告 §"Bundle"；构建警告 → 报告 §"Build warnings" |
| P1.4 | 启动 `npm run dev` 后探测 `/`（`curl -sI`，3-5 次） | HTTP 200 + 路由响应耗时分布 → 报告 §"Dev smoke" |
| P1.5 | `npm run test:e2e`（mock AI，已有 6 specs） | 全绿即过；任一红记入 finding |
| P1.6 | **a11y 扩级**：临时新建一份 axe-core spec `tests/e2e/_audit-a11y.spec.mjs`（前缀 `_` 仅为命名约定，文件**必须**以 `.spec.mjs` 结尾才能被 Playwright 抓到），把 severity 从 `critical` 扩到 `serious + moderate`，跑一次拿违例清单后**rm 该文件 + 不进 commit**。Pass 1 commit 前用 `git status` 确认该文件不在 working tree。 | violations[] → 报告 §"a11y findings" |
| P1.7 | **Bundle analyze**：`devDep` 加 `@next/bundle-analyzer`，`next.config.ts` 用 env gate `ANALYZE=1` 开关，跑 `ANALYZE=1 npm run build`，截图 / 文本化体积分布 | 报告 §"Bundle composition"（top 10 modules + route-level chunks） |
| P1.8 | **Coverage**：`devDep` 加 `c8`，新加 npm script `"test:coverage": "c8 --reporter=text-summary --reporter=lcov npm test"`，跑出 line / branch / function 三向覆盖率 | 报告 §"Coverage gaps"（按文件按 branch% 倒排） |
| P1.9 | `npm audit --omit=dev`（运行时） + `npm audit`（含 dev） | 报告 §"npm audit"（按 severity 分桶） |
| P1.10 | DX 卷宗：`grep` 出所有 envvar、checked README ↔ 实际代码差；首次启动后未配置 API key 时的错误面文案抓取 | 报告 §"DX gaps" |

### 1.2 报告骨架（`docs/superpowers/specs/2026-05-03-tier-6-audit-report.md`）

```markdown
# Tier 6 Audit Report — 2026-05-03

## 0. 基线快照（指标 + 工具版本）
## 1. 性能 & Bundle    ← P1.3 / P1.7
## 2. a11y             ← P1.6
## 3. 测试覆盖与缺口    ← P1.2 / P1.5 / P1.8
## 4. 安全 & DX         ← P1.9 / P1.10
## 5. Findings 汇总（按 severity / ROI 排序）
## 6. 建议进入 Pass 2 的修复项（可空）
## 附录 A：原始命令与日志摘录
```

### 1.3 Pass 1 允许的代码改动（**仅这两类**）
1. `package.json` 加 `c8` / `@next/bundle-analyzer` 到 `devDependencies`；加 `test:coverage` / `analyze` 两个 npm script。
2. `next.config.ts` 加一个 env-gated `withBundleAnalyzer` 包装（默认关闭，0 行为变化）。

其它任何业务代码、组件、API 路由、CSS 在 Pass 1 都**不动**。Pass 1 结束打 tag `tier-6-audit`。

### 1.4 Pass 1 验收信号
- 报告产出 + commit 入仓
- I1–I5 不变量全部仍然满足；I6 仅约束新增的 npm script / env gate 必须在 README 体现
- 报告 §5 给出**显式 finding 列表（可为空集）**
- 报告 §6 列出 Pass 2 候选项（按 ROI 倒排，每项标注预估工作量 S / M / L）

---

## 2. Pass 2 · Fix Pass（证据驱动修复）

### 2.1 触发与门禁
- Pass 2 仅在 Pass 1 报告 §6 至少有 **1 个 finding 被标为"建议修复"** 时启动；否则直接 close 本轮，把 README 徽章升级为 *"Tier 6 audited · 0 findings"*。
- 从 §6 候选项里筛入 Pass 2 的标准：**ROI ≥ M**（修复成本 ≤ 1 个分级 commit、收益可被一条具体验收信号验证）。低 ROI 进 backlog（写到 CHANGELOG `## Backlog (deferred)` 段，不丢失记录）。

### 2.2 Sub-tier 划分（按需启用，可为空）

| Sub-tier | 主题 | 触发条件 | 典型修复手段（仅当对应 finding 存在时才做） | tag |
|----------|------|----------|-------------------------------------------|-----|
| **6.1** | 性能 & Bundle | P1.3 / P1.7 出现：① 任一路由 First Load JS 超 §2.3 红线，或 ② 单 module 占该路由 chunk ≥ 30% 且不属于 `next` / `react` / `react-dom` | 重型 modal 改 `dynamic()` import、抽 vendor chunk、移除冗余 polyfill | `polish-tier-6.1` |
| **6.2** | a11y serious / moderate | P1.6 出现 ≥1 条 serious / moderate violation | 补 `aria-label` / `role` / `aria-live` / `aria-controls`、键盘焦点序、跳过链 | `polish-tier-6.2` |
| **6.3** | 测试覆盖 | P1.8 显示 critical path branch coverage < 阈值 或 P1.5 暴露 E2E 路径缺口 | 针对低覆盖文件加单元测试；E2E 补失败重试 / abort 中途 / 限流退避 | `polish-tier-6.3` |
| **6.4** | 安全 & DX | P1.9 ≥1 高危 advisory 或 P1.10 出现 DX 痛点 | 升级有 advisory 的 devDep；优化未配置 API key 时的引导面 / 错误文案 | `polish-tier-6.4` |

每个 sub-tier 独立 commit、独立 tag、独立 verification 信号。哪怕只跑通 1 个 sub-tier 也是合法收尾。

### 2.3 阈值（Pass 1 报告里要先量化、Pass 2 才有标尺）

| 指标 | 目标线 | 红线 |
|------|--------|------|
| First Load JS（首页） | ≤ 90 KB gzipped | > 130 KB |
| 任一路由 First Load JS | ≤ 110 KB gzipped | > 160 KB |
| Statement coverage（lib/ + app/api） | ≥ 80% | < 65% |
| Branch coverage（lib/api、lib/ai、lib/projects） | ≥ 75% | < 60% |
| axe-core（critical + serious） | 0 violation | ≥ 1 |
| axe-core（moderate） | 全部记入报告；可低成本修复（单点 ≤ 30 分钟）的修掉，剩余进 backlog 并写明原因 | ≥ 5 条既不修也不在 backlog 说明 |
| `npm audit` high / critical | 0 | ≥ 1 |

> 目标线达到即不进 Pass 2；落在目标线与红线之间记入 backlog；红线触发 Sub-tier 启用。

### 2.4 修复纪律（写进每个 Pass 2 commit message 前 3 行）
1. `finding: <#编号> from audit-report §X.Y`
2. `threshold: <metric> <before>→<after>`
3. `verify: <one shell command that returns exit 0>`

### 2.5 Pass 2 验收信号
- 每个启用的 sub-tier 拿 tag
- 不变量 I1–I6 仍然成立
- 报告新增 §7「Pass 2 闭环结果」表格：finding → fix commit → 验收命令 → before / after 数值
- README 徽章 + CHANGELOG 同步刷新

### 2.6 失败 / 中止策略
- 若任一 sub-tier 修复后跑测 / 构建变红：先 revert 到 sub-tier 起点 commit，把 finding 转入 backlog，标"修复方案需要重新设计"——不勉强往下推。
- Pass 2 整体可被随时打住（哪怕只完成 6.1）；剩余 sub-tier 进入 backlog，下一轮再启动。

---

## 3. 交付物 / 时间线 / 跨 Pass 一览

### 3.1 文档交付物

| 文档 | 路径 | 写于 |
|------|------|------|
| **设计文档**（本文件） | `docs/superpowers/specs/2026-05-03-tier-6-design.md` | brainstorming 终态 |
| **Pass 1 审计报告** | `docs/superpowers/specs/2026-05-03-tier-6-audit-report.md` | Pass 1 结束 |
| **Pass 2 实施计划**（仅当 Pass 2 启用） | `docs/superpowers/plans/2026-05-03-tier-6-fix-plan.md` | Pass 2 启动前 |
| **CHANGELOG 更新** | `CHANGELOG.md` 顶部新增 `## 2026-05-03 — Tier 6` | 各阶段完成时增量追加 |
| **README 徽章 / 章节更新** | `README.md` | Pass 1 / 2 收尾 |

### 3.2 Git 标记 / 提交边界

```
main
 ├── tier-6-audit                ← Pass 1 完成
 │     └─ Files: package.json, package-lock.json, next.config.ts,
 │               docs/.../tier-6-audit-report.md,
 │               docs/.../tier-6-design.md
 │
 ├── polish-tier-6.1 (optional)  ← Pass 2 sub-tier 之一
 ├── polish-tier-6.2 (optional)
 ├── polish-tier-6.3 (optional)
 ├── polish-tier-6.4 (optional)
 │
 └── tier-6-closed               ← Pass 2 完成或 0 finding 直接收尾
       └─ Files: README.md badges, CHANGELOG, audit-report §7
```

每个 tag 处工作树 clean、不变量全绿（Pass 1 阶段 I1–I5 + I6 仅约束新增脚本；Pass 2 阶段 I1–I6 全部）。任一 sub-tier 都可独立 revert 而不影响其它 sub-tier。

### 3.3 时间线（执行视角）

| 阶段 | 预估耗时 | 代码改动量 | 中止成本 |
|------|----------|-------------|----------|
| 设计落盘 + 自审 | 5–10 分钟 | 0 | 极低 |
| Pass 1 执行 | 20–40 分钟 | 仅 `package.json` + `next.config.ts` 微调 | 低 |
| Pass 1 报告评审 | 您看 + 反馈 | 0 | 低 |
| Pass 2 启动决策 | 您一句话决定哪些 sub-tier 启用 | 0 | 低 |
| 每个 sub-tier 实施 | S = 10–20 分钟 / M = 30–60 分钟 / L = 1–2 小时 | 行级修复 | 单 sub-tier 可 revert |

> 总投入下限（Pass 1 全绿、0 finding）：约 30 分钟。
> 总投入上限（4 sub-tier 全启用且都是 M 级）：约 4 小时。

### 3.4 中止 / 暂停约定
- 用户随时发 `pause` / `中止` / `暂停打磨`，立刻停在最近的 commit / tag。
- Pass 1 报告产出后**默认等用户批准再启动 Pass 2**。
- Pass 2 中任意 sub-tier 完成后先 push commit + tag，再请用户 OK 后做下一个。

### 3.5 验收最终态（两种合法终态）
- **A · 0-finding 收尾**：Pass 1 报告 0 finding；README 徽章升级 `Tier 6 audited`；项目代码无业务改动。
- **B · 修复闭环收尾**：Pass 1 报告 N findings；Pass 2 修了 M ≤ N 个（剩余进 backlog）；每个修复都有 finding ↔ commit ↔ verify 命令的三向追溯。

无论 A 还是 B，README 第一段的"号称 9.9"将被替换为带 §2.3 量化指标的"经审 9.9"。

---

## 4. 用户已固化的决策清单（避免后续偏移）

1. ✅ 执行策略：**方案 C 两段闭环**（不是 A 一次性大计划，也不是 B 四并列 sub-tier）
2. ✅ 审计维度：**全选 4 项**（性能 & Bundle / a11y 深度 + 键盘全路径 / 代码及测试覆盖 / 安全复查 + DX）
3. ✅ devDep 边界：允许 `c8` + `@next/bundle-analyzer`；运行时依赖不增
4. ✅ a11y 扩级方式：临时 spec 副本 + 跑完即删，不污染主 E2E suite
5. ✅ Pass 2 启动门禁：每个 sub-tier 独立可启可不启；红了 revert 不硬推
6. ✅ Pass 1 → Pass 2 之间的人工 gate：用户批准后才启动

---

## 5. 后续步骤（本设计落盘后）
1. 规范自审（占位符 / 矛盾 / 模糊 / 范围 4 项快速过一遍）
2. 用户复核本 spec
3. 调用 `superpowers:writing-plans` 产出 Pass 1 实施计划（即开始执行 Pass 1 所需的可勾选任务序列）
