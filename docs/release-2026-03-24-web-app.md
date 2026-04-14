# 2026-03-24 Web App 发布说明

状态：`current`

版本定位：`首个可部署 Web App 交付版`

## 本次发布是什么

本次发布将项目主入口统一为 Next.js Web App。

目标不是做一套演示页面，而是交付一套能继续创作、能继续回归、能继续部署的网文写作工作台，同时保留既有目录式小说项目兼容能力。

## 本次发布交付了什么

- `/dashboard`、`/ideation`、`/library`、`/outline`、`/writing`、`/review`、`/settings` 七个主模块路由
- `/` 自动重定向到 `/dashboard`
- `plan + write` 双入口工作流
- 审查页推荐项可深链回写作页执行修补
- OpenAI / Anthropic / OpenRouter 设置持久化
- 未配置当前提供商 API Key 时，相关 AI 按钮自动禁用并给出明确提示
- 保留既有项目结构兼容：
  `.webnovel/state.json`、`.webnovel/index.db`、`设定集/*.md`、`大纲/*.md`、`正文/*.md`

## 适合谁直接使用

- 想把当前项目当成网页写作台直接部署的人
- 已经积累了目录式小说项目，希望无迁移接入的人
- 想保留旧 `.claude` / Claude Code 工作流，但新增 Web 入口的人

## 已完成验证

截至 `2026-03-24`，已在 Linux ext4 目录完成：

```bash
npm test
node ./node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:e2e
```

默认浏览器回归结果：

- 3 个 smoke 用例通过
- 3 个 `live-ai` 用例按设计跳过

说明：

- 跳过并非失败，而是因为 `live-ai` 用例需要真实 API Key
- 正式交付或发版验收时，如需纳入真实 AI 质量验证，应单独提供密钥并执行 live-AI 套件

部署步骤与发版前检查清单不在本说明中展开，直接看 [`docs/deployment-checklist.md`](deployment-checklist.md)。

## 当前边界

- 本次发布不包含 Electron / Tauri 打包
- 不包含线上 CI/CD 编排
- 不包含生产密钥托管方案
- 不包含自动化的真实 AI 质量门禁

## 接手方下一步建议

1. 先决定默认 AI 提供商与密钥策略。
2. 再决定是否需要把 `live-ai` 用例纳入发版前检查。
3. 如需桌面版，再单独立项做 Electron / Tauri 打包，而不是混入当前 Web 交付基线。
