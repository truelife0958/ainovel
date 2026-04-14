const LIST_SPLIT_RE = /[、,，/|+；;]+/;

function cleanText(value) {
  return String(value || "").replace(/\r/g, "").trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBriefField(content, labels) {
  const options = Array.isArray(labels) ? labels : [labels];
  const source = cleanText(content);

  for (const label of options) {
    const pattern = new RegExp(`^[*-]\\s*${escapeRegex(label)}[：:][ \\t]*([^\\n]+)$`, "m");
    const match = source.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return "";
}

function splitList(value) {
  const tokens = cleanText(value)
    .split(LIST_SPLIT_RE)
    .map((item) => item.trim())
    .filter(Boolean);

  const deduped = [];
  const seen = new Set();
  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      deduped.push(token);
    }
  }
  return deduped;
}

function extractTypedValue(value, suffix = "") {
  const text = cleanText(value);
  if (!text) {
    return { type: "", content: "" };
  }

  const pattern = suffix
    ? new RegExp(`^(.+?${escapeRegex(suffix)})\\s*[-：:]\\s*(.+)$`)
    : /^(.+?)\s*[-：:]\s*(.+)$/;
  const match = text.match(pattern);

  if (!match) {
    return { type: "", content: text };
  }

  return {
    type: match[1].trim(),
    content: match[2].trim(),
  };
}

function extractTitle(content) {
  const match = cleanText(content).match(/^###\s*第\s*\d+\s*章[：:]\s*(.+)$/m);
  return match ? match[1].trim() : "";
}

/**
 * @param {string} content
 */
export function parseChapterBriefContent(content) {
  const rawCoolpoint = extractBriefField(content, "爽点");
  const rawHook = extractBriefField(content, ["钩子", "章末钩子"]);
  const coolpoint = extractTypedValue(rawCoolpoint);
  const hook = extractTypedValue(rawHook, "钩");

  const coolpointPatterns = splitList(rawCoolpoint)
    .map((item) => extractTypedValue(item).type || item)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    title: extractTitle(content),
    goal: extractBriefField(content, ["目标", "本章目标"]),
    conflict: extractBriefField(content, "主要冲突"),
    carry: extractBriefField(content, "承接上章"),
    obstacle: extractBriefField(content, ["阻力", "关键阻力"]),
    cost: extractBriefField(content, "代价"),
    coolpoint: coolpoint.content,
    coolpointPatterns,
    strand: extractBriefField(content, "Strand"),
    antagonistTier: extractBriefField(content, "反派层级"),
    pov: extractBriefField(content, "视角/主角"),
    keyEntities: splitList(extractBriefField(content, "关键实体")),
    change: extractBriefField(content, "本章变化"),
    endQuestion: extractBriefField(content, "章末未闭合问题"),
    hookType: hook.type,
    hook: hook.content,
    rawHook: rawHook || hook.content,
    rawCoolpoint: rawCoolpoint,
  };
}

/**
 * @param {ReturnType<typeof parseChapterBriefContent>} parsed
 */
export function formatChapterBriefForPrompt(parsed) {
  const lines = [
    `标题：${parsed.title || "未填写"}`,
    `目标：${parsed.goal || "未填写"}`,
    `主要冲突：${parsed.conflict || "未填写"}`,
    `承接上章：${parsed.carry || "未填写"}`,
    `阻力：${parsed.obstacle || "未填写"}`,
    `代价：${parsed.cost || "未填写"}`,
    `爽点：${parsed.rawCoolpoint || "未填写"}`,
    `Strand：${parsed.strand || "未填写"}`,
    `反派层级：${parsed.antagonistTier || "未填写"}`,
    `视角/主角：${parsed.pov || "未填写"}`,
    `关键实体：${parsed.keyEntities.join(" / ") || "未填写"}`,
    `本章变化：${parsed.change || "未填写"}`,
    `章末未闭合问题：${parsed.endQuestion || "未填写"}`,
    `钩子类型：${parsed.hookType || "未填写"}`,
    `钩子内容：${parsed.hook || parsed.rawHook || "未填写"}`,
    `爽点模式：${parsed.coolpointPatterns.join(" / ") || "未填写"}`,
  ];

  return lines.join("\n");
}

const REQUIRED_FIELDS = [
  ["goal", "目标"],
  ["obstacle", "阻力"],
  ["cost", "代价"],
  ["rawCoolpoint", "爽点"],
  ["strand", "Strand"],
  ["antagonistTier", "反派层级"],
  ["pov", "视角/主角"],
  ["keyEntities", "关键实体"],
  ["change", "本章变化"],
  ["endQuestion", "章末未闭合问题"],
  ["rawHook", "钩子"],
];

/**
 * @param {ReturnType<typeof parseChapterBriefContent>} parsed
 */
export function validateChapterBrief(parsed) {
  const missingFields = REQUIRED_FIELDS.filter(([key]) => {
    const value = parsed[key];
    return Array.isArray(value) ? value.length === 0 : !cleanText(value);
  }).map(([, label]) => label);

  const warnings = [];

  if (parsed.rawHook && !parsed.hookType) {
    warnings.push({
      code: "missing_hook_type",
      severity: "medium",
      message: "钩子建议使用“类型 - 内容”格式，便于后续节奏统计和承接。",
    });
  }

  if (parsed.rawHook && !parsed.endQuestion) {
    warnings.push({
      code: "hook_without_end_question",
      severity: "high",
      message: "已有章末钩子，但缺少“章末未闭合问题”，读者追更驱动力可能不够明确。",
    });
  }

  if (!parsed.rawHook && parsed.endQuestion) {
    warnings.push({
      code: "end_question_without_hook",
      severity: "high",
      message: "已有章末未闭合问题，但没有对应钩子，结尾张力可能落空。",
    });
  }

  return {
    missingFields,
    warnings,
  };
}
