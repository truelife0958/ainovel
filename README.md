# Webnovel Writer

[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

基于 Next.js 16 + React 19 的长篇网文 AI 辅助创作系统，支持 200 万字量级连载创作。

## 快速开始

```bash
npm install
npm run dev          # 开发服务器 http://localhost:3000
npm run build        # 生产构建
npm test             # 单元测试
npm run test:e2e     # E2E 测试 (Playwright)
```

### 环境变量 (可选)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WEBNOVEL_WRITER_CONFIG_ROOT` | 配置目录路径 | `process.cwd()` |
| `NEXT_DIST_DIR` | Next.js 构建输出目录 | `.next` |

## AI 模型配置

支持 **9 个 AI 提供商**，通过设置页面 `/settings` 配置：

| 提供商 | 默认模型 | API 类型 |
|--------|---------|---------|
| OpenAI | gpt-5-mini | Responses API |
| Anthropic | claude-sonnet-4-5 | Messages API |
| OpenRouter | openai/gpt-5-mini | Chat Completions |
| DeepSeek | deepseek-chat | OpenAI Compatible |
| 通义千问 | qwen-plus | OpenAI Compatible |
| 智谱GLM | glm-4-flash | OpenAI Compatible |
| Gemini | gemini-2.0-flash | Google AI API |
| Mistral | mistral-large-latest | OpenAI Compatible |
| **通用API** | (自定义) | OpenAI Compatible |

**通用API (NewAPI/OneAPI)**：设置 Base URL 为你的聚合接口地址，Model 填写任意模型 ID，系统通过标准 `/v1/chat/completions` 路由。

### 角色路由

4 个写作环节可分别指定模型：立项、大纲、写作、审查。未指定则使用默认提供商的模型。

## 功能模块

| 页面 | 路径 | 功能 |
|------|------|------|
| 总览 | /dashboard | 项目概览、关键指标、快捷操作 |
| 立项 | /ideation | 题材、卖点、主角、金手指设定 |
| 设定 | /library | 世界观、角色卡、力量体系 |
| 大纲 | /outline | 总纲、卷纲、AI 规划增强 |
| 写作 | /writing | 任务书、上下文、AI 规划/生成、正文编辑 |
| 审查 | /review | 多维度质量扫描、审查报告 |
| 设置 | /settings | AI 提供商、API Key、模型路由 |

## AI 写作流程

```
章节任务书 → AI 规划本章 → 审查诊断 → AI 生成正文 → 人工润色
     ↑                                              ↓
     └──── 修补建议 ←── 结构检查 ←──────────────────┘
```

1. **AI 规划**：基于项目设定、大纲、前文摘要生成结构化任务书
2. **AI 生成**：根据任务书和上下文生成章节正文
3. **修补动作**：智能推荐修补建议（补齐钩子、强化爽点等）

## 项目结构

```
├── app/                  # Next.js App Router
│   ├── api/              # API 路由
│   │   ├── projects/     # 项目管理 + 文档/大纲/AI 动作
│   │   └── settings/     # 设置 (AI 提供商)
│   ├── dashboard/        # 总览页
│   ├── ideation/         # 立项页
│   ├── library/          # 设定页
│   ├── outline/          # 大纲页
│   ├── writing/          # 写作页
│   ├── review/           # 审查页
│   └── settings/         # 设置页
├── components/           # React 组件
│   ├── app-shell.tsx     # 全局布局壳
│   ├── document-workspace.tsx  # 通用文档编辑器
│   ├── writing-studio.tsx     # 写作工作台
│   ├── provider-settings-form.tsx  # AI 设置表单
│   └── ...
├── lib/
│   ├── ai/               # AI 适配层 (providers, actions, guardrails)
│   ├── hooks/            # React Hooks (useDocumentWorkspace)
│   ├── project/          # 单项目模式 (API 路由使用)
│   ├── projects/         # 多项目模式 (页面使用)
│   ├── settings/         # 配置管理、加密
│   └── ...
├── types/                # TypeScript 类型
├── tests/                # 单元测试
└── .claude/              # Legacy Claude Code 资产
```

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19
- **语言**: TypeScript + JavaScript (混合)
- **样式**: 纯 CSS (无 Tailwind)
- **存储**: 文件系统 (JSON + Markdown + SQLite)
- **安全**: AES-256-GCM 加密 API Key
- **测试**: Node.js test runner + Playwright E2E

## Legacy Claude Code 工作流

项目保留完整的 `.claude/` 目录，支持通过 Claude Code CLI 使用命令：

- `/webnovel-init` — 项目初始化
- `/webnovel-plan [卷号]` — 大纲规划
- `/webnovel-write [章号]` — 章节创作
- `/webnovel-review [范围]` — 质量审查
- `/webnovel-query [关键词]` — 信息查询

详见 [CLAUDE.md](CLAUDE.md)。

## 核心理念

- **大纲即法律** — AI 遵循大纲，不擅自发挥
- **设定即物理** — 遵守世界观设定，不自相矛盾
- **发明需识别** — 新实体自动入库管理

## 项目信息

- License: GPL v3
- 仓库: [GitHub](https://github.com/lingfengQAQ/webnovel-writer)

## API 路由一览

| 路径 | 方法 | 功能 |
|------|------|------|
| `/api/projects` | GET, POST | 项目列表、创建项目 |
| `/api/projects/current` | GET, PUT | 获取/切换当前项目 |
| `/api/projects/current/documents` | GET, POST, PUT | 文档管理 (设定/大纲/正文) |
| `/api/projects/current/briefs` | GET, PUT | 章节任务书 |
| `/api/projects/current/context` | GET | 章节上下文 |
| `/api/projects/current/actions` | POST | AI 动作 (规划/生成) |
| `/api/projects/current/ideation` | GET, PUT | 立项数据 |
| `/api/settings/providers` | GET, PUT | AI 提供商配置 |
