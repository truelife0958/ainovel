import test from "node:test";
import assert from "node:assert/strict";

import { parseChapterBriefContent, validateChapterBrief } from "../../lib/projects/brief-format.js";

test("parseChapterBriefContent parses structured chapter-plan fields", () => {
  const parsed = parseChapterBriefContent(`### 第 12 章：第二个血字
- 目标: 锁定血字背后的指向
- 阻力: 钟表店规则每十秒变化
- 代价: 陈默必须暴露灰雾感知
- 爽点: 认知反杀 - 当众拆穿规则漏洞 / 身份掉马
- Strand: Constellation
- 反派层级: 小
- 视角/主角: 陈默
- 关键实体: 灰雾账本、逆行钟、钟表店老板
- 本章变化: 陈默确认父亲与账本存在直接联系
- 章末未闭合问题: 第二个血字姓名为何会提前出现
- 钩子: 悬念钩 - 空白页浮出陌生人的出生年月`);

  assert.equal(parsed.title, "第二个血字");
  assert.equal(parsed.goal, "锁定血字背后的指向");
  assert.equal(parsed.obstacle, "钟表店规则每十秒变化");
  assert.equal(parsed.cost, "陈默必须暴露灰雾感知");
  assert.equal(parsed.strand, "Constellation");
  assert.equal(parsed.antagonistTier, "小");
  assert.equal(parsed.pov, "陈默");
  assert.deepEqual(parsed.keyEntities, ["灰雾账本", "逆行钟", "钟表店老板"]);
  assert.equal(parsed.change, "陈默确认父亲与账本存在直接联系");
  assert.equal(parsed.endQuestion, "第二个血字姓名为何会提前出现");
  assert.equal(parsed.hookType, "悬念钩");
  assert.equal(parsed.hook, "空白页浮出陌生人的出生年月");
  assert.deepEqual(parsed.coolpointPatterns, ["认知反杀", "身份掉马"]);
});

test("parseChapterBriefContent keeps legacy brief fields compatible", () => {
  const parsed = parseChapterBriefContent(`## 第0005章章节任务书

- 本章目标：查清钟表店异常
- 主要冲突：账本主动暴走
- 承接上章：追查异响来源
- 关键阻力：规则不断变化
- 代价：暴露自身异常感知
- 章末钩子：账本自动翻页，显出父亲名字`);

  assert.equal(parsed.goal, "查清钟表店异常");
  assert.equal(parsed.conflict, "账本主动暴走");
  assert.equal(parsed.carry, "追查异响来源");
  assert.equal(parsed.obstacle, "规则不断变化");
  assert.equal(parsed.cost, "暴露自身异常感知");
  assert.equal(parsed.hookType, "");
  assert.equal(parsed.hook, "账本自动翻页，显出父亲名字");
});

test("validateChapterBrief reports missing required fields and hook risks", () => {
  const parsed = parseChapterBriefContent(`### 第 12 章：第二个血字
- 目标: 锁定血字背后的指向
- 阻力: 钟表店规则每十秒变化
- 代价: 陈默必须暴露灰雾感知
- 钩子: 空白页浮出陌生人的出生年月`);

  const validation = validateChapterBrief(parsed);

  assert.deepEqual(validation.missingFields, [
    "爽点",
    "Strand",
    "反派层级",
    "视角/主角",
    "关键实体",
    "本章变化",
    "章末未闭合问题",
  ]);
  assert.equal(validation.warnings[0]?.code, "missing_hook_type");
  assert.equal(validation.warnings[1]?.code, "hook_without_end_question");
});
