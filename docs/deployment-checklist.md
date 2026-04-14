# Web App 部署检查清单

状态：`current`

适用对象：准备把当前版本部署到测试环境、预发环境或正式环境的人。

## 1. 环境检查

上线前先确认：

- Node.js 为 `20+`
- 部署目录位于 Linux / ext4 文件系统
- 当前仓库不是直接运行在 `/mnt/d/...` 这类 Windows 挂载盘上
- 目标机器具备 `npm install`、`npm run build`、`npm run start` 所需权限

如需启用真实 AI：

- 已确定默认提供商：`openai`、`anthropic` 或 `openrouter`
- 已准备对应 API Key
- 已明确密钥保存策略，不把真实密钥写入仓库

## 2. 部署前检查

发版前至少确认以下事项：

- 首页是否应继续重定向到 `/dashboard`
- 当前主流程是否完整可达：立项、设定、大纲、写作、审查、设置
- 旧项目目录是否需要直接接入
- 兼容目录结构是否保持不变：
  `.webnovel/state.json`、`.webnovel/index.db`、`设定集/*.md`、`大纲/*.md`、`正文/*.md`
- 未配置 API Key 时，AI 功能是否应该保持禁用

## 3. 发版前验证

推荐按以下顺序执行：

```bash
npm install
npm test
node ./node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:e2e
```

结果判定：

- `npm test` 必须通过
- `tsc --noEmit` 必须通过
- `npm run build` 必须通过
- `npm run test:e2e` 的 smoke 用例必须通过

如果要把真实 AI 也纳入发布门禁，再额外执行：

```bash
WEBNOVEL_WRITER_E2E_LIVE_AI=1 \
WEBNOVEL_WRITER_E2E_API_KEY=your_key \
npm run test:e2e:live-ai
```

## 4. 上线后核查

启动应用后，至少人工确认：

- `/dashboard` 正常打开
- 项目创建、切换、发现正常
- 设定集、大纲、正文文档可读取
- 写作页与审查页之间的深链修补动作正常
- 设置页保存与清空 API Key 的行为正常
- 移动端宽度下无明显横向溢出

## 5. 当前不应误判为缺陷的事项

以下现象在当前版本中是预期行为：

- 未配置当前提供商 API Key 时，AI 按钮禁用
- 默认 `test:e2e` 跳过 `live-ai` 用例
- `/mnt/...` 环境可用于开发和部分回归，但不建议作为正式构建目录

## 6. 交付建议

如果要把这版作为稳定基线交付，建议同时附上：

- `README.md`
- `CHANGELOG.md`
- `docs/web-app-delivery.md`
- `docs/release-2026-03-24-web-app.md`
- 本清单
- `docs/handoff-faq.md`
