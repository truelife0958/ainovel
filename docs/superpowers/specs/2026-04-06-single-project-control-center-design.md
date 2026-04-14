# 单项目总控台设计

**Date:** 2026-04-06

## 目标

把当前 Webnovel Writer 从“多页并列的功能集合”升级为“单项目工作区”，让用户进入应用后先看到当前项目最该推进的动作，再在同一工作区内切换写作、大纲、设定、审查和 AI 设置。

这次改造的核心不是新增 AI 能力，而是重做产品形态：

- `/` 不再只是跳转到旧 `dashboard`
- `dashboard` 不再只是概览页，而是升级为默认的单项目总控台
- 写作推进是主角
- 大纲、设定、审查、Provider 状态作为同一工作区内的深入工作面存在
- 产品明确只强调远程 API，不提供本地模型作为产品入口

## 背景

当前仓库已经具备可复用的关键能力，但它们分散在不同页面中：

- 根路由仍然只是跳转器：`app/page.tsx`
- 应用外壳仍然是多页侧栏结构：`components/app-shell.tsx`
- `dashboard` 主要承担概览与项目访问，不是工作区：`app/dashboard/page.tsx`
- 最成熟的工作流资产在写作与通用文档编辑器：`components/writing-studio.tsx`、`components/document-workspace.tsx`
- AI Provider 已经是远程 API 架构：`lib/ai/providers.js`
- Provider 配置已经支持多提供商与角色路由：`components/provider-settings-form.tsx`、`lib/settings/provider-config.js`

所以这次设计优先解决的是：

1. 进入应用后缺少“现在该做什么”的统一判断
2. 写作、大纲、设定、审查、设置被拆成平级页面，项目感不强
3. AI Provider 是底层能力，但在产品层不是常驻可感知状态
4. 当前首页与深入编辑页之间缺少统一心智

## 产品决策

本设计确定以下产品决策：

1. 默认入口改为单项目总控台，而不是旧 `dashboard` 式概览页
2. 产品采用“总控台 + 深入工作面”的结构，而不是把所有编辑器硬塞在一个长页面里
3. 左侧导航、中央主工作区、右侧状态 rail 组成统一 `WorkspaceShell`
4. 总控台首页优先回答“当前最该做什么”
5. 深入工作面统一收编写作、大纲、设定、审查、AI 设置
6. AI 只走远程 Provider 路径，不把本地模型作为产品主路径
7. 优先复用现有成熟组件，不先重写写作与文档编辑器

## 非目标

本次设计不做以下事情：

- 不重写底层 AI 调用协议
- 不切换项目存储格式
- 不引入本地模型产品路径（如 Ollama / LM Studio / localhost 模型引导）
- 不把所有旧页面一次性删除后重做
- 不把总控台做成多人协作看板
- 不把实现范围扩大为新的 SaaS 多租户平台

## 设计原则

### 1. 总控先决策，工作面再编辑

总控台负责看盘、判断下一步、暴露风险、提供快捷入口。
真正的编辑行为发生在写作面、大纲面、设定面、审查面和 AI 设置面。

### 2. 单项目心智优先

用户应该始终感觉自己在一个项目工作区里，而不是在多个独立产品页之间跳转。

### 3. 远程 API 是一等能力

Provider、模型、API Key 就绪状态、角色路由，不再只存在于设置页，而要成为整个工作区随处可见的系统状态。

### 4. 先换壳，再渐进收编

优先搭建统一工作区外壳和新的首页，不先推倒重写成熟编辑器。

## 目标信息架构

### 顶层路由

建议新的工作区路由语义如下：

- `/` → 默认进入 `/workspace`
- `/workspace` → 单项目总控台首页
- `/workspace/writing?file=<chapter-file>` → 写作面
- `/workspace/outline?file=<outline-file>` → 大纲面
- `/workspace/library?file=<setting-file>` → 设定面
- `/workspace/review` → 审查面
- `/workspace/settings/ai` → AI 设置面

旧入口路由保留一段时间作为兼容入口：

- `/dashboard`
- `/writing`
- `/outline`
- `/library`
- `/review`
- `/settings`

这些旧路由最终应退化为重定向或薄包装入口，而不是一级产品导航。

### 统一工作区结构

整个产品采用三栏结构：

#### 左侧：项目级导航

只保留高频项目级入口：

- 总控台
- 写作
- 大纲
- 设定
- 审查
- AI 设置

作用：

- 保持单项目工作区心智
- 在不同工作面之间稳定切换
- 消除“多个平级产品页”的割裂感

#### 中央：主工作区

中央区根据当前路由渲染不同 surface：

- `/workspace`：总控台首页
- `/workspace/writing`：写作面
- `/workspace/outline`：大纲面
- `/workspace/library`：设定面
- `/workspace/review`：审查面
- `/workspace/settings/ai`：AI 设置面

#### 右侧：状态与上下文 rail

右侧 rail 常驻轻量但高价值的信息：

- 当前项目标题、题材、卷章进度
- 当前默认 Provider
- 当前写作模型 / 其他角色模型
- API Key 是否就绪
- 当前对象状态（如本章任务书完整度）
- 风险提醒
- 推荐下一步

这部分不是装饰，而是跨工作面的决策辅助区。

## 总控台首页设计

总控台首页是产品的默认入口，不再只是旧 `dashboard` 的概览面板集合。

首页固定包含四个核心模块。

### 1. 当前下一步（NextActionCard）

首页第一屏必须先回答：**现在最值得做的动作是什么？**

可出现的推荐动作类型包括：

- 继续写当前章
- 先补当前章任务书
- 先补卷纲或总纲中的缺口
- 先修复设定缺失
- 先完成 AI 设置，因为当前 API 未就绪
- 先执行审查，因为当前章节已完成但未审

该模块应展示：

- 一个主推荐动作
- 1–2 个次级动作
- 推荐原因
- 直接进入对应工作面的按钮

### 2. 章节推进队列（ChapterQueuePanel）

用队列而不是普通文档列表来呈现章节状态。

建议的章节状态分层：

- 待规划
- 待写
- 草稿中
- 待审查
- 待修订
- 已完成

作用：

- 让写作推进成为首页主轴
- 让用户能从首页直接进入某章
- 把“文件列表”升级为“创作流程队列”

点击某一章后：

- 进入 `/workspace/writing`
- 自动带上 `file` 参数
- 写作面自动定位该章节
- 右侧 rail 自动切换到该章上下文

### 3. 项目健康面板（ProjectHealthPanel）

项目健康面板负责回答：**当前项目哪里危险，先补哪里。**

建议包含以下健康维度：

- 大纲覆盖度
- 关键设定是否缺失
- 最近章节是否缺任务书
- 审查是否积压
- 当前 AI Provider 是否可用
- 当前写作角色模型是否明确
- 数据是否不足（无法可靠给出部分分析时要明确标注“数据不足”）

每张健康卡不只显示问题，还必须支持直达对应工作面：

- API 未就绪 → 进入 AI 设置面
- 任务书不完整 → 打开对应章节任务书
- 大纲缺口 → 打开对应大纲文件
- 设定缺关键资料 → 打开设定面并定位到对应文档

### 4. 快捷动作面板（QuickActionsPanel）

快捷动作面板服务高频操作，避免用户先导航再操作。

建议至少提供：

- 新建章节
- 为当前章生成任务书
- 继续写当前章
- 打开当前卷大纲
- 打开设定库
- 执行审查
- 打开 AI 设置

原则：

- 高频操作一跳可达
- 操作优先于说明文案
- 对 AI 动作要清楚显示当前会调用的 Provider / 模型

## 深入工作面设计

### 写作面（WritingSurface）

写作面优先复用 `components/writing-studio.tsx` 的成熟能力。

写作面承担：

- 章节选择
- 章节正文编辑
- 任务书查看与编辑
- 章节上下文读取
- AI 规划与 AI 写作动作
- 任务书结构提醒与写作拦截

相对于现状，写作面需要做的不是推翻重做，而是：

- 被收编进 `WorkspaceShell`
- 接入统一的右侧 rail
- 接收来自总控台首页的“下一步”与“章节队列”跳转
- 把当前 Provider / model 状态更显式地暴露给用户

### 大纲面（OutlineSurface）

大纲面优先基于 `components/document-workspace.tsx` 构建。

职责：

- 展示大纲文档列表
- 编辑总纲 / 卷纲 / 章纲等文档
- 执行 AI 大纲增强动作
- 从健康面板与快捷动作进入具体文档

### 设定面（LibrarySurface）

设定面也优先基于 `components/document-workspace.tsx` 构建。

职责：

- 展示设定文档列表
- 管理世界观、角色、力量体系等资料
- 提供 AI 辅助生成与整理能力
- 接住来自健康面板的缺口修复入口

### 审查面（ReviewSurface）

审查面不再是与其他页面平级的孤立页面，而是统一工作区内的质量与风险 surface。

职责：

- 展示最近审查结果
- 聚合关键质量问题
- 暴露待修复项
- 支持从审查结果直达对应章节 / 文档

### AI 设置面（AiSettingsSurface）

AI 设置面承接现有 Provider 配置能力，核心目标是把“设置页中的表单”升级为“整个产品可感知的系统能力”。

职责：

- 配置远程 Provider 的 API Key、Base URL、默认模型
- 配置角色路由（立项 / 大纲 / 写作 / 审查）
- 暴露当前默认 Provider 与写作主模型
- 明确显示哪些 Provider 已就绪、哪些未就绪

产品立场必须明确：

- 只强调远程 Provider
- 不新增本地模型导向文案
- `custom` 视为托管的 OpenAI-compatible API，而不是“本地服务模式”

## 组件拆分方案

建议引入新的工作区组件层，而不是直接把现有页面强行拼接。

### 工作区壳层

- `WorkspaceShell`
- `WorkspacePrimaryNav`
- `WorkspaceContextRail`

职责：

- 统一左侧导航、顶部项目信息和右侧状态 rail
- 为所有 workspace 路由提供共同外壳
- 吸收 `components/app-shell.tsx` 的布局职责，但升级为单项目工作区容器

### 总控首页层

- `WorkspaceHomeSurface`
- `NextActionCard`
- `ChapterQueuePanel`
- `ProjectHealthPanel`
- `QuickActionsPanel`

职责：

- 取代旧 dashboard 的首页组织方式
- 让首页成为驾驶舱而不是展示页

### 深入工作面层

- `WritingSurface`
- `OutlineSurface`
- `LibrarySurface`
- `ReviewSurface`
- `AiSettingsSurface`

职责：

- 分别承接写作、大纲、设定、审查、AI 设置
- 优先复用现有成熟组件
- 通过统一路由与统一 rail 接入单项目工作区

### 路由分发表层

- `WorkspaceSurfaceRouter`

职责：

- 根据当前路径和 query 参数渲染中央主工作区
- 保证总控台和深入工作面共享同一套壳与状态感知

## 数据流设计

### 首页聚合数据：WorkspaceSnapshot

总控台首页首屏不应临时拼接多个页面数据，而应由服务端聚合出一份面向首页的视图模型：`WorkspaceSnapshot`。

建议包含：

- 当前项目摘要
- 当前推荐动作
- 章节推进队列
- 项目健康状态
- Provider 运行状态
- 快捷动作可用性

这份数据可以吸收现有：

- `lib/projects/workspace.js`
- `lib/dashboard/focus.js`
- `lib/dashboard/metrics.js`

但输出目标应从“旧 dashboard 数据”切换为“总控台首页专用 ViewModel”。

### 工作面专属数据

进入不同 surface 后，再各自加载更细的数据。

#### 写作面

- 章节列表
- 当前章节正文
- 当前章节任务书
- 当前章节上下文
- AI 动作执行状态

#### 大纲 / 设定面

- 文档列表
- 当前文档内容
- AI 增强动作状态

#### 审查面

- 审查摘要
- 风险列表
- 问题到具体文档的映射

#### AI 设置面

- Provider 配置摘要
- 可编辑的 Provider 配置明细
- 角色模型路由状态

## 与现有 API 的关系

本设计优先复用现有 API 路径，而不是先重写后端接口。

现有关键路径包括：

- `/api/projects/current/actions`
- `/api/projects/current/briefs`
- `/api/projects/current/context`
- `/api/projects/current/documents`
- `/api/projects/current/ideation`
- `/api/settings/providers`

第一阶段的产品化改造以“重组页面与视图模型”为主，避免先做大规模 API 改名。

如果后续确定完全切换到新的 `/workspace` 语义，再考虑是否补齐新的聚合接口，例如：

- `/api/workspace/snapshot`
- `/api/workspace/next-action`
- `/api/workspace/health`

本设计不要求第一阶段就完成 API 改名。

## 远程 API 呈现规则

为保证产品立场清晰，AI 相关体验必须遵守以下规则：

1. 所有 AI 入口都以远程 Provider 为前提
2. 首页健康卡必须能暴露 API 未就绪问题
3. 右侧 rail 必须持续显示当前默认 Provider 与当前写作模型
4. 当某个 AI 动作将要执行时，界面应明确显示使用哪个 Provider / 模型
5. 缺少 API Key 时，允许用户继续手动编辑，但禁止执行 AI 动作
6. 不新增任何鼓励使用本地模型的产品入口或文案

## 错误处理

### 壳层不倒，模块局部报错

只要当前项目还可识别，`WorkspaceShell` 就应继续渲染：

- 左侧导航保留
- 顶部项目信息保留
- 右侧状态 rail 保留

不要因为某个模块加载失败就让整个工作区白屏。

### 首页模块级降级

- `NextActionCard` 失败：显示“暂时无法计算推荐动作”
- `ChapterQueuePanel` 失败：显示“章节队列加载失败”
- `ProjectHealthPanel` 失败：显示“健康数据暂不可用”
- `QuickActionsPanel` 应尽量在降级状态下仍保持可用

### AI 失败保护

- API Key 未配置：明确提示并直达 AI 设置面
- 当前 Provider 不可用：禁用 AI 动作，但允许继续人工编辑
- 当前 AI 调用失败：不能覆盖用户已有内容
- 切换章节 / 工作面时若有未保存改动：先阻止切换并提示保存
- `file` query 指向不存在文档：退回空态或默认项，不崩溃

## 实施顺序

### Phase 1：建立统一工作区壳

- 引入 `WorkspaceShell`
- 引入 `/workspace` 路由族
- 统一左侧导航和右侧 rail
- 保持旧页面仍然可访问

### Phase 2：把首页升级为总控台

- 新建 `WorkspaceHomeSurface`
- 实现“当前下一步、章节推进队列、项目健康、快捷动作”四大模块
- 将 `/` 指向新的总控台

### Phase 3：收编写作面

- 基于 `components/writing-studio.tsx` 实现 `WritingSurface`
- 接上章节队列、下一步推荐和右侧 rail 的联动
- 明确显示当前远程 Provider / model 状态

### Phase 4：收编大纲与设定面

- 基于 `components/document-workspace.tsx` 实现 `OutlineSurface` 与 `LibrarySurface`
- 支持从首页风险项和快捷动作直达具体文档

### Phase 5：收编审查面与 AI 设置面

- 把审查与 Provider 配置正式纳入统一工作区
- 让健康面板与 AI 设置状态互相打通

### Phase 6：旧入口退化为兼容路由

- `/dashboard`
- `/writing`
- `/outline`
- `/library`
- `/review`
- `/settings`

这些入口在完成迁移后应退化为重定向或薄包装页面。

## 验证方案

### 单元验证

重点验证四类逻辑：

1. `WorkspaceSnapshot` 聚合逻辑
2. “当前下一步”推荐规则
3. 项目健康状态计算
4. Provider / role model 状态映射

### 页面级验证

重点验证：

- `/` 是否进入新的 workspace 默认入口
- `/workspace` 是否稳定加载
- `/workspace/writing?file=...` 等深链接是否可用
- 旧页面入口是否兼容或正确重定向

### E2E 验证

重点验证完整主链路：

1. 打开总控台
2. 从“当前下一步”进入写作面
3. 从章节队列切换章节
4. 在 API 未就绪时跳转到 AI 设置面
5. 配好远程 Provider 后回到写作面执行 AI 动作
6. 从健康面板直达具体问题位置

## 现有资产复用清单

本设计明确优先复用以下现有资产：

- `components/writing-studio.tsx`
- `components/document-workspace.tsx`
- `components/provider-settings-form.tsx`
- `lib/ai/providers.js`
- `lib/settings/provider-config.js`
- `app/dashboard/page.tsx` 中可复用的 dashboard 聚合思路

本设计明确要求重构或弱化以下现有结构：

- `app/page.tsx` 的旧跳转语义
- `components/app-shell.tsx` 的旧多页容器心智
- 旧的平级页面导航结构

## 参考项目与借鉴点

这次产品方向参考了三类公开项目：

### AI 写作 / 长文工作流

- OpenWrite：借鉴“写作、故事资料、项目管理收进一个创作产品”的方向
- AugmentedQuill：借鉴“围绕章节与项目上下文组织写作界面”的思路
- 302 AI Novel Writing：借鉴“人工编辑与 AI 生成共存”的基础产品形态

### AI Studio / 多 Provider 工作台

- Dify：借鉴“Provider 与工作流状态应该成为产品显性能力”的思路
- Open WebUI：借鉴“模型与 Provider 状态应持续可感知”的思路

### 知识工作区 / 单工作区产品

- AFFiNE、AppFlowy、Docmost、Outline：借鉴“统一工作区壳 + 深入内容面”的信息架构思路

这些参考项目用于借鉴产品形态，不改变本项目的单项目写作定位。

## 结论

本设计把 Webnovel Writer 的下一阶段产品形态明确为：

**一个以写作推进为主轴、以远程 API 为基础能力、以单项目总控台为默认入口的统一工作区。**

这不是把现有页面简单改皮，而是把首页、导航、写作面、大纲面、设定面、审查面、AI 设置面重新组织进同一个产品心智里。

实现上优先复用现有成熟编辑器与远程 Provider 能力，先完成统一壳与总控首页，再逐步收编旧页面。