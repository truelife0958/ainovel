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
  if (input.mode.startsWith("setting_")) {
    return buildSettingPrompt(input);
  }
  if (input.mode === "reference_analysis") {
    return buildReferenceAnalysisPrompt(input);
  }
  throw new Error("Unsupported AI mode");
}

function buildSettingPrompt({ mode, project, ideation, document, guardrails }) {
  const base = [
    "# 项目信息",
    formatSummary(project),
    "",
    "# 立项详情",
    formatIdeation(ideation),
    "",
    "# 原创性护栏",
    guardrails,
    "",
    "# 当前文档",
    formatDocument(document),
    "",
  ];

  if (mode === "setting_worldview") {
    return [
      ...base,
      "# 任务",
      "根据以上项目信息，生成完整的世界观设定文档，包含：",
      "1. 世界基础规则（物理法则、超自然体系、核心限制）",
      "2. 力量体系（等级划分、升级路径、代价与限制）",
      "3. 社会结构（势力分布、权力体系、普通人与能力者的关系）",
      "4. 关键地点（3-5个核心场景，含氛围描写）",
      "5. 历史背景（影响当前故事的关键历史事件）",
      "6. 金手指在世界观中的定位和限制",
      "",
      "要求：",
      "- 所有设定必须服务于故事核心卖点",
      "- 力量体系要有清晰的天花板和代价",
      "- 世界规则要能自然产生冲突和戏剧性",
      "- 仅输出 Markdown，不要解释推理过程",
    ].join("\n");
  }

  if (mode === "setting_protagonist") {
    return [
      ...base,
      "# 任务",
      "根据以上项目信息，生成详细的主角设定卡，包含：",
      "1. 基础信息（姓名、年龄、外貌特征、职业/身份）",
      "2. 性格核心（3个核心性格特征 + 致命缺陷）",
      "3. 背景故事（出身、关键经历、当前处境）",
      "4. 能力设定（金手指详细机制、使用限制、升级路线）",
      "5. 人物弧光（起点状态 → 中期转变 → 终点状态）",
      "6. 核心动机（外在目标 + 内在需求）",
      "7. 关键人际关系（2-3个重要关系）",
      "8. 说话风格和习惯动作",
      "",
      "要求：",
      "- 缺陷必须是真实的、会带来后果的",
      "- 金手指要有明确的使用代价",
      "- 角色弧光要与核心卖点呼应",
      "- 仅输出 Markdown，不要解释推理过程",
    ].join("\n");
  }

  if (mode === "setting_antagonist") {
    return [
      ...base,
      "# 任务",
      "根据以上项目信息，设计反派体系（镜像对抗设计），包含：",
      "1. 主要反派（与主角共享欲望但采取相反道路）",
      "   - 基础信息、性格、能力、动机",
      "   - 与主角的镜像关系说明",
      "2. 反派层级体系（至少3层）",
      "   - 第一层：近期对手（前30章的主要冲突源）",
      "   - 第二层：中期反派（卷级 Boss）",
      "   - 第三层：终极反派（全书大Boss）",
      "3. 每个反派的威胁递增逻辑",
      "4. 反派与主角的冲突节点规划",
      "",
      "要求：",
      "- 反派必须有合理的动机，不是单纯的恶",
      "- 层级之间要有关联，不是孤立的",
      "- 每个反派都要能给主角带来成长",
      "- 仅输出 Markdown，不要解释推理过程",
    ].join("\n");
  }

  if (mode === "setting_synopsis") {
    return [
      ...base,
      "# 任务",
      "根据以上项目信息，生成完整的故事总纲，包含：",
      "1. 一句话概要（30字以内）",
      "2. 核心冲突（主角 vs 什么？为了什么？代价是什么？）",
      "3. 三幕结构",
      "   - 第一幕：开局（世界引入、金手指获得、初始冲突）",
      "   - 第二幕：发展（能力成长、势力碰撞、核心关系建立）",
      "   - 第三幕：高潮与结局（终极对抗、主题升华）",
      "4. 分卷规划（每卷的核心目标和标志性事件，按目标章节数合理分配）",
      "5. 关键转折点（5-8个改变故事走向的大事件）",
      "6. 伏笔规划（3-5条贯穿全文的长线伏笔）",
      "7. 爽点节奏规划（每10章至少一个大爽点的分布）",
      "",
      "要求：",
      "- 总纲要服务于连载节奏，前30章必须紧凑",
      "- 每卷要有明确的完结感，同时留下跨卷钩子",
      "- 伏笔要有明确的埋设章节和回收章节",
      "- 仅输出 Markdown，不要解释推理过程",
    ].join("\n");
  }

  if (mode === "setting_volume") {
    return [
      ...base,
      "# 任务",
      "根据以上项目信息，生成第一卷的详细章节大纲，包含：",
      "1. 卷标题和卷核心目标",
      "2. 每章概要（包含：章节号、章节标题、主要事件、冲突点、章末钩子）",
      "3. 第一卷应包含约30-40章的内容",
      "4. 确保前5章节奏极快（黄金五章原则）",
      "5. 标注每章的情绪曲线（紧张/舒缓/爽/虐/温馨）",
      "6. 标注关键伏笔的埋设位置",
      "7. 标注爽点的分布位置",
      "",
      "要求：",
      "- 第1章必须有强烈的吸引力和悬念",
      "- 每3-5章要有一个小高潮",
      "- 卷末要有最大的爽点 + 跨卷钩子",
      "- 每章概要200-300字，可直接用于章节规划",
      "- 仅输出 Markdown，不要解释推理过程",
    ].join("\n");
  }

  throw new Error("Unsupported setting mode");
}

function buildReferenceAnalysisPrompt({ project, ideation, userRequest, guardrails }) {
  const novelName = userRequest || "未指定作品";
  return [
    "# 任务",
    `分析《${novelName}》的结构机制，提炼可复用的创作方法论。`,
    "",
    "# 原创性护栏",
    guardrails,
    "",
    "# 单作品分析特别规则",
    "所有提取的模式必须用抽象结构语言描述，禁止出现原作的任何专有名词（角色名、地名、功法名、种族名等）。",
    "如果某个模式必须依赖原作特定设定才能理解，则该模式不具有可复用性，应跳过。",
    "",
    "# 当前项目信息（用于输出应用建议）",
    formatSummary(project),
    "",
    "# 当前立项",
    formatIdeation(ideation),
    "",
    "# 分析维度（每个维度输出3-5条可复用机制）",
    "",
    "## 1. 节奏模板",
    "分析章节节奏规律：小高潮频率、大高潮间隔、紧张与舒缓交替模式、黄金开篇节奏。",
    "",
    "## 2. 升级/力量体系",
    "分析成长路线设计：等级划分逻辑、升级触发条件、能力解锁节奏、天花板设计。",
    "",
    "## 3. 反转手法",
    "分析常用反转技巧：打脸模式、身份反转、实力反差、信息差利用等具体运用方式。",
    "",
    "## 4. 钩子模式",
    "分析章末钩子类型：悬念设置方式、信息差利用、读者期待管理、跨章/跨卷钩子。",
    "",
    "## 5. 角色弧光",
    "分析主角成长轨迹：起始状态设计、关键转变节点、成长代价、终态设计。",
    "",
    "## 6. 爽点设计",
    "分析爽点类型和交付方式：即时满足vs延迟满足、情绪曲线、打脸爽/升级爽/反杀爽的节奏。",
    "",
    "## 7. 应用建议",
    `针对当前项目《${ideation.title || project.title}》（${ideation.genre || project.genre}），说明以上机制如何具体融入当前创作。`,
    "",
    "# 输出要求",
    "- 所有机制必须抽象化表达，禁止包含原作角色名、地名、招式名",
    "- 每个维度输出3-5条可直接应用的机制规则",
    "- 使用中文Markdown格式",
    "- 不要在前后添加解释或说明",
  ].join("\n");
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
