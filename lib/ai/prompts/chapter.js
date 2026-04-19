import { parseChapterBriefContent, formatChapterBriefForPrompt } from "../../projects/brief-format.js";
import { formatSummary, formatIdeation, formatDocument, formatContext } from "./_shared.js";

export function chapterBriefTemplate(chapterNumber, existingTitle) {
  const headingTitle = existingTitle || "待定";
  return [
    `### 第 ${chapterNumber} 章：${headingTitle}`,
    "- 目标:",
    "- 主要冲突:",
    "- 承接上章:",
    "- 阻力:",
    "- 代价:",
    "- 爽点: 类型 - 交付方式",
    "- Strand:",
    "- 反派层级:",
    "- 视角/主角:",
    "- 关键实体:",
    "- 本章变化:",
    "- 章末未闭合问题:",
    "- 钩子: 类型 - 读者侧钩子",
  ].join("\n");
}

export function buildChapterPlanPrompt({
  project,
  ideation,
  document,
  brief,
  chapterContext,
  userRequest,
  guardrails,
}) {
  const parsedBrief = parseChapterBriefContent(brief?.content || "");
  const chapterNumber = brief?.chapterNumber || chapterContext?.chapterNumber || 0;
  const title = parsedBrief.title || brief?.title || document.title;

  return [
    "# Task",
    "Create a complete chapter brief that the drafting model can execute immediately.",
    "Every field below must be filled with concrete, story-specific content.",
    userRequest ? `User Request: ${userRequest}` : "User Request: None",
    "",
    "# Project Summary",
    formatSummary(project),
    "",
    "# Ideation",
    formatIdeation(ideation),
    "",
    "# Originality Guardrails",
    guardrails,
    "",
    "# Current Chapter Draft",
    formatDocument(document),
    "",
    "# Existing Chapter Brief",
    formatChapterBriefForPrompt(parsedBrief),
    "",
    "# Chapter Context",
    formatContext(chapterContext),
    "",
    "# Required Output Format",
    chapterBriefTemplate(chapterNumber, title),
    "",
    "# Requirements",
    "- 目标、阻力、代价、爽点、Strand、反派层级、视角/主角、关键实体、本章变化、章末未闭合问题和钩子必须全部明确填写。",
    "- 钩子和章末未闭合问题必须指向同一个未解决的读者牵引点。",
    "- 承接上章应连接本章与上一章的即时状态。",
    "- 爽点使用「类型 - 交付方式」格式。",
    "- 钩子使用「类型 - 读者侧钩子」格式。",
    "- 与大纲节选、近期摘要和当前章节草稿保持一致。",
    "- 仅输出 Markdown 格式的任务书，不要在前后添加解释。",
  ].join("\n");
}

export function buildChapterWritePrompt({
  project,
  ideation,
  document,
  brief,
  chapterContext,
  userRequest,
  guardrails,
  applyMode,
}) {
  const parsedBrief = parseChapterBriefContent(brief?.content || "");
  const draftingDirective =
    applyMode === "append"
      ? "Continue from the existing chapter draft without repeating already-written beats."
      : "Rewrite the current chapter draft into a cleaner, stronger full chapter while preserving canon facts that should remain true.";

  return [
    "# Task",
    draftingDirective,
    "Write the actual chapter prose, not a plan.",
    userRequest ? `User Request: ${userRequest}` : "User Request: None",
    "",
    "# Project Summary",
    formatSummary(project),
    "",
    "# Ideation",
    formatIdeation(ideation),
    "",
    "# Originality Guardrails",
    guardrails,
    "",
    "# Current Chapter Draft",
    formatDocument(document),
    "",
    "# Chapter Brief",
    formatChapterBriefForPrompt(parsedBrief),
    "",
    "# Chapter Context",
    formatContext(chapterContext),
    "",
    "# Writing Requirements",
    "- Preserve continuity with the current draft, outline excerpt, and recent summaries.",
    "- Deliver clear scene progression, pressure escalation, and at least one satisfying payoff.",
    "- Use the chapter brief as the execution target when it contains useful direction.",
    "- End on the strongest available hook or unresolved end question.",
    "- Output Markdown prose only. No notes, no bullet lists, no commentary.",
  ].join("\n");
}
