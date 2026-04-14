import {
  formatChapterBriefForPrompt,
  parseChapterBriefContent,
  validateChapterBrief,
} from "../projects/brief-format.js";
import { readChapterBrief, updateChapterBrief } from "../projects/briefs.js";
import { buildChapterContext } from "../projects/context.js";
import {
  listProjectDocuments,
  readProjectDocument,
  updateProjectDocument,
} from "../projects/documents.js";
import { readProjectSummary } from "../projects/discovery.js";
import { readProjectIdeation } from "../projects/state.js";
import { syncChapterArtifacts } from "../projects/sync.js";
import { BESTSELLER_GUARDRAILS_TEXT } from "./guardrails.js";
import { readProviderConfig } from "../settings/provider-config.js";
import { invokeProviderModel } from "./providers.js";

async function loadGuardrails() {
  return BESTSELLER_GUARDRAILS_TEXT;
}

export function clearGuardrailsCache() {
  return undefined;
}

const MAX_CHAPTER_CONTENT_FOR_APPEND = 30000; // Switch to replace if chapter exceeds this
const MAX_BRIEF_SIZE = 50000; // 50KB limit for brief content

function applyResult(originalContent, generatedText, applyMode) {
  const original = String(originalContent ?? "");
  // Safety: if content is too long, replace instead of appending to prevent prompt bloat
  if (applyMode === "append" && original.length > MAX_CHAPTER_CONTENT_FOR_APPEND) {
    return String(generatedText ?? "").trim();
  }
  return applyMode === "append"
    ? `${original.replace(/\s*$/, "")}\n\n${String(generatedText ?? "").trim()}\n`
    : String(generatedText ?? "").trim();
}

function modeRole(mode) {
  if (mode === "outline_plan" || mode === "chapter_plan") {
    return "outlining";
  }
  if (mode === "chapter_write") {
    return "writing";
  }
  throw new Error("Unsupported AI mode");
}

function modeInstructions(mode) {
  if (mode === "outline_plan") {
    return [
      "You are a commercial webnovel outlining editor.",
      "Strengthen the existing outline so it is easier to execute, more serialized, and more addictive chapter-to-chapter.",
      "Keep the story's core premise and canon intact.",
      "Output Markdown only.",
    ].join(" ");
  }

  if (mode === "chapter_plan") {
    return [
      "You are a chapter-planning assistant for a long-form webnovel.",
      "Produce a complete, execution-ready chapter brief for the drafting stage.",
      "Fill every required field.",
      "Output Markdown only and do not explain your reasoning.",
    ].join(" ");
  }

  if (mode === "chapter_write") {
    return [
      "You are a webnovel chapter writer.",
      "Write or rewrite the chapter directly in polished Markdown prose that matches the established canon.",
      "Do not use placeholders, notes, or process explanations.",
    ].join(" ");
  }

  throw new Error("Unsupported AI mode");
}

function formatSummary(project) {
  return [
    `Title: ${project.title}`,
    `Genre: ${project.genre}`,
    `Current Chapter: ${project.currentChapter || 0}`,
    `Current Volume: ${project.currentVolume || 0}`,
    `Total Words: ${project.totalWords || 0}`,
    `Target Words: ${project.targetWords || 0}`,
    `Target Chapters: ${project.targetChapters || 0}`,
    `Setting Files: ${project.settingFilesCount || 0}`,
    `Outline Files: ${project.outlineFilesCount || 0}`,
    `Chapter Files: ${project.chaptersCount || 0}`,
  ].join("\n");
}

function formatIdeation(ideation) {
  return [
    `Project Title: ${ideation.title || "Not provided"}`,
    `Genre Focus: ${ideation.genre || "Not provided"}`,
    `Target Reader: ${ideation.targetReader || "Not provided"}`,
    `Platform: ${ideation.platform || "Not provided"}`,
    `Core Selling Points: ${ideation.coreSellingPoints || "Not provided"}`,
    `Protagonist Name: ${ideation.protagonistName || "Not provided"}`,
    `Protagonist Structure: ${ideation.protagonistStructure || "Not provided"}`,
    `Golden Finger Name: ${ideation.goldenFingerName || "Not provided"}`,
    `Golden Finger Type: ${ideation.goldenFingerType || "Not provided"}`,
    `Golden Finger Style: ${ideation.goldenFingerStyle || "Not provided"}`,
  ].join("\n");
}

function formatDocument(document) {
  return [`Title: ${document.title}`, `File: ${document.fileName}`, "", document.content].join("\n");
}

function formatContext(chapterContext) {
  return [
    `Chapter Number: ${chapterContext.chapterNumber || 0}`,
    `Outline Excerpt: ${chapterContext.outline || "None"}`,
    chapterContext.previousSummaries.length > 0
      ? ["Previous Summaries:", ...chapterContext.previousSummaries].join("\n\n")
      : "Previous Summaries: None",
    `State Summary: ${chapterContext.stateSummary || "None"}`,
    chapterContext.guidanceItems.length > 0
      ? `Guidance Items: ${chapterContext.guidanceItems.join(" | ")}`
      : "Guidance Items: None",
    chapterContext.error ? `Context Notes: ${chapterContext.error}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildOutlinePrompt({ project, ideation, document, userRequest, guardrails, applyMode }) {
  const task =
    applyMode === "append"
      ? "Add a high-value continuation section that extends the current outline without rewriting earlier sections."
      : "Rewrite the outline so it becomes a stronger execution document while preserving the existing premise and major canon facts.";

  return [
    "# Task",
    task,
    "",
    "Prioritize conflict chains, escalation, payoff scheduling, scene-to-scene momentum, and chapter-end hooks.",
    "Keep the outline commercially sharp and practical for drafting.",
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
    "# Current Outline Document",
    formatDocument(document),
    "",
    "# Output Requirements",
    "- Return Markdown only.",
    "- Preserve the project's own setting, cast, and premise.",
    "- Strengthen volume arcs, chapter beats, reversals, and payoff timing.",
    "- Make sure the next drafting step is more actionable after this output.",
  ].join("\n");
}

function chapterBriefTemplate(chapterNumber, existingTitle) {
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

function buildChapterPlanPrompt({
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

function buildChapterWritePrompt({
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

function buildPrompt(input) {
  if (input.mode === "outline_plan") {
    return buildOutlinePrompt(input);
  }
  if (input.mode === "chapter_plan") {
    return buildChapterPlanPrompt(input);
  }
  if (input.mode === "chapter_write") {
    return buildChapterWritePrompt(input);
  }
  throw new Error("Unsupported AI mode");
}

export async function runDocumentAiAction(input, dependencies = {}) {
  const role = modeRole(input.mode);
  const needsChapterData = input.kind === "chapter";
  const needsChapterContext = input.mode === "chapter_plan" || input.mode === "chapter_write";

  const [config, project, ideation, document, brief, chapterContext, guardrails] = await Promise.all([
    readProviderConfig(input.configRoot),
    readProjectSummary(input.projectRoot),
    readProjectIdeation(input.projectRoot),
    readProjectDocument(input.projectRoot, input.kind, input.fileName),
    needsChapterData ? readChapterBrief(input.projectRoot, input.fileName) : Promise.resolve(null),
    needsChapterContext
      ? (dependencies.buildContext || buildChapterContext)(input.projectRoot, input.fileName)
      : Promise.resolve(null),
    loadGuardrails(),
  ]);

  const provider = config.activeProvider;
  const providerEntry = config.providers[provider];

  if (!providerEntry.apiKey) {
    throw new Error(`Active provider ${provider} is missing an API key`);
  }

  const invocation = {
    provider,
    model: config.roleModels[role] || providerEntry.model,
    role,
    instructions: modeInstructions(input.mode),
    prompt: buildPrompt({
      mode: input.mode,
      applyMode: input.applyMode,
      project,
      ideation,
      document,
      brief,
      chapterContext,
      userRequest: input.userRequest,
      guardrails,
    }),
  };

  const invokeModel =
    dependencies.invokeModel || ((payload) => invokeProviderModel(providerEntry, payload));
  const generatedText = await invokeModel(invocation);
  const target = input.mode === "chapter_plan" ? "brief" : "document";
  const nextContent = applyResult(
    target === "brief" ? brief?.content || "" : document.content,
    generatedText,
    input.applyMode,
  );

  // Enforce brief size limit on AI-generated content
  if (target === "brief" && Buffer.byteLength(nextContent, "utf8") > MAX_BRIEF_SIZE) {
    throw new Error(`AI 生成的任务书过大（${Math.round(Buffer.byteLength(nextContent, "utf8") / 1024)}KB），已超过 ${MAX_BRIEF_SIZE / 1024}KB 限制`);
  }

  const savedDocument =
    target === "brief"
      ? await updateChapterBrief(input.projectRoot, input.fileName, nextContent)
      : await updateProjectDocument(input.projectRoot, input.kind, input.fileName, nextContent);

  let briefValidation = null;
  if (needsChapterData) {
    const currentBrief =
      target === "brief"
        ? savedDocument
        : await readChapterBrief(input.projectRoot, input.fileName);
    briefValidation = validateChapterBrief(parseChapterBriefContent(currentBrief.content));
    const syncArtifacts = dependencies.syncChapterArtifacts || syncChapterArtifacts;

    await syncArtifacts(input.projectRoot, input.fileName, {
      briefContent: currentBrief.content,
      chapterContent: target === "document" ? savedDocument.content : undefined,
    });
  }

  const documents = await listProjectDocuments(input.projectRoot, input.kind);

  return {
    target,
    provider,
    model: invocation.model,
    role,
    generatedText,
    document: savedDocument,
    documents,
    briefValidation,
  };
}
