# Web App 交付说明

状态：`current`

最后校验日期：`2026-03-24`

## 这份文档解决什么问题

README 负责入口。

发布说明负责说明“这次发了什么”。

部署清单负责说明“上线前怎么检查”。

这份文档只负责当前 Web App 的交付基线，也就是：

- 当前产品覆盖到哪里
- 默认运行行为是什么
- 哪些能力明确不在本次交付里

## 当前交付范围

当前 Web App 已覆盖：

- 项目首页
- 立项台
- 设定集
- 大纲台
- 章节写作台
- 审查与诊断中心
- 模型与项目设置

兼容的数据结构：

- `.webnovel/state.json`
- `.webnovel/index.db`
- `设定集/*.md`
- `大纲/*.md`
- `正文/*.md`

当前产品定位：

- Web 优先
- 可打包 / 可部署
- 保留原有目录式小说项目兼容性
- AI 功能可选，不强绑真实 Key

## 运行与交付前提

- 生产构建优先在 Linux / ext4 文件系统目录中执行
- Node.js 使用 `20+`
- Web 部署是当前默认交付方式

如果仓库位于 `/mnt/d/...` 这类挂载盘：

- 开发和 Playwright 烟测已做兼容
- 正式构建仍建议复制到 Linux 文件系统目录后执行

部署命令、发版前验证和 live-AI 回归入口，统一看 [`docs/deployment-checklist.md`](deployment-checklist.md)。

## 当前默认行为

- 未配置当前默认提供商的 API Key 时，相关 AI 按钮直接禁用
- 设置页保存 API Key 后，无需改代码，AI 入口自动恢复
- 设置页支持显式清空已保存的 API Key
- 审查页可以深链回写作页执行推荐修补动作

## 继续交接时优先检查

1. 是否已有真实生产 API Key 和提供商策略。
2. 部署目录是否位于 Linux / ext4，而不是 `/mnt/...`。
3. 是否需要把 `live-ai` 用例纳入正式发版前检查。
4. 是否要补充打包方案，例如 Tauri / Electron，而不只保留 Web 部署。

补充材料：

- 发布快照看 [`docs/release-2026-03-24-web-app.md`](release-2026-03-24-web-app.md)
- 部署步骤看 [`docs/deployment-checklist.md`](deployment-checklist.md)
- 接手问答看 [`docs/handoff-faq.md`](handoff-faq.md)

## 不在本次交付内

- 真实生产 API Key 或密钥托管
- Electron / Tauri 打包实现
- 线上 CI/CD 编排
- 真实 AI 质量基准的自动发布门禁
