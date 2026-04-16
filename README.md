# Webnovel Writer

[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)

基于 Next.js 16 + React 19 的长篇网文 AI 辅助创作系统，支持 200 万字量级连载创作。

零运行时依赖（仅 Next.js / React），单页面模态框架构，内置 9 家 AI 提供商适配。

## 快速开始

```bash
npm install
npm run dev          # 开发服务器 http://localhost:3000
npm run build        # 生产构建
npm test             # 单元测试 (66 tests)
npm run test:e2e     # E2E 测试 (Playwright)
```

### 环境变量 (可选)

| 变量 | 说明 |
|------|------|
| `WEBNOVEL_WRITER_KEY` | API Key 加密密钥（推荐在生产环境设置） |
| `WEBNOVEL_WRITER_CONFIG_ROOT` | 配置文件存储目录（默认 `~/.webnovel-writer`） |

## 核心功能

- **多 AI 提供商支持** — OpenAI、Anthropic、OpenRouter、DeepSeek、通义千问、智谱 GLM、Gemini、Mistral、通用聚合 API
- **一体化创作台** — 编辑、规划、生成、审查全在一个页面完成
- **章节任务书** — 结构化的章节执行计划，AI 根据任务书精准生成
- **项目管理** — 多项目切换、立项信息管理、审查问题追踪
- **暗色模式** — 支持亮/暗主题切换，自动跟随系统偏好
- **专注模式** — 隐藏工具栏，沉浸式写作体验
- **自动保存** — 30 秒自动保存，防止意外丢失
- **键盘快捷键** — Ctrl+S 保存、Ctrl+B 任务书面板

## 技术架构

### 单页面 + 模态框架构

所有功能集中在 `/` 页面，通过模态框承载不同功能区域：

| 模态框 | 功能 | 触发方式 |
|--------|------|----------|
| 项目管理 | 创建/切换项目 | 工具栏项目下拉 |
| 立项 | 编辑作品核心定位 | 工具栏「立项」按钮 |
| 审查 | 查看问题和修补建议 | 工具栏「审查」按钮 |
| AI 连接 | 配置 AI 提供商和密钥 | 工具栏 AI 状态 / 齿轮图标 |

### API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/projects` | GET, POST | 项目列表 / 创建项目 |
| `/api/projects/current` | GET, PUT | 当前项目 / 切换项目 |
| `/api/projects/current/documents` | GET, POST, PUT | 文档 CRUD（章节/设定/大纲） |
| `/api/projects/current/briefs` | GET, PUT | 章节任务书 |
| `/api/projects/current/context` | GET | 章节上下文构建 |
| `/api/projects/current/ideation` | GET, PUT | 立项数据 |
| `/api/projects/current/actions` | POST | AI 操作（规划/生成） |
| `/api/projects/current/review` | GET | 审查摘要 |
| `/api/settings/providers` | GET, PUT | AI 提供商配置 |
| `/api/settings/providers/test` | GET | 测试 AI 连接 |

### 项目结构

```
app/
├── page.tsx                    # 主页面（服务端组件）
├── layout.tsx                  # 根布局（暗色模式防闪烁）
├── globals.css                 # 全局样式（含暗色主题）
├── loading.tsx                 # 骨架屏加载
├── error.tsx                   # 错误边界
└── api/                        # 11 个 API 路由

components/
├── app-shell.tsx               # 应用外壳（工具栏 + 模态框）
├── toolbar.tsx                 # 顶部工具栏（项目/AI状态/主题切换）
├── bottom-bar.tsx              # 底部操作栏（标签/文件选择/AI按钮）
├── creative-workspace.tsx      # 核心编辑工作区
├── connection-wizard.tsx       # AI 连接配置向导
├── ideation-form.tsx           # 立项表单
├── project-workspace-panel.tsx # 项目管理面板
├── review-issue-list.tsx       # 审查问题列表
├── ui/                         # 基础 UI 组件
│   ├── modal.tsx               # 模态框
│   ├── dropdown.tsx            # 下拉菜单
│   └── bottom-panel.tsx        # 底部滑出面板
└── workspace/
    └── chapter-brief-editor.tsx # 章节任务书编辑器

lib/
├── ai/                         # AI 集成层
│   ├── actions.js              # AI 动作编排
│   ├── providers.js            # 9 家提供商适配
│   ├── guardrails.js           # 原创性护栏
│   ├── write-guard.js          # 写前检查
│   └── repair-*.js             # 修补建议
├── api/                        # API 工具
│   ├── rate-limit.ts           # 内存速率限制
│   ├── sanitize.ts             # 输入净化
│   └── sanitize-error.ts       # 错误消息净化
├── projects/                   # 项目数据层
│   ├── discovery.js            # 项目发现
│   ├── workspace.js            # 工作区管理
│   ├── documents.js            # 文档读写
│   ├── briefs.js               # 任务书读写
│   ├── context.js              # 上下文构建
│   ├── state.js                # 状态管理（带互斥锁）
│   ├── sync.js                 # 章节产物同步
│   └── review.js               # 审查摘要
├── settings/
│   ├── provider-config.js      # 提供商配置（AES-256-GCM 加密）
│   └── encryption.js           # 加解密工具
└── utils.js                    # 共享工具函数

types/                          # TypeScript 类型定义
tests/                          # 66 个单元测试 + E2E 测试
```

### 安全特性

- **API Key 加密存储** — AES-256-GCM 加密，支持自定义密钥
- **输入净化** — 所有用户输入经过控制字符过滤和长度限制
- **速率限制** — AI 操作和设置接口均有请求频率限制
- **SSRF 防护** — 阻止提供商 URL 指向内网地址
- **错误消息净化** — 阻止内部路径泄露

## Claude Code 集成

本项目同时包含完整的 Claude Code 辅助创作系统（`.claude/` 目录）：

- **8 个专职 Agent** — 上下文、数据链、追读力、连贯性、一致性、节奏、爽点、OOC 检查
- **7 个核心 Skill** — 初始化、规划、写作、审查、查询、恢复、学习
- **Python 数据脚本** — SQLite 索引管理、上下文提取、风格采样
- **题材模板库** — 37 种网文题材模板 + 反套路库

详见 [CLAUDE.md](CLAUDE.md) 获取完整的创作工作流说明。

## 开发

```bash
npm run dev          # 启动开发服务器
npm test             # 运行单元测试
npm run test:e2e     # 运行 E2E 测试
npm run build        # 生产构建
```
