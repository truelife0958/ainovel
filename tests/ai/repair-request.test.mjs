import test from "node:test";
import assert from "node:assert/strict";

import {
  buildChapterRepairActions,
  buildChapterRepairAdvice,
  buildChapterRepairRecommendation,
  buildChapterRepairRequest,
} from "../../lib/ai/repair-request.js";

test("buildChapterRepairRequest returns null when no repair is needed", () => {
  const result = buildChapterRepairRequest({
    missingFields: [],
    warnings: [],
  });

  assert.equal(result, null);
});

test("buildChapterRepairRequest summarizes missing fields and warnings", () => {
  const result = buildChapterRepairRequest({
    missingFields: ["爽点", "Strand", "章末未闭合问题"],
    warnings: [
      {
        code: "hook_without_end_question",
        severity: "high",
        message: "已有章末钩子，但缺少“章末未闭合问题”。",
      },
    ],
  });

  assert.equal(result?.label, "AI 补全任务书");
  assert.match(result?.request || "", /仅补齐缺失或薄弱字段/);
  assert.match(result?.request || "", /爽点、Strand、章末未闭合问题/);
  assert.match(result?.request || "", /已有章末钩子，但缺少“章末未闭合问题”/);
  assert.match(result?.request || "", /不要重写已经明确填写的字段/);
});

test("buildChapterRepairActions groups repairs by field clusters", () => {
  const result = buildChapterRepairActions({
    missingFields: ["目标", "阻力", "代价", "爽点", "Strand", "关键实体", "本章变化", "章末未闭合问题"],
    warnings: [
      {
        code: "hook_without_end_question",
        severity: "high",
        message: "已有章末钩子，但缺少“章末未闭合问题”。",
      },
    ],
  });

  assert.deepEqual(
    result.map((item) => item.key),
    ["ending", "pacing", "scene", "core"],
  );
  assert.match(result[0]?.request || "", /章末未闭合问题/);
  assert.match(result[1]?.request || "", /爽点、Strand/);
  assert.match(result[2]?.request || "", /关键实体、本章变化/);
  assert.match(result[3]?.request || "", /目标、阻力、代价/);
});

test("buildChapterRepairAdvice recommends the next repair action", () => {
  const result = buildChapterRepairAdvice({
    missingFields: ["爽点", "Strand", "章末未闭合问题"],
    warnings: [
      {
        code: "hook_without_end_question",
        severity: "high",
        message: "已有章末钩子，但缺少“章末未闭合问题”。",
      },
    ],
  });

  assert.match(result || "", /建议下一步先点“补钩子链”/);
});

test("buildChapterRepairRecommendation promotes one primary action", () => {
  const result = buildChapterRepairRecommendation({
    missingFields: ["爽点", "Strand", "章末未闭合问题"],
    warnings: [
      {
        code: "hook_without_end_question",
        severity: "high",
        message: "已有章末钩子，但缺少“章末未闭合问题”。",
      },
    ],
  });

  assert.equal(result.primaryAction?.key, "ending");
  assert.deepEqual(result.secondaryActions.map((item) => item.key), ["pacing"]);
  assert.match(result.summary, /优先处理/);
});
