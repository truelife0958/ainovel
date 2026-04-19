import { buildOutlinePrompt } from "./outline.js";
import { buildChapterPlanPrompt, buildChapterWritePrompt } from "./chapter.js";
import { buildSettingPrompt } from "./setting.js";
import { buildReferenceAnalysisPrompt } from "./reference.js";

export {
  buildOutlinePrompt,
  buildChapterPlanPrompt,
  buildChapterWritePrompt,
  buildSettingPrompt,
  buildReferenceAnalysisPrompt,
};

export function buildPrompt(input) {
  if (input.mode === "outline_plan") return buildOutlinePrompt(input);
  if (input.mode === "chapter_plan") return buildChapterPlanPrompt(input);
  if (input.mode === "chapter_write") return buildChapterWritePrompt(input);
  if (typeof input.mode === "string" && input.mode.startsWith("setting_")) return buildSettingPrompt(input);
  if (input.mode === "reference_analysis") return buildReferenceAnalysisPrompt(input);
  throw new Error("Unsupported AI mode");
}
