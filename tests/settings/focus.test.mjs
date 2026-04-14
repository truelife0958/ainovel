import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProviderCardFocus,
  buildProviderSettingsFooterNote,
  buildProviderSettingsSummaryFocus,
  getProviderPresentation,
} from "../../lib/settings/focus.js";

test("getProviderPresentation returns stable labels and descriptions", () => {
  assert.deepEqual(getProviderPresentation("openai"), {
    label: "OpenAI",
    description: "通用稳定，适合默认路由。",
  });
  assert.deepEqual(getProviderPresentation("anthropic"), {
    label: "Anthropic",
    description: "长上下文更强，适合审查。",
  });
  assert.deepEqual(getProviderPresentation("openrouter"), {
    label: "OpenRouter",
    description: "聚合路由，适合多模型试配。",
  });
});

test("buildProviderSettingsSummaryFocus returns active provider and writing model snapshot", () => {
  const focus = buildProviderSettingsSummaryFocus({
    activeProvider: "openrouter",
    costPreset: "budget",
    roleModels: {
      ideation: "gpt-5-mini",
      outlining: "gpt-5-mini",
      writing: "claude-sonnet",
      review: "gpt-5-mini",
    },
  });

  assert.equal(focus.activeProviderLabel, "OpenRouter");
  assert.equal(focus.costPresetLabel, "省钱");
  assert.equal(focus.writingModelLabel, "claude-sonnet");
});

test("buildProviderCardFocus derives status and placeholder for configured providers", () => {
  const focus = buildProviderCardFocus({
    providerId: "openai",
    hasApiKey: true,
    apiKeyPreview: "sk-****abcd",
    clearFlag: false,
  });

  assert.equal(focus.label, "OpenAI");
  assert.equal(focus.description, "通用稳定，适合默认路由。");
  assert.equal(focus.statusLabel, "已配置");
  assert.equal(focus.apiKeyPlaceholder, "sk-****abcd");
});

test("buildProviderCardFocus switches API key placeholder when clear flag is armed", () => {
  const focus = buildProviderCardFocus({
    providerId: "anthropic",
    hasApiKey: false,
    apiKeyPreview: "",
    clearFlag: true,
  });

  assert.equal(focus.label, "Anthropic");
  assert.equal(focus.statusLabel, "未配置");
  assert.equal(focus.apiKeyPlaceholder, "本次保存会清空已保存 Key");
});

test("buildProviderSettingsFooterNote prefers live status message and falls back to current route snapshot", () => {
  assert.equal(
    buildProviderSettingsFooterNote({
      message: "模型设置已保存",
      costPresetLabel: "平衡",
      writingModelLabel: "gpt-5-mini",
    }),
    "模型设置已保存",
  );
  assert.equal(
    buildProviderSettingsFooterNote({
      message: "",
      costPresetLabel: "平衡",
      writingModelLabel: "",
    }),
    "当前：平衡 / 写作 未设置",
  );
});
