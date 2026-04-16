# Changelog

## 2026-04-16

### Added
- 暗色模式：CSS 变量主题系统 + 工具栏切换 + 系统偏好跟随 + 防闪烁
- Markdown 编辑器工具栏：粗体/斜体/标题/列表/引用/分割线
- AI 批量章节生成：顺序创建→规划→写作，支持暂停/停止，实时进度
- 一键生成项目骨架：世界观/主角卡/反派设计/总纲/卷大纲 5 项可选
- 参考作品分析：输入小说名称，AI 提炼 7 维度结构机制
- 专注模式（Zen Mode）：隐藏工具栏沉浸写作
- 自动保存（30秒）+ Ctrl+B 任务书快捷键
- 字数进度条（每章目标字数自动计算）

### Security
- 统一文件锁模块，消除 state.json 竞态条件
- 原子写入防文件损坏
- 速率限制不再信任 X-Forwarded-For
- SSRF 防护补全 IPv6 私网 + 0.0.0.0
- Gemini 模型名 URL 编码防路径注入
- Python 脚本 30s 超时
- API 路由输入净化全覆盖
- Provider 配置 100KB 负载限制

### Improved
- 单页面模态框架构（所有旧路由合并到 /）
- 模态框 AbortController + 错误重试 + 加载 spinner
- 错误/成功消息分色显示
- Body overflow 引用计数
- 下拉菜单向上弹出 + 空状态引导
- 移动端底部栏自适应
- ARIA 无障碍补全

### Removed
- 10 个旧路由页面
- 废弃组件和 lib 模块
- 34 个截图 PNG + 过期文档 + 临时测试目录

## 2026-03-24

### Added
- 基于 Next.js 的网页创作台（初始版本）
- 项目发现、创建和切换
- OpenAI / Anthropic / OpenRouter 配置持久化
- Playwright 浏览器烟测与可选 live-AI 回归
