import {
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
import { buildPrompt } from "./prompts/index.js";

async function loadGuardrails() {
  return BESTSELLER_GUARDRAILS_TEXT;
}

const MAX_CHAPTER_CONTENT_FOR_APPEND = 30000; // Switch to replace if chapter exceeds this
const MAX_BRIEF_SIZE = 50000; // 50KB limit for brief content

/**
 * Apply AI-generated text to existing content. Returns `{ content, downgraded }`.
 * `downgraded` is true when `applyMode === "append"` but the original content
 * exceeded the append threshold, so the result is a full replace instead.
 *
 * @param {string | null | undefined} originalContent
 * @param {string | null | undefined} generatedText
 * @param {"append" | "replace"} applyMode
 * @returns {{ content: string, downgraded: boolean }}
 */
export function applyResult(originalContent, generatedText, applyMode) {
  const original = String(originalContent ?? "");
  const generated = String(generatedText ?? "").trim();
  if (applyMode === "append" && original.length > MAX_CHAPTER_CONTENT_FOR_APPEND) {
    return { content: generated, downgraded: true };
  }
  const content = applyMode === "append"
    ? `${original.replace(/\s*$/, "")}\n\n${generated}\n`
    : generated;
  return { content, downgraded: false };
}

function modeRole(mode) {
  if (mode === "outline_plan" || mode === "chapter_plan") {
    return "outlining";
  }
  if (mode === "chapter_write") {
    return "writing";
  }
  if (mode.startsWith("setting_") || mode === "reference_analysis") {
    return "outlining";
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

  if (mode === "setting_worldview") {
    return "你是网文世界观设计专家。根据提供的项目信息，生成完整的世界观设定文档。使用中文，输出 Markdown 格式。";
  }

  if (mode === "setting_protagonist") {
    return "你是网文角色设计专家。根据提供的项目信息，生成详细的主角卡设定文档。使用中文，输出 Markdown 格式。";
  }

  if (mode === "setting_antagonist") {
    return "你是网文反派设计专家。根据提供的项目信息，设计与主角形成镜像对抗的反派体系。使用中文，输出 Markdown 格式。";
  }

  if (mode === "setting_synopsis") {
    return "你是网文大纲架构师。根据提供的项目信息，生成完整的故事总纲。使用中文，输出 Markdown 格式。";
  }

  if (mode === "setting_volume") {
    return "你是网文分卷大纲师。根据提供的项目信息和总纲方向，生成第一卷的详细章节大纲。使用中文，输出 Markdown 格式。";
  }

  if (mode === "reference_analysis") {
    return "你是网文结构分析专家。分析指定作品的结构机制，只提炼可复用的抽象机制，不复用任何具体内容。使用中文，输出 Markdown 格式。";
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
    signal: input.signal,
  };

  const invokeModel =
    dependencies.invokeModel || ((payload) => invokeProviderModel(providerEntry, payload));
  const rawResult = await invokeModel(invocation);
  // Providers (Tier 2) return { text, usage, latencyMs }; older dependencies.invokeModel
  // stubs may still return a plain string. Normalize here.
  const normalized = typeof rawResult === "string"
    ? { text: rawResult, usage: null, latencyMs: 0 }
    : rawResult;
  const generatedText = normalized.text;
  const lastCall = { latencyMs: normalized.latencyMs ?? 0, usage: normalized.usage ?? null };
  const target = input.mode === "chapter_plan" ? "brief" : "document";
  const applied = applyResult(
    target === "brief" ? brief?.content || "" : document.content,
    generatedText,
    input.applyMode,
  );
  const nextContent = applied.content;
  const downgraded = applied.downgraded;

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
    downgraded,
    applyModeUsed: downgraded ? "replace" : input.applyMode,
    lastCall,
  };
}
