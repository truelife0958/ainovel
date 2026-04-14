function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const REPAIR_GROUPS = [
  {
    key: "ending",
    label: "补钩子链",
    fields: ["钩子", "章末未闭合问题"],
    request: "仅补强结尾相关字段：章末未闭合问题、钩子。若已有其一，保留有效内容并只补足缺口，不要改写其他字段。",
  },
  {
    key: "pacing",
    label: "补爽点节奏",
    fields: ["爽点", "Strand"],
    request: "仅补强节奏相关字段：爽点、Strand。保持既有剧情方向不变，不要重写其他字段。",
  },
  {
    key: "scene",
    label: "补视角实体变化",
    fields: ["反派层级", "视角/主角", "关键实体", "本章变化"],
    request: "仅补强场景执行字段：反派层级、视角/主角、关键实体、本章变化。保持已有内容不动。",
  },
  {
    key: "core",
    label: "补目标冲突代价",
    fields: ["目标", "阻力", "代价"],
    request: "仅补强本章驱动字段：目标、阻力、代价。不要重写已明确的其他字段。",
  },
];

/**
 * @param {{ missingFields?: string[]; warnings?: Array<{ message?: string; severity?: string }> } | null | undefined} validation
 */
export function buildChapterRepairRequest(validation) {
  const missingFields = asArray(validation?.missingFields);
  const warnings = asArray(validation?.warnings);

  if (missingFields.length === 0 && warnings.length === 0) {
    return null;
  }

  const instructions = [
    "仅补齐缺失或薄弱字段，不要重写已经明确填写的字段。",
  ];

  if (missingFields.length > 0) {
    instructions.push(`优先补齐这些字段：${missingFields.join("、")}。`);
  }

  const highWarnings = warnings
    .filter((warning) => warning && warning.severity === "high")
    .map((warning) => warning.message)
    .filter(Boolean);

  if (highWarnings.length > 0) {
    instructions.push(`同时修复这些高风险问题：${highWarnings.join("；")}。`);
  }

  instructions.push("保持现有标题、已写字段和整体方向不变，只做结构补全与增强。");

  return {
    label: "AI 补全任务书",
    request: instructions.join(" "),
  };
}

/**
 * @param {{ missingFields?: string[]; warnings?: Array<{ message?: string; severity?: string; code?: string }> } | null | undefined} validation
 */
export function buildChapterRepairActions(validation) {
  const missingFields = asArray(validation?.missingFields);
  const warnings = asArray(validation?.warnings);

  return REPAIR_GROUPS.filter((group) => {
    if (group.key === "ending") {
      return (
        group.fields.some((field) => missingFields.includes(field)) ||
        warnings.some((warning) => typeof warning?.code === "string" && warning.code.includes("hook"))
      );
    }
    return group.fields.some((field) => missingFields.includes(field));
  }).map((group) => ({
    key: group.key,
    label: group.label,
    request: group.request,
  }));
}

/**
 * @param {{ missingFields?: string[]; warnings?: Array<{ message?: string; severity?: string; code?: string }> } | null | undefined} validation
 */
export function buildChapterRepairRecommendation(validation) {
  const actions = buildChapterRepairActions(validation);
  const warnings = asArray(validation?.warnings);
  const hasHighWarning = warnings.some((warning) => warning && warning.severity === "high");

  if (actions.length === 0) {
    return {
      primaryAction: null,
      secondaryActions: [],
      summary: "",
    };
  }

  return {
    primaryAction: actions[0],
    secondaryActions: actions.slice(1),
    summary: hasHighWarning ? `优先处理：${actions[0].label}` : `建议优先处理：${actions[0].label}`,
  };
}

/**
 * @param {{ missingFields?: string[]; warnings?: Array<{ message?: string; severity?: string; code?: string }> } | null | undefined} validation
 */
export function buildChapterRepairAdvice(validation) {
  const recommendation = buildChapterRepairRecommendation(validation);
  if (!recommendation.primaryAction) {
    return "";
  }

  return `建议下一步先点“${recommendation.primaryAction.label}”`;
}
