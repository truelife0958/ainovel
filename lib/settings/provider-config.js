import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { decryptSecret, encryptSecret, maskApiKeyDisplay } from "./encryption.js";
import { asObject } from "../utils.js";
import { acquireFileLock, releaseFileLock, atomicWriteJSON } from "../projects/file-lock.js";

const PROVIDERS = ["openai", "anthropic", "openrouter", "deepseek", "qwen", "glm", "gemini", "mistral", "custom"];
const ROLES = ["ideation", "outlining", "writing", "review"];
const COST_PRESETS = ["quality", "balanced", "budget"];

const defaultConfig = Object.freeze({
  activeProvider: "openai",
  costPreset: "balanced",
  providers: {
    openai: {
      apiKey: "",
      baseUrl: "",
      model: "gpt-5-mini",
    },
    anthropic: {
      apiKey: "",
      baseUrl: "",
      model: "claude-sonnet-4-5",
    },
    openrouter: {
      apiKey: "",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "openai/gpt-5-mini",
    },
    deepseek: {
      apiKey: "",
      baseUrl: "",
      model: "deepseek-chat",
    },
    qwen: {
      apiKey: "",
      baseUrl: "",
      model: "qwen-plus",
    },
    glm: {
      apiKey: "",
      baseUrl: "",
      model: "glm-4-flash",
    },
    gemini: {
      apiKey: "",
      baseUrl: "",
      model: "gemini-2.0-flash",
    },
    mistral: {
      apiKey: "",
      baseUrl: "",
      model: "mistral-large-latest",
    },
    custom: {
      apiKey: "",
      baseUrl: "",
      model: "",
    },
  },
  roleModels: {
    ideation: "gpt-5-mini",
    outlining: "gpt-5-mini",
    writing: "claude-sonnet-4-5",
    review: "claude-sonnet-4-5",
  },
});

export function providerDisplayName(providerId) {
  const names = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    openrouter: "OpenRouter",
    deepseek: "DeepSeek",
    qwen: "通义千问",
    glm: "智谱GLM",
    gemini: "Gemini",
    mistral: "Mistral",
    custom: "通用API",
  };
  return names[providerId] || String(providerId || "Unknown");
}



function trimString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function isEnoent(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function configFilePath(configRoot) {
  const resolvedRoot = resolve(
    configRoot || process.env.WEBNOVEL_WRITER_CONFIG_ROOT || join(homedir(), ".webnovel-writer"),
  );
  return {
    root: resolvedRoot,
    file: join(resolvedRoot, "provider-config.json"),
  };
}

function decodePersistedConfig(input) {
  const source = asObject(input);
  const providers = asObject(source.providers);

  return {
    ...source,
    providers: Object.fromEntries(
      PROVIDERS.map((providerId) => {
        const candidate = asObject(providers[providerId]);
        return [
          providerId,
          {
            ...candidate,
            apiKey: decryptSecret(trimString(candidate.apiKey)),
          },
        ];
      }),
    ),
  };
}

function encodePersistedConfig(config) {
  return {
    ...config,
    providers: Object.fromEntries(
      PROVIDERS.map((providerId) => {
        const provider = config.providers[providerId];
        return [
          providerId,
          {
            ...provider,
            apiKey: encryptSecret(trimString(provider.apiKey)),
          },
        ];
      }),
    ),
  };
}

function normalizeConfig(input) {
  const source = asObject(input);
  const providers = asObject(source.providers);
  const roleModels = asObject(source.roleModels);

  const normalizedProviders = Object.fromEntries(
    PROVIDERS.map((providerId) => {
      const defaults = defaultConfig.providers[providerId];
      const candidate = asObject(providers[providerId]);

      return [
        providerId,
        {
          apiKey: trimString(candidate.apiKey, defaults.apiKey),
          baseUrl: trimString(candidate.baseUrl, defaults.baseUrl),
          model: trimString(candidate.model, defaults.model) || defaults.model,
        },
      ];
    }),
  );

  const normalizedRoles = Object.fromEntries(
    ROLES.map((roleId) => [
      roleId,
      trimString(roleModels[roleId], defaultConfig.roleModels[roleId]) ||
        defaultConfig.roleModels[roleId],
    ]),
  );

  const activeProvider = PROVIDERS.includes(source.activeProvider)
    ? source.activeProvider
    : defaultConfig.activeProvider;
  const costPreset = COST_PRESETS.includes(source.costPreset)
    ? source.costPreset
    : defaultConfig.costPreset;

  return {
    activeProvider,
    costPreset,
    providers: normalizedProviders,
    roleModels: normalizedRoles,
  };
}

function mergeConfig(currentConfig, patch) {
  const providerPatch = asObject(patch.providers);
  const mergedProviders = Object.fromEntries(
    PROVIDERS.map((providerId) => {
      const nextProviderPatch = asObject(providerPatch[providerId]);
      const clearApiKey = nextProviderPatch.clearApiKey === true;

      return [
        providerId,
        {
          ...currentConfig.providers[providerId],
          ...nextProviderPatch,
          ...(clearApiKey ? { apiKey: "" } : {}),
        },
      ];
    }),
  );
  const mergedRoles = {
    ...currentConfig.roleModels,
    ...asObject(patch.roleModels),
  };

  return normalizeConfig({
    ...currentConfig,
    ...asObject(patch),
    providers: mergedProviders,
    roleModels: mergedRoles,
  });
}

export async function readProviderConfig(configRoot) {
  const { file } = configFilePath(configRoot);

  try {
    const raw = JSON.parse(await readFile(file, "utf8"));
    return mergeConfig(defaultConfig, decodePersistedConfig(raw));
  } catch (error) {
    if (!isEnoent(error)) {
      throw error;
    }
    return normalizeConfig(defaultConfig);
  }
}

export async function updateProviderConfig(configRoot, patch = {}) {
  const { root, file } = configFilePath(configRoot);
  const lockKey = resolve(root);

  await acquireFileLock(lockKey);
  try {
    const current = await readProviderConfig(configRoot);
    const next = mergeConfig(current, patch);
    await atomicWriteJSON(file, encodePersistedConfig(next));
    return next;
  } finally {
    releaseFileLock(lockKey);
  }
}

export async function readProviderConfigSummary(configRoot) {
  const config = await readProviderConfig(configRoot);

  return {
    ...config,
    providers: Object.fromEntries(
      PROVIDERS.map((providerId) => {
        const provider = config.providers[providerId];
        return [
          providerId,
          {
            baseUrl: provider.baseUrl,
            model: provider.model,
            hasApiKey: Boolean(provider.apiKey),
            apiKeyPreview: maskApiKeyDisplay(provider.apiKey),
          },
        ];
      }),
    ),
  };
}

export function createProviderRuntimeStatus(config, role) {
  const providerId = config.activeProvider;
  const provider = config.providers[providerId];
  const providerLabel = providerDisplayName(providerId);
  const model = config.roleModels[role] || provider.model;

  return {
    available: Boolean(provider.hasApiKey),
    providerId,
    providerLabel,
    model,
    message: provider.hasApiKey
      ? `AI 已就绪：${providerLabel} / ${model}`
      : `AI 未就绪：请先在连接页为 ${providerLabel} 配置 API Key。`,
  };
}

export async function readProviderRuntimeStatus(configRoot, role) {
  const config = await readProviderConfigSummary(configRoot);
  return createProviderRuntimeStatus(config, role);
}