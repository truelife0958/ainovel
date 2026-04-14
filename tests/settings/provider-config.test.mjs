import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createProviderRuntimeStatus,
  readProviderConfig,
  readProviderConfigSummary,
  updateProviderConfig,
} from "../../lib/settings/provider-config.js";

const createdDirs = [];

async function makeConfigRoot() {
  const root = await mkdtemp(join(tmpdir(), "webnovel-config-"));
  createdDirs.push(root);
  return root;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("readProviderConfig returns defaults when config file does not exist", async () => {
  const configRoot = await makeConfigRoot();

  const config = await readProviderConfig(configRoot);

  assert.equal(config.activeProvider, "openai");
  assert.equal(config.costPreset, "balanced");
  assert.deepEqual(config.providers.openai, {
    apiKey: "",
    baseUrl: "",
    model: "gpt-5-mini",
  });
  assert.equal(config.roleModels.writing, "claude-sonnet-4-5");
});

test("updateProviderConfig encrypts persisted secrets while summary stays masked", async () => {
  const configRoot = await makeConfigRoot();

  await updateProviderConfig(configRoot, {
    activeProvider: "openrouter",
    costPreset: "quality",
    providers: {
      openai: {
        apiKey: "sk-openai-123456",
        model: "gpt-5",
      },
      anthropic: {
        apiKey: "sk-ant-abcdef",
      },
      openrouter: {
        apiKey: "sk-or-999999",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "anthropic/claude-3.7-sonnet",
      },
    },
    roleModels: {
      ideation: "gpt-5",
      writing: "anthropic/claude-3.7-sonnet",
    },
  });

  const persisted = JSON.parse(await readFile(join(configRoot, "provider-config.json"), "utf8"));
  const stored = await readProviderConfig(configRoot);
  const summary = await readProviderConfigSummary(configRoot);

  assert.equal(stored.activeProvider, "openrouter");
  assert.equal(stored.providers.openai.apiKey, "sk-openai-123456");
  assert.equal(stored.providers.anthropic.apiKey, "sk-ant-abcdef");
  assert.equal(stored.roleModels.ideation, "gpt-5");

  assert.notEqual(persisted.providers.openai.apiKey, "sk-openai-123456");
  assert.notEqual(persisted.providers.anthropic.apiKey, "sk-ant-abcdef");
  assert.notEqual(persisted.providers.openrouter.apiKey, "sk-or-999999");
  assert.match(persisted.providers.openai.apiKey, /^[^:]+:[^:]+:.+$/);

  assert.equal(summary.providers.openai.hasApiKey, true);
  assert.equal(summary.providers.openai.apiKeyPreview, "sk-o...3456");
  assert.equal(summary.providers.anthropic.apiKeyPreview, "sk-a...cdef");
  assert.equal(summary.providers.openrouter.apiKeyPreview, "sk-o...9999");
  assert.equal(summary.providers.openrouter.apiKey, undefined);
});

test("readProviderConfig accepts legacy plaintext API keys", async () => {
  const configRoot = await makeConfigRoot();

  await writeFile(
    join(configRoot, "provider-config.json"),
    JSON.stringify({
      providers: {
        openai: {
          apiKey: "sk-openai-legacy",
        },
      },
    }),
    "utf8",
  );

  const stored = await readProviderConfig(configRoot);
  const summary = await readProviderConfigSummary(configRoot);

  assert.equal(stored.providers.openai.apiKey, "sk-openai-legacy");
  assert.equal(summary.providers.openai.hasApiKey, true);
  assert.equal(summary.providers.openai.apiKeyPreview, "sk-o...gacy");
});

test("updateProviderConfig can explicitly clear a previously saved API key", async () => {
  const configRoot = await makeConfigRoot();

  await updateProviderConfig(configRoot, {
    providers: {
      openai: {
        apiKey: "sk-openai-123456",
      },
    },
  });

  await updateProviderConfig(configRoot, {
    providers: {
      openai: {
        clearApiKey: true,
      },
    },
  });

  const stored = await readProviderConfig(configRoot);
  const summary = await readProviderConfigSummary(configRoot);

  assert.equal(stored.providers.openai.apiKey, "");
  assert.equal(summary.providers.openai.hasApiKey, false);
  assert.equal(summary.providers.openai.apiKeyPreview, "");
});

test("createProviderRuntimeStatus derives provider label, model and readiness message from summary config", () => {
  const status = createProviderRuntimeStatus(
    {
      activeProvider: "anthropic",
      costPreset: "balanced",
      providers: {
        openai: { hasApiKey: false, apiKeyPreview: "", baseUrl: "", model: "gpt-5-mini" },
        anthropic: { hasApiKey: true, apiKeyPreview: "sk-a...cdef", baseUrl: "", model: "claude-sonnet-4-5" },
        openrouter: { hasApiKey: false, apiKeyPreview: "", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-5-mini" },
      },
      roleModels: {
        ideation: "gpt-5-mini",
        outlining: "gpt-5-mini",
        writing: "claude-opus-4-1",
        review: "claude-sonnet-4-5",
      },
    },
    "writing",
  );

  assert.deepEqual(status, {
    available: true,
    providerId: "anthropic",
    providerLabel: "Anthropic",
    model: "claude-opus-4-1",
    message: "AI 已就绪：Anthropic / claude-opus-4-1",
  });
});
