import test from "node:test";
import assert from "node:assert/strict";

import { buildReviewFocus } from "../../lib/review/focus.js";

test("buildReviewFocus returns an actionable empty state when no chapter metadata exists", () => {
  const focus = buildReviewFocus({
    latestChapterMeta: null,
    latestChapterRepair: {
      primaryAction: null,
      secondaryActions: [],
      summary: "",
    },
  });

  assert.equal(focus.emptyMessage, "还没有可用的章节元数据。");
  assert.equal(focus.followupMessage, "先去创作页完成任务书和正文，再回审查页看修补建议。");
  assert.equal(focus.recommendationLabel, "暂无");
  assert.equal(focus.summaryText, "无");
  assert.equal(focus.actionHref, null);
  assert.deepEqual(focus.metaItems, []);
  assert.deepEqual(focus.detailItems, []);
});

test("buildReviewFocus keeps only meaningful meta fields and builds the repair jump link", () => {
  const focus = buildReviewFocus({
    latestChapterMeta: {
      chapter: 7,
      hookType: "悬念钩",
      hook: "账本空白页浮出第二个名字",
      strand: "Constellation",
      coolpointPatterns: ["认知反杀", "身份掉马"],
      endQuestion: "第二个名字为何提前出现",
      antagonistTier: "",
      pov: "",
      keyEntities: ["灰雾账本"],
      change: "主角确认父亲与账本存在直接联系",
      updatedAt: "",
    },
    latestChapterRepair: {
      primaryAction: {
        key: "hook",
        label: "补钩子链",
        request: "补齐章末未闭合问题、钩子与兑现预期。",
      },
      secondaryActions: [{ label: "补目标冲突代价", request: "补齐目标、阻力、代价。" }],
      summary: "建议优先处理：补钩子链",
    },
  });

  assert.equal(focus.emptyMessage, "");
  assert.equal(focus.followupMessage, "");
  assert.equal(focus.recommendationLabel, "补钩子链");
  assert.equal(focus.summaryText, "建议优先处理：补钩子链");
  assert.equal(
    focus.actionHref,
    "/?file=%E7%AC%AC0007%E7%AB%A0.md&assistantRequest=%E8%A1%A5%E9%BD%90%E7%AB%A0%E6%9C%AB%E6%9C%AA%E9%97%AD%E5%90%88%E9%97%AE%E9%A2%98%E3%80%81%E9%92%A9%E5%AD%90%E4%B8%8E%E5%85%91%E7%8E%B0%E9%A2%84%E6%9C%9F%E3%80%82",
  );
  assert.deepEqual(focus.metaItems, [
    "章节：第 7 章",
    "Strand：Constellation",
    "钩子类型：悬念钩",
    "爽点模式：认知反杀 / 身份掉马",
  ]);
  assert.deepEqual(focus.detailItems, [
    { label: "章末钩子", value: "账本空白页浮出第二个名字" },
    { label: "未闭合问题", value: "第二个名字为何提前出现" },
    { label: "本章变化", value: "主角确认父亲与账本存在直接联系" },
  ]);
  assert.deepEqual(focus.secondaryLabels, ["补目标冲突代价"]);
});

test("buildReviewFocus falls back to neutral copy when no primary repair action remains", () => {
  const focus = buildReviewFocus({
    latestChapterMeta: {
      chapter: 8,
      hookType: "",
      hook: "",
      strand: "",
      coolpointPatterns: [],
      endQuestion: "",
      antagonistTier: "",
      pov: "",
      keyEntities: [],
      change: "",
      updatedAt: "",
    },
    latestChapterRepair: {
      primaryAction: null,
      secondaryActions: [],
      summary: "",
    },
  });

  assert.equal(focus.recommendationLabel, "暂无");
  assert.equal(focus.summaryText, "无");
  assert.equal(focus.actionHref, null);
  assert.deepEqual(focus.metaItems, ["章节：第 8 章"]);
  assert.deepEqual(focus.detailItems, []);
});
