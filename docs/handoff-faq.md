# Web App 接手 FAQ

状态：`current`

适用对象：接手当前仓库并准备继续开发、部署或验收的人。

## 这版项目现在到底是什么

当前主入口已经是 Next.js Web App，不再只是命令流或目录脚手架。

它现在的定位是：

- 可直接运行
- 可直接部署
- 可继续扩展
- 同时兼容旧的目录式小说项目结构

## 旧项目还能不能直接用

可以。

当前版本保留了以下兼容结构：

- `.webnovel/state.json`
- `.webnovel/index.db`
- `设定集/*.md`
- `大纲/*.md`
- `正文/*.md`

如果你已有旧项目目录，优先直接接入，不建议先做人为迁移。

## 为什么不建议在 `/mnt/d/...` 里正式构建

因为 `/mnt/...` 属于 WSL 下的 Windows 挂载盘。

当前版本已经兼容了这类目录下的开发和部分浏览器回归，但正式 `next build` 仍更适合在 Linux / ext4 文件系统中执行，原因主要是：

- 依赖与缓存行为更稳定
- Next 构建链在 ext4 目录更可靠
- 更接近真实部署环境

结论很简单：

- 开发可以在 `/mnt/...`
- 正式构建和部署不要在 `/mnt/...`

## 为什么有些 AI 按钮是灰的

这是当前版本的设计，不是故障。

当你没有为当前默认提供商配置 API Key 时，相关 AI 按钮会自动禁用，并显示明确提示。

这样做是为了避免：

- 用户误以为 AI 已可用
- 在无密钥状态下触发无意义请求
- 把“配置问题”伪装成“功能异常”

## 现在支持哪些 AI 提供商

当前交付版支持：

- OpenAI
- Anthropic
- OpenRouter

设置页已支持保存和清空这些配置。

## 为什么 `npm run test:e2e` 里有跳过项

默认 E2E 分为两类：

- smoke：不依赖真实 AI Key
- live-ai：依赖真实 AI Key

因此默认跑 `npm run test:e2e` 时，`live-ai` 用例会跳过。这不是失败，是按设计分层。

如果你要执行真实 AI 回归，需要显式提供环境变量再跑 `npm run test:e2e:live-ai`。

## 当前最小可交付验证是什么

接手后，至少先跑这四项：

```bash
npm test
node ./node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:e2e
```

这四项是当前 Web App 基线是否仍然健康的最小判断面。

更完整的上线检查顺序，直接看 [`docs/deployment-checklist.md`](deployment-checklist.md)。

## 如果我要正式上线，先看哪几份文档

优先顺序建议如下：

1. `README.md`
2. `docs/web-app-delivery.md`
3. `docs/release-2026-03-24-web-app.md`
4. `docs/deployment-checklist.md`
5. 本 FAQ

## 这一版明确没有做什么

以下内容不在当前交付范围内：

- Electron / Tauri 桌面打包
- 线上 CI/CD 编排
- 生产密钥托管
- 自动化的真实 AI 质量门禁

如果要做这些内容，建议单独立项，而不是直接混进当前基线。

## 接手后的建议顺序

建议按这个顺序继续：

1. 先在 Linux / ext4 目录完成一次完整验证。
2. 再确定默认提供商和密钥策略。
3. 再决定是否把 `live-ai` 回归纳入发版门禁。
4. 最后才考虑桌面打包或 CI/CD 自动化。
