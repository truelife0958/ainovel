# 文档生命周期与归类

本文件用于统一管理仓库文档的状态，避免“过时文档混在当前流程中”。

## 状态定义

- **current**：当前流程的执行基线文档（可直接按文档操作）。
- **reference**：长期参考资料（方法论、模板、术语表），不等同于强制流程。
- **archived**：历史记录或阶段性报告，仅保留追溯价值，不作为当前流程依据。

## 归类规则

- 若文档描述的流程已被新版本实现替代，标记为 `archived`。
- 若文档是一次性测算/分析报告（如预算快照），完成后进入 `archived`。
- 若文档被技能/脚本直接读取，必须保留为 `current` 或 `reference`，不得直接归档。

## 当前已归档文档

- `docs/archive/reports/data-flow-validation-v52.md`（阶段性数据流验证报告）
- `docs/archive/reports/token-budget-report-v52.md`（早期静态 token 预算报告）

## 当前核心基线（示例）

- `docs/README.md`
- `CHANGELOG.md`
- `README.md`
- `docs/web-app-delivery.md`
- `docs/release-2026-03-24-web-app.md`
- `docs/deployment-checklist.md`
- `docs/handoff-faq.md`
- `CLAUDE.md`
- `.claude/references/context-contract-v2.md`
- `.claude/references/claude-code-call-matrix.md`
- `.claude/references/genre-profiles.md`
- `.claude/references/reading-power-taxonomy.md`

## 当前参考文档（示例）

- `docs/untracked-classification.md`（本地工作区参考，不属于交付基线）
- `docs/superpowers/plans/*.md`（过程性计划记录）
- `docs/superpowers/specs/*.md`（过程性规格记录）

## 维护建议

- 每次发布新阶段功能时，检查是否有“旧报告/旧规范”仍位于根目录。
- 新增阶段性分析文档时，建议直接写入 `docs/archive/reports/`。
