# Webnovel Writer

[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-134%20passing-brightgreen.svg)](./CHANGELOG.md)
[![Type-check](https://img.shields.io/badge/tsc-0%20errors-brightgreen.svg)](./CHANGELOG.md)
[![Polish](https://img.shields.io/badge/polish-tier%205-gold.svg)](./CHANGELOG.md)

基于 Next.js 16 + React 19 的长篇网文 AI 辅助创作系统，支持 200 万字量级连载创作。

**零运行时依赖**（仅 `next` / `react` / `react-dom`）、单页面模态框架构、内置 9 家 AI 提供商适配、端到端 AbortController 支持、Anthropic prompt caching、结构化日志 + request-id 追踪。

---

## 快速开始

```bash
npm install
npm run dev          # 开发服务器 http://localhost:3000
npm run build        # 生产构建
npm test             # 单元 + 组件测试 (134)
npm run test:e2e     # Playwright E2E (6 specs)
```

### 环境变量（可选）

| 变量 | 说明 |
|------|------|
| `WEBNOVEL_WRITER_KEY` | AES-256-GCM 加密密钥（推荐在生产环境设置） |
| `WEBNOVEL_WRITER_CONFIG_ROOT` | 配置文件存储目录（默认 `~/.webnovel-writer`） |
| `WEBNOVEL_DISABLE_PROMPT_CACHE` | 设为 `1` 禁用 Anthropic prompt caching |
| `TRUST_PROXY` | 设为 `true` 时 rate-limit 信任 `X-Forwarded-For` |

---

## 核心功能

### 写作体验

- **一体化创作台** — 编辑、规划、生成、审查全在一个页面
- **Markdown 预览 / 分屏 / 专注三态切换**
- **章节任务书** — 结构化执行计划，AI 根据任务书精准生成
- **字数目标进度环** — SVG 进度环 + 超目标金色提示
- **自动保存 + 指数退避** — 30s 周期，失败后 30→60→120→300s 退避
- **Ctrl+S 保存 / Ctrl+B 任务书 / Esc 关闭**
- **暗色 / 亮色模式** — 跟随系统或手动切换，localStorage 持久化
- **专注模式（Zen Mode）** — 隐藏工具栏

### AI 集成

- **9 家提供商** — OpenAI、Anthropic、OpenRouter、DeepSeek、通义千问、智谱 GLM、Gemini、Mistral、通用聚合 API
- **端到端 AbortController** — UI → API → Provider 全链路可取消
- **Anthropic prompt caching** — `cache_control: ephemeral` 降低重复调用成本
- **批量章节生成** — 顺序执行 + 限流感知（429 退避）+ 暂停 / 停止
- **一键项目骨架** — 世界观 / 主角卡 / 反派 / 总纲 / 卷大纲 5 项
- **参考作品分析** — 抽象结构机制提炼（7 维度）
- **Token / 延迟遥测** — 底部状态栏实时显示

### 项目管理

- **多项目切换** — 下拉切换 + 搜索
- **章节快速搜索** — 标题 / 文件名 / 章号模糊匹配
- **导出** — 单章 `.md` 或全部合并 `.txt`
- **立项信息** — 题材 / 读者 / 金手指 / 卖点

---

## 架构

单页 `/` + 模态框壳。所有特性通过 Portal 模态挂在 `AppShell` 下；路由只用于 API。详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

```
app/                 Next.js 页面 + API 路由 + middleware
components/          React 组件 (单页面模态)
  hooks/             useAutoSave · useAiRunner · useKeyboardShortcuts
  workspace/         editor-surface · batch-progress-section · chapter-brief-editor
  ui/                modal · dropdown · bottom-panel
lib/
  ai/                providers · actions · prompts/ · telemetry · batch-scheduler
  api/               rate-limit · sanitize · with-route-logging · use-modal-resource
  projects/          discovery · documents · briefs · context · sync · state · export
  settings/          provider-config · encryption
  ui/                focus-trap · chapter-search · word-count-ring
  editor/            format
  log.js             结构化 JSON / colored / silent-in-test
middleware.ts        X-Request-Id 注入
types/               TypeScript 声明
tests/
  setup/             linkedom DOM shim + RTL 封装
  components/        组件单元测试
  e2e/               Playwright E2E (dark-mode · export · batch · scaffold · reference · smoke)
docs/
  adr/               5 个架构决策记录
  superpowers/       specs/ · plans/ (打磨设计与实施计划)
```

---

## 安全基线

- **AES-256-GCM** 密钥加密存储
- **速率限制** — 每 IP 每分钟 10-20 次（AI 10 / settings 20）
- **SSRF 防护** — IPv4 / IPv6 私网 + 云 metadata 黑名单
- **输入净化** — 所有 API 路由经过 `sanitizeInput` + `sanitizeContent`
- **文件锁 + 原子写** — `state.json` 无竞态
- **错误消息净化** — 自动剥离绝对路径
- **X-Request-Id** — 每个 API 响应头有唯一请求标识，便于日志追踪

详见 ADR：[`docs/adr/0002-aes-gcm-config-encryption.md`](./docs/adr/0002-aes-gcm-config-encryption.md)

---

## 质量基线

- **测试**：134 unit / component + 6 Playwright E2E
- **TypeScript**：`npx tsc --noEmit` 0 errors（strict mode）
- **构建**：15 routes + middleware，首屏 ~80KB
- **a11y**：所有 E2E 末尾 axe-core 无 critical violation
- **运行时依赖**：3 个（next / react / react-dom）

**工具链**：node:test · `@testing-library/react` · `linkedom` · Playwright · `@axe-core/playwright`（均为 devDep）

---

## 打磨过程

本项目经历 5 轮 **risk-tiered polish**（见 ADR 0005），每轮独立 tag 可回滚：

| Tier | 主题 | Tag |
|------|------|-----|
| 1 | 正确性与韧性（auto-save / 批量限流 / 焦点陷阱 / Error Boundary...） | `polish-tier-1` |
| 2 | 价值功能（prompt caching / AI cancel / 预览 / 搜索 / 导出 / 进度环） | `polish-tier-2` |
| 3 | 质量地基（结构化日志 / request-id / E2E / ADR / CHANGELOG） | `polish-tier-3` |
| 4a | 零行为清理（死代码删除 / withRouteLogging / useModalResource） | `polish-tier-4a` |
| 4b | 结构重构（adapter 策略 / prompts 拆分 / workspace hooks） | `polish-tier-4b` |
| 5 | 细化精简（无效 state 删除 / EditorSurface / BatchProgressSection） | `polish-tier-5` |

详细过程见 [CHANGELOG](./CHANGELOG.md)。设计文档位于 `docs/superpowers/specs/`，实施计划位于 `docs/superpowers/plans/`。

---

## Claude Code 集成

本项目同时内置完整的 Claude Code 辅助创作子系统（`.claude/` 目录）：

- **8 个专职 Agent** — 上下文、数据链、追读力、连贯性、一致性、节奏、爽点、OOC 检查
- **7 个核心 Skill** — 初始化、规划、写作、审查、查询、恢复、学习
- **Python 数据脚本** — SQLite 索引管理、上下文提取、风格采样
- **题材模板库** — 37 种网文题材模板 + 反套路库

Webapp 运行时**不会**导入 `.claude/**`；两套系统独立运行。详见 [CLAUDE.md](./CLAUDE.md)。

---

## 贡献

提交规范、测试要求、PR 检查清单见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可

MIT — 见 [LICENSE](./LICENSE)。
