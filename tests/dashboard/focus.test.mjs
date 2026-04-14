import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardFocus } from "../../lib/dashboard/focus.js";

test("buildDashboardFocus returns onboarding guidance when no project is selected", () => {
  const focus = buildDashboardFocus(null);

  assert.deepEqual(focus.snapshot, [
    { label: "项目标题", value: "未检测到" },
    { label: "创作阶段", value: "待创建项目" },
    { label: "进度", value: "0 / 0 章 · 0 / 0 字" },
  ]);
  assert.deepEqual(focus.nextSteps, [
    "先创建项目并设为当前项目。",
    "到立项页补题材方向、目标读者和核心卖点。",
    "至少建立 1 份设定或卷纲，再进入写作链路。",
  ]);
  assert.deepEqual(focus.gaps, [
    "还没有当前项目，首页指标和工作流入口都无法联动。",
    "缺少设定与大纲时，后续规划无法形成稳定约束。",
    "没有章节素材时，审查和写作链路都不会产生有效反馈。",
  ]);
});

test("buildDashboardFocus prioritizes setup work for a fresh project", () => {
  const focus = buildDashboardFocus({
    id: "demo",
    root: "/tmp/demo",
    title: "雾站账本",
    genre: "都市异能",
    currentChapter: 1,
    currentVolume: 1,
    totalWords: 0,
    targetWords: 1000000,
    targetChapters: 300,
    settingFilesCount: 0,
    outlineFilesCount: 0,
    chaptersCount: 0,
  });

  assert.deepEqual(focus.snapshot, [
    { label: "项目标题", value: "雾站账本" },
    { label: "创作阶段", value: "新项目起步" },
    { label: "进度", value: "0 / 300 章 · 0 / 1000000 字" },
  ]);
  assert.deepEqual(focus.nextSteps, [
    "先补 1 份主角卡、世界观或力量体系设定。",
    "补 1 份总纲或卷纲，先锁主线推进。",
    "去创作页创建首章任务书，启动正文链路。",
  ]);
  assert.deepEqual(focus.gaps, [
    "设定集为空，人物、规则和阵营约束还没立住。",
    "大纲文件为空，主线节拍和卷级承诺还不清楚。",
    "正文还没开章，当前项目缺少可审查的推进样本。",
  ]);
});

test("buildDashboardFocus shifts to writing guidance once the project is underway", () => {
  const focus = buildDashboardFocus({
    id: "demo",
    root: "/tmp/demo",
    title: "雾站账本",
    genre: "都市异能",
    currentChapter: 12,
    currentVolume: 2,
    totalWords: 180000,
    targetWords: 1000000,
    targetChapters: 300,
    settingFilesCount: 4,
    outlineFilesCount: 3,
    chaptersCount: 12,
  });

  assert.deepEqual(focus.snapshot, [
    { label: "项目标题", value: "雾站账本" },
    { label: "创作阶段", value: "持续写作" },
    { label: "进度", value: "12 / 300 章 · 180000 / 1000000 字" },
  ]);
  assert.deepEqual(focus.nextSteps, [
    "继续推进第 12 章，先补任务书再扩正文。",
    "写完后去审查页看最新修补建议和风险提示。",
    "按当前节奏继续补卷纲与关键设定，避免后段失速。",
  ]);
  assert.deepEqual(focus.gaps, [
    "距离目标章节还差 288 章，需要持续稳定推进。",
    "距离目标字数还差 820000 字，后续要守住更新节奏。",
    "当前已进入持续写作阶段，优先保持任务书、正文和审查闭环。",
  ]);
});
