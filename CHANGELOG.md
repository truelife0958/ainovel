# Changelog

## 2026-03-24

当前仓库完成了一版以 Web App 为核心入口的可交付版本。

### Added

- 基于 Next.js 的网页创作台
- 项目首页、立项、设定、大纲、写作、审查、设置 7 个主模块路由
- 与既有目录式小说项目兼容的项目发现、创建和切换
- OpenAI / Anthropic / OpenRouter 配置持久化
- Playwright 浏览器烟测与可选 live-AI 浏览器回归

### Improved

- `/` 统一重定向到 `/dashboard`
- dashboard、review、writing、settings、document workspace、app shell 的状态文案和快照视图统一为 helper 驱动
- 移动端无横向溢出的 smoke 覆盖扩展到 `dashboard` 和 `settings`
- 首屏标题区、项目快照、卡片层级、按钮和列表项交互反馈完成一轮视觉打磨
- README 顶部改为当前 Web App 交付入口

### Verification

截至 `2026-03-24`，已在 Linux ext4 目录完成：

```bash
npm test
node ./node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:e2e
```

默认 `test:e2e` 结果：

- 3 个 smoke 用例通过
- 3 个 `live-ai` 用例跳过

### Known Boundaries

- `live-ai` 用例需要真实 API Key 才会执行
- WSL 下若仓库位于 `/mnt/d/...`，正式构建仍建议在 Linux 文件系统目录中执行
- 当前交付范围不包含 Electron / Tauri 打包、生产密钥托管和线上 CI/CD 编排
