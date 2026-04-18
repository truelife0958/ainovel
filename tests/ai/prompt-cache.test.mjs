import { test } from "node:test";
import assert from "node:assert/strict";
import { splitPromptParts } from "../../lib/ai/prompt-cache.js";

test("splitPromptParts returns stable static prefix + dynamic body", () => {
  const { staticPrefix, dynamicBody } = splitPromptParts({
    guardrails: "GUARD",
    project: { title: "T", genre: "G", currentChapter: 1 },
    ideation: { title: "T", genre: "G" },
    task: "Write chapter",
    currentDocument: { title: "Chap 1", fileName: "c1.md", content: "draft content" },
  });

  assert.ok(staticPrefix.includes("GUARD"));
  assert.ok(staticPrefix.includes("Project Summary"));
  assert.ok(!staticPrefix.includes("draft content"));
  assert.ok(dynamicBody.includes("Write chapter"));
  assert.ok(dynamicBody.includes("draft content"));
});

test("splitPromptParts with identical project+ideation+guardrails yields byte-identical staticPrefix", () => {
  const commonInput = {
    guardrails: "G",
    project: { title: "X", genre: "Y", currentChapter: 1, currentVolume: 1, totalWords: 100, targetWords: 1000, targetChapters: 50, settingFilesCount: 2, outlineFilesCount: 1, chaptersCount: 10 },
    ideation: { title: "X", genre: "Y", targetReader: "Z" },
    task: "A",
    currentDocument: { title: "D", fileName: "d.md", content: "content-a" },
  };
  const a = splitPromptParts(commonInput);
  const b = splitPromptParts({ ...commonInput, task: "B", currentDocument: { title: "D2", fileName: "d2.md", content: "content-b" } });
  assert.equal(a.staticPrefix, b.staticPrefix, "static prefix must not change when only dynamic parts differ");
  assert.notEqual(a.dynamicBody, b.dynamicBody);
});

test("splitPromptParts handles missing project/ideation without throwing", () => {
  const r = splitPromptParts({
    guardrails: "G",
    project: {},
    ideation: {},
    task: "T",
    currentDocument: { title: "d", fileName: "d.md", content: "" },
  });
  assert.ok(r.staticPrefix.includes("Project Summary"));
  assert.ok(r.dynamicBody.includes("Task"));
});
