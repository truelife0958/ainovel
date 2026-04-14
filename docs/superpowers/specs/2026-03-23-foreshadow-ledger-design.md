# 伏笔台账系统设计

## 背景

当前项目已经具备以下与伏笔相关的能力：

- `state.json.plot_threads.foreshadowing` 的轻量运行态结构
- `status_reporter.py` 的伏笔紧急度与超期分析
- `webnovel-plan` 的章纲级“章末未闭合问题/钩子/伏笔”规划
- `webnovel-write` 的 `chapter_meta`、`chapter_reading_power`、`review_metrics`

但现状仍存在明显缺口：

- 伏笔没有稳定的权威主存对象模型
- 规划伏笔与实际埋设/强化/回收之间没有统一生命周期
- `state.json` 中的 `plot_threads.foreshadowing` 结构偏松散，不适合作为长期台账
- 写作后对“这个伏笔当前走到哪一步了”没有标准状态机

因此需要一个第一版“伏笔台账系统”，先解决结构化登记与生命周期追踪问题。

## 目标

- 以 SQLite 作为伏笔台账的唯一权威存储。
- 支持 `plan + write` 双入口：
  - `webnovel-plan` 先建卡
  - `webnovel-write` 再修正状态
- 建立轻量状态机，覆盖规划、埋设、强化、回收、废弃五种状态。
- 让 `status_reporter` 基于台账做统一分析。
- 与现有 `state.json.plot_threads.foreshadowing` 保持兼容，但不再把它当作权威源。

## 非目标

- 不做自动识别伏笔。
- 不做红鲱鱼、误导伏笔、多阶段兑现等复杂事件流模型。
- 不在第一版中引入额外 UI。
- 不把 `state.json` 扩成大体量主存。

## 核心方案

### 1. 权威存储位置

SQLite `index.db` 作为伏笔台账唯一权威存储。

原因：
- 项目已有“`state.json` 精简、大数据入 SQLite”的明确方向。
- 伏笔台账本质上属于中长期运营数据，不适合继续堆在 JSON 中。
- 后续做紧急度、兑现率、缺失率、按卷统计时，SQLite 更容易查询和扩展。

`state.json.plot_threads.foreshadowing` 在第一版中的定位：
- 不再作为权威源
- 可保留为兼容摘要层
- `status_reporter` 在 SQLite 数据缺失时允许回退读取它

### 2. 数据模型

新增伏笔主表，建议命名为 `foreshadowing_ledger`。

建议字段：

- `foreshadow_id`
- `title`
- `content`
- `tier`
- `source_type`
- `planned_chapter`
- `planted_chapter`
- `target_payoff_start`
- `target_payoff_end`
- `paid_off_chapter`
- `status`
- `origin_volume`
- `related_entities`
- `payoff_note`
- `last_updated`

字段定义：

- `foreshadow_id`
  - 唯一标识
  - 用于跨规划、写作、状态报告和后续查询统一引用

- `title`
  - 伏笔短标题
  - 便于列表展示和人工检索

- `content`
  - 伏笔的完整描述
  - 说明它埋的是什么、未来准备怎么收

- `tier`
  - 建议沿用现有层级语义：
    - `核心`
    - `支线`
    - `装饰`

- `source_type`
  - `plan` 或 `write`
  - 用于区分“规划先建卡”和“写作中补录”

- `planned_chapter`
  - 规划预计首次埋设章节

- `planted_chapter`
  - 实际首次落地章节

- `target_payoff_start`
  - 预计回收窗口起始章节

- `target_payoff_end`
  - 预计回收窗口结束章节

- `paid_off_chapter`
  - 实际回收章节

- `status`
  - 状态机字段，见下节

- `origin_volume`
  - 所属卷号，便于卷级统计

- `related_entities`
  - JSON 数组
  - 记录关联角色/地点/势力/物品等实体 ID

- `payoff_note`
  - 简述兑现方式或废弃原因

- `last_updated`
  - 最后更新时间

## 状态机

第一版只使用轻量状态机：

- `planned`
- `planted`
- `reinforced`
- `paid_off`
- `dropped`

### 状态定义

- `planned`
  - 已在规划阶段登记，但正文中尚未正式落地

- `planted`
  - 已在正文中首次明确埋设

- `reinforced`
  - 已在后续章节被再次提及、加深或推进

- `paid_off`
  - 已明确兑现、揭晓或完成回收

- `dropped`
  - 主动废弃，不再继续使用

### 合法流转

- `planned -> planted`
- `planted -> reinforced`
- `planted -> paid_off`
- `reinforced -> paid_off`
- `planned -> dropped`
- `planted -> dropped`
- `reinforced -> dropped`

### 非法或不建议流转

- `paid_off -> any`
- `dropped -> any`
- `planned -> paid_off` 仅在极特殊情况下允许，但第一版建议视为异常路径并要求备注

## 组件职责

### `webnovel-plan`

职责：
- 在卷纲/章纲阶段创建伏笔卡
- 作为第一入口建立“计划中的伏笔”

至少写入：
- `title`
- `content`
- `tier`
- `planned_chapter`
- `target_payoff_start`
- `target_payoff_end`
- `origin_volume`
- `related_entities`
- `status=planned`
- `source_type=plan`

同时要求章纲增加伏笔标记维度：
- 本章新增伏笔
- 本章推进伏笔
- 本章回收伏笔

`webnovel-plan` 不负责：
- 判断正文是否真的落地
- 自动把 `planned` 改成 `planted`

### `webnovel-write`

职责：
- 在实际写完章节后修正伏笔状态

允许动作：
- `planned -> planted`
- `planted -> reinforced`
- `planted/reinforced -> paid_off`
- 任意非终态 -> `dropped`

计划外新增伏笔：
- 允许在写作阶段补建卡
- 但必须标记 `source_type=write`

第一版中，`webnovel-write` 不负责：
- 自动识别伏笔
- 自动判断该伏笔属于哪条长线，只允许显式更新

### `status_reporter`

职责：
- 从 SQLite 主表读取伏笔台账
- 统一输出分组分析

建议输出组：
- 待埋设伏笔
- 已埋设未回收伏笔
- 超期伏笔
- 已回收伏笔
- 已废弃伏笔

紧急度建议基于：
- `tier`
- 当前章节与 `target_payoff_end` 的距离
- 是否已经超期
- 是否长期未被强化

### `state.json`

职责：
- 只保留兼容摘要，不保留权威明细

第一版建议：
- 不强制删除现有 `plot_threads.foreshadowing`
- 但新逻辑默认优先 SQLite
- 旧结构逐步弱化为 fallback

## 数据流

### 规划阶段

`webnovel-plan`
-> 创建伏笔卡
-> 写入 SQLite 主表
-> 状态为 `planned`

### 写作阶段

`webnovel-write`
-> 根据本章真实落地情况修正卡片
-> 更新状态为 `planted / reinforced / paid_off / dropped`

### 报告阶段

`status_reporter`
-> 读取 SQLite 主表
-> 输出伏笔状态分组、超期项、紧急度排序

## 与现有系统的集成点

### 现有可复用能力

- `state_validator` 已有伏笔状态和层级标准化逻辑，可参考命名与兼容策略
- `status_reporter` 已有伏笔紧急度分析思路，可改为优先读取 SQLite
- `index_manager` 已是大数据主入口，新增表最自然
- `context-agent`、`continuity-checker`、`reader-pull-checker` 已经消费伏笔语义，可后续切换到台账数据

### 现有需要调整的地方

- `plot_threads.foreshadowing` 不应继续被视为主数据源
- `webnovel-plan` 需要明确“伏笔卡建卡输出”
- `webnovel-write` 需要明确“伏笔状态更新输出”
- `status_reporter` 需要增加“优先读 SQLite，缺失再回退 state.json”的逻辑

## 错误处理

- 若 `webnovel-plan` 建卡缺少 `planned_chapter` 或回收窗口：
  - 允许阻断或标为不完整，不允许写入半结构化垃圾数据

- 若 `webnovel-write` 试图更新不存在的 `foreshadow_id`：
  - 报错或要求显式新建，并标 `source_type=write`

- 若 `paid_off` 或 `dropped` 状态再次被更新：
  - 默认拒绝
  - 除非未来版本引入事件流模型

- 若 SQLite 主表不可用：
  - `status_reporter` 允许回退 `state.json`
  - 但应标记“台账主存缺失，当前报告为兼容模式”

## 分阶段实施顺序

### Phase 1

- 在 `index_manager` 增加伏笔主表
- 增加基础 CRUD
- 增加按状态和章节窗口查询

### Phase 2

- 修改 `webnovel-plan` 文档与落库流程
- 支持规划阶段建卡

### Phase 3

- 修改 `webnovel-write` 文档与状态修正流程
- 支持写作阶段状态更新

### Phase 4

- 修改 `status_reporter`
- 改为优先读取 SQLite 台账并输出五类分组

### Phase 5

- 增加兼容迁移策略
- 从旧 `plot_threads.foreshadowing` 平滑过渡

## 验收标准

- SQLite 中存在伏笔主表，且字段满足第一版设计。
- `webnovel-plan` 能写入 `planned` 状态伏笔卡。
- `webnovel-write` 能把伏笔卡从 `planned` 更新为 `planted/reinforced/paid_off/dropped`。
- `status_reporter` 能输出五类伏笔分组。
- `status_reporter` 对 SQLite 缺失时有兼容回退逻辑。
- 旧 `state.json.plot_threads.foreshadowing` 不再被当作权威源。

## 测试建议

### 单元测试

- 主表建表与字段校验
- 状态机合法流转
- 非法流转拒绝
- 按章节窗口查询
- 紧急度排序

### 集成测试

1. `webnovel-plan` 新建 3 条伏笔卡
2. `webnovel-write` 对其中 2 条做状态更新
3. `status_reporter` 输出五类分组和超期排序
4. 验证 SQLite 为主、`state.json` 仅作为 fallback

## 风险与缓解

- 风险：`plan` 建卡但正文没有照计划落地
  - 缓解：通过 `planned -> planted` 的显式修正区分“计划”和“已落地”

- 风险：写作中新增计划外伏笔导致数据混乱
  - 缓解：允许建卡，但必须标记 `source_type=write`

- 风险：旧 `state.json` 逻辑和新 SQLite 主存并存期间产生双源冲突
  - 缓解：明确 SQLite 为唯一权威，`state.json` 只做兼容回退

