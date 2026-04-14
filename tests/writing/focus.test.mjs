import test from "node:test";
import assert from "node:assert/strict";

import { buildWritingAssistantFocus, buildWritingContextFocus } from "../../lib/writing/focus.js";

test("buildWritingAssistantFocus keeps non-empty notes in priority order", () => {
  const focus = buildWritingAssistantFocus({
    recommendationSummary: "建议优先处理：补钩子链",
    assistantMessage: "AI 已就绪：OpenAI / gpt-5-mini",
    statusMessage: "已保存第 2 章任务书",
    projectTitle: "雾站账本",
    documentCount: 4,
  });

  assert.deepEqual(focus.notes, [
    "建议优先处理：补钩子链",
    "AI 已就绪：OpenAI / gpt-5-mini",
    "已保存第 2 章任务书",
  ]);
  assert.equal(focus.fallback, "");
});

test("buildWritingAssistantFocus falls back to compact project status when no notes exist", () => {
  const focus = buildWritingAssistantFocus({
    recommendationSummary: "",
    assistantMessage: "",
    statusMessage: "",
    projectTitle: "雾站账本",
    documentCount: 0,
  });

  assert.deepEqual(focus.notes, []);
  assert.equal(focus.fallback, "当前项目：雾站账本，章节数：0");
});

test("buildWritingContextFocus normalizes empty context fields into concise defaults", () => {
  const focus = buildWritingContextFocus({
    chapterNumber: 0,
    outline: "",
    previousSummaries: [],
    stateSummary: "",
    guidanceItems: [],
    error: "",
  });

  assert.equal(focus.outlineText, "暂无大纲片段");
  assert.equal(focus.previousSummaryText, "暂无上章摘要");
  assert.equal(focus.stateSummaryText, "暂无状态摘要");
  assert.deepEqual(focus.guidanceItems, ["暂无执行建议"]);
});

test("buildWritingContextFocus preserves meaningful context and trims guidance items", () => {
  const focus = buildWritingContextFocus({
    chapterNumber: 9,
    outline: "主角潜入钟表店，试探账本真相。",
    previousSummaries: ["第 7 章摘要", "", "第 8 章摘要"],
    stateSummary: "父亲失踪线推进到新阶段。",
    guidanceItems: ["补目标与阻力衔接。", "强化章末追更钩子。", ""],
    error: "",
  });

  assert.equal(focus.outlineText, "主角潜入钟表店，试探账本真相。");
  assert.equal(focus.previousSummaryText, "第 7 章摘要\n\n第 8 章摘要");
  assert.equal(focus.stateSummaryText, "父亲失踪线推进到新阶段。");
  assert.deepEqual(focus.guidanceItems, ["补目标与阻力衔接。", "强化章末追更钩子。"]);
});
