const providerPresentation = {
  openai: {
    label: "OpenAI",
    description: "通用稳定，适合默认路由。",
  },
  anthropic: {
    label: "Anthropic",
    description: "长上下文更强，适合审查。",
  },
  openrouter: {
    label: "OpenRouter",
    description: "聚合路由，适合多模型试配。",
  },
  deepseek: {
    label: "DeepSeek",
    description: "性价比高，中文写作表现出色。",
  },
  qwen: {
    label: "通义千问",
    description: "阿里云大模型，中文理解力强。",
  },
  glm: {
    label: "智谱GLM",
    description: "清华系模型，中英双语均衡。",
  },
  gemini: {
    label: "Gemini",
    description: "Google 模型，多模态能力强。",
  },
  mistral: {
    label: "Mistral",
    description: "欧洲开源模型，推理速度快。",
  },
  custom: {
    label: "通用API",
    description: "NewAPI/OneAPI 等聚合接口，支持任意 OpenAI 兼容模型。",
  },
};

const costPresetLabels = {
  quality: "高质量",
  balanced: "平衡",
  budget: "省钱",
};

export function getProviderPresentation(providerId) {
  return providerPresentation[providerId] || { label: providerId || "Unknown", description: "" };
}

export function buildProviderSettingsSummaryFocus(config) {
  return {
    activeProviderLabel: getProviderPresentation(config.activeProvider).label,
    costPresetLabel: costPresetLabels[config.costPreset],
    writingModelLabel: config.roleModels.writing || "未设置",
  };
}

export function buildProviderCardFocus({
  providerId,
  hasApiKey,
  apiKeyPreview,
  clearFlag,
}) {
  const presentation = getProviderPresentation(providerId);

  return {
    label: presentation.label,
    description: presentation.description,
    statusLabel: hasApiKey ? "已配置" : "未配置",
    apiKeyPlaceholder: clearFlag
      ? "本次保存会清空已保存 Key"
      : apiKeyPreview || "留空表示不改动",
  };
}

export function buildProviderSettingsFooterNote({
  message,
  costPresetLabel,
  writingModelLabel,
}) {
  return String(message || "").trim() || `当前：${costPresetLabel} / 写作 ${writingModelLabel || "未设置"}`;
}
