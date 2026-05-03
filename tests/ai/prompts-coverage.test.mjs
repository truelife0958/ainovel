import test from "node:test";
import assert from "node:assert/strict";

// Tier 6 Pass 2 sub-tier 6.3: smoke-cover lib/ai/prompts/setting.js +
// lib/ai/prompts/reference.js (finding F8: stmt% was 2.29 / 5.88 because no
// unit test imported these modules). The intent is to drive at least the
// default code path through coverage; full prompt-content correctness is
// validated indirectly by E2E reference-analysis + scaffold-generate specs.

const FIXTURE_PROJECT = { title: "T6 cov", genre: "都市异能" };
const FIXTURE_IDEATION = {
  title: "T6 cov",
  genre: "都市异能",
  targetReader: "男频爽文读者",
  goldenFingerName: "灰雾账本",
  goldenFingerType: "规则账本",
  goldenFingerStyle: "冷硬反噬",
  coreSellingPoints: "规则反杀、都市异闻、持续追更钩子",
  protagonistStructure: "落魄调查员",
  protagonistName: "林岚",
};
const FIXTURE_DOCUMENT = { kind: "setting", fileName: "主角卡.md", title: "主角卡", content: "" };
const FIXTURE_GUARDRAILS = { invariants: [], softGuidance: [] };

test("buildSettingPrompt produces non-empty string for each known mode", async () => {
  const { buildSettingPrompt } = await import("../../lib/ai/prompts/setting.js");
  for (const mode of ["setting_worldview", "setting_protagonist", "setting_antagonist", "setting_synopsis", "setting_volume"]) {
    const out = buildSettingPrompt({
      mode,
      project: FIXTURE_PROJECT,
      ideation: FIXTURE_IDEATION,
      document: FIXTURE_DOCUMENT,
      guardrails: FIXTURE_GUARDRAILS,
    });
    assert.equal(typeof out, "string", `${mode} returned a string`);
    assert.ok(out.length > 0, `${mode} returned non-empty`);
  }
});

test("buildSettingPrompt throws for unknown mode", async () => {
  const { buildSettingPrompt } = await import("../../lib/ai/prompts/setting.js");
  assert.throws(
    () =>
      buildSettingPrompt({
        mode: "setting_nonexistent_mode",
        project: { title: "x", genre: "x" },
        ideation: { title: "x", genre: "x" },
        document: { kind: "setting", title: "x", content: "" },
        guardrails: {},
      }),
    /Unsupported setting mode/,
  );
});

test("buildReferenceAnalysisPrompt produces non-empty string", async () => {
  const { buildReferenceAnalysisPrompt } = await import("../../lib/ai/prompts/reference.js");
  const out = buildReferenceAnalysisPrompt({
    project: FIXTURE_PROJECT,
    ideation: FIXTURE_IDEATION,
    userRequest: "凡人修仙传",
    guardrails: FIXTURE_GUARDRAILS,
  });
  assert.equal(typeof out, "string", "result is a string");
  assert.ok(out.length > 0, "result is non-empty");
  // Reference prompt should reference the user-supplied work.
  assert.match(out, /凡人修仙传/, "user-supplied reference work is in the prompt");
});

test("buildReferenceAnalysisPrompt tolerates empty guardrails", async () => {
  const { buildReferenceAnalysisPrompt } = await import("../../lib/ai/prompts/reference.js");
  const out = buildReferenceAnalysisPrompt({
    project: { title: "x", genre: "x" },
    ideation: { title: "x", genre: "x" },
    userRequest: "斗破苍穹",
    guardrails: {},
  });
  assert.equal(typeof out, "string");
  assert.match(out, /斗破苍穹/);
});
