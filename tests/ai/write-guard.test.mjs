import test from "node:test";
import assert from "node:assert/strict";

import { evaluateChapterWriteGuard } from "../../lib/ai/write-guard.js";

test("evaluateChapterWriteGuard allows direct writing when validation is clean", () => {
  const result = evaluateChapterWriteGuard({
    missingFields: [],
    warnings: [],
  });

  assert.equal(result.requiresConfirmation, false);
  assert.equal(result.buttonLabel, "AI 生成正文");
});

test("evaluateChapterWriteGuard requires confirmation when too many fields are missing", () => {
  const result = evaluateChapterWriteGuard({
    missingFields: ["目标", "阻力", "代价", "爽点"],
    warnings: [],
  });

  assert.equal(result.requiresConfirmation, true);
  assert.match(result.summary, /仍缺 4 项/);
  assert.equal(result.buttonLabel, "再次点击确认生成");
});

test("evaluateChapterWriteGuard requires confirmation on high-severity warnings", () => {
  const result = evaluateChapterWriteGuard({
    missingFields: ["爽点"],
    warnings: [
      {
        code: "hook_without_end_question",
        severity: "high",
        message: "已有章末钩子，但缺少未闭合问题。",
      },
    ],
  });

  assert.equal(result.requiresConfirmation, true);
  assert.match(result.summary, /高风险/);
});
