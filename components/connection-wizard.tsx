"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import {
  buildProviderCardFocus,
  buildProviderSettingsFooterNote,
  buildProviderSettingsSummaryFocus,
  getProviderPresentation,
} from "@/lib/settings/focus.js";
import type {
  CostPreset,
  ModelRole,
  ProviderConfigSummary,
  ProviderId,
} from "@/types/settings";

type ConnectionWizardProps = {
  initialConfig: ProviderConfigSummary;
  onDirtyChange?: (dirty: boolean) => void;
};

type ProviderSecretState = Record<ProviderId, string>;
type ProviderClearState = Record<ProviderId, boolean>;

const providerIds: ProviderId[] = ["openai", "anthropic", "openrouter", "deepseek", "qwen", "glm", "gemini", "mistral", "custom"];
const roleIds: ModelRole[] = ["ideation", "outlining", "writing", "review"];

const emptySecrets: ProviderSecretState = Object.fromEntries(
  providerIds.map((id) => [id, ""]),
) as ProviderSecretState;

const emptyClearFlags: ProviderClearState = Object.fromEntries(
  providerIds.map((id) => [id, false]),
) as ProviderClearState;

const roleLabels: Record<ModelRole, string> = {
  ideation: "立项",
  outlining: "大纲",
  writing: "写作",
  review: "审查",
};

const costPresetLabels: Record<CostPreset, string> = {
  quality: "质量优先",
  balanced: "平衡",
  budget: "省钱",
};

const costPresetDescriptions: Record<CostPreset, string> = {
  quality: "使用最强模型，适合追求作品质量",
  balanced: "兼顾质量与成本，适合日常创作",
  budget: "使用经济模型，适合大量生成",
};

export function ConnectionWizard({ initialConfig, onDirtyChange }: ConnectionWizardProps) {
  const [config, setConfig] = useState(initialConfig);
  const [secrets, setSecrets] = useState<ProviderSecretState>({ ...emptySecrets });
  const [clearFlags, setClearFlags] = useState<ProviderClearState>({ ...emptyClearFlags });
  const [message, setMessage] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTestTransition] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Report dirty state: config diverges from initial, or any secret is set,
  // or any clear flag is true.
  useEffect(() => {
    if (!onDirtyChange) return;
    const configDirty = JSON.stringify(config) !== JSON.stringify(initialConfig);
    const secretDirty = providerIds.some((id) => (secrets[id] ?? "").length > 0);
    const clearDirty = providerIds.some((id) => clearFlags[id]);
    onDirtyChange(configDirty || secretDirty || clearDirty);
  }, [config, initialConfig, secrets, clearFlags, onDirtyChange]);

  const summaryFocus = buildProviderSettingsSummaryFocus(config);
  const isConnected = config.providers[config.activeProvider]?.hasApiKey;

  function updateSecret(providerId: ProviderId, value: string) {
    setSecrets((current) => ({ ...current, [providerId]: value }));
    if (value) {
      setClearFlags((current) => ({ ...current, [providerId]: false }));
    }
  }

  function updateClearFlag(providerId: ProviderId, value: boolean) {
    setClearFlags((current) => ({ ...current, [providerId]: value }));
    if (value) {
      setSecrets((current) => ({ ...current, [providerId]: "" }));
    }
  }

  function updateProvider(providerId: ProviderId, field: "baseUrl" | "model", value: string) {
    setConfig((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [providerId]: { ...current.providers[providerId], [field]: value },
      },
    }));
  }

  function updateRole(role: ModelRole, value: string) {
    setConfig((current) => ({
      ...current,
      roleModels: { ...current.roleModels, [role]: value },
    }));
  }

  async function saveConfig(): Promise<boolean> {
    const customConfigured = Boolean(
      secrets.custom.trim() || (config.providers.custom.hasApiKey && !clearFlags.custom),
    );
    const activeProvider =
      !showAdvanced && customConfigured
        ? "custom"
        : config.activeProvider;

    const providers = Object.fromEntries(
      providerIds.map((providerId) => [
        providerId,
        {
          baseUrl: config.providers[providerId].baseUrl,
          model: config.providers[providerId].model,
          clearApiKey: clearFlags[providerId],
          ...(secrets[providerId] ? { apiKey: secrets[providerId] } : {}),
        },
      ]),
    );

    const response = await fetch("/api/settings/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activeProvider,
        costPreset: config.costPreset,
        providers,
        roleModels: config.roleModels,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setMessage(payload.error || "保存失败");
      return false;
    }

    setConfig(payload.data);
    setSecrets({ ...emptySecrets });
    setClearFlags({ ...emptyClearFlags });
    return true;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      try {
        const ok = await saveConfig();
        if (ok) {
          setMessage("连接配置已保存");
          setTestResult(null);
        }
      } catch {
        setMessage("网络错误，保存设置失败，请重试。");
      }
    });
  }

  function handleTest() {
    setTestResult(null);
    startTestTransition(async () => {
      try {
        const ok = await saveConfig();
        if (!ok) {
          setTestResult({ ok: false, message: "保存失败，无法测试连接" });
          return;
        }
        setMessage("配置已保存，正在测试连接...");

        const response = await fetch("/api/settings/providers/test");
        const payload = await response.json();
        if (payload.ok) {
          setTestResult({ ok: true, message: "连接成功，AI 已就绪" });
        } else {
          setTestResult({ ok: false, message: payload.error || "连接失败" });
        }
      } catch {
        setTestResult({ ok: false, message: "无法访问接口，请检查地址和网络" });
      }
    });
  }

  const footerNote = buildProviderSettingsFooterNote({
    message,
    costPresetLabel: summaryFocus.costPresetLabel,
    writingModelLabel: config.roleModels.writing,
  });

  return (
    <form className="connection-wizard" onSubmit={handleSubmit}>
      {/* Connection Status */}
      <section className="connection-status-card">
        <div className="connection-status-indicator">
          <span className={`connection-dot ${isConnected ? "connected" : "disconnected"}`} />
          <div>
            <p className="connection-status-label">
              {isConnected ? "AI 已就绪" : "AI 未就绪"}
            </p>
            <p className="muted">
              {isConnected
                ? `当前套餐：${summaryFocus.costPresetLabel}`
                : "请先完成连接配置"}
            </p>
          </div>
        </div>
      </section>

      {/* Aggregated API (Default Path) */}
      <section className="connection-main-card list-card form-card">
        <div className="connection-main-head">
          <p className="eyebrow">推荐方式</p>
          <h3>聚合 API 接入</h3>
          <p className="muted">
            填写一个聚合接口地址和 Key，即可使用全部 AI 能力。适合大多数用户。
          </p>
        </div>

        <div className="form-grid compact">
          <label>
            <span>连接方式</span>
            <select disabled>
              <option>聚合 API（推荐）</option>
            </select>
          </label>
          <label>
            <span>Base URL</span>
            <input
              value={config.providers.custom.baseUrl}
              onChange={(event) => updateProvider("custom", "baseUrl", event.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </label>
          <label>
            <span>API Key</span>
            <input
              type={showKeys ? "text" : "password"}
              value={secrets.custom}
              onChange={(event) => updateSecret("custom", event.target.value)}
              placeholder={config.providers.custom.hasApiKey ? "已配置，留空不改动" : "输入 API Key"}
            />
          </label>
          <label>
            <span>模型套餐</span>
            <select
              value={config.costPreset}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  costPreset: event.target.value as CostPreset,
                }))
              }
            >
              {Object.entries(costPresetLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} — {costPresetDescriptions[value as CostPreset]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="connection-actions">
          <button
            type="button"
            className="action-button secondary"
            disabled={isTesting}
            onClick={handleTest}
          >
            {isTesting ? "测试中..." : "测试连接"}
          </button>
          <button
            type="submit"
            className="action-button"
            disabled={isPending}
          >
            {isPending ? "保存中..." : "保存并启用"}
          </button>
        </div>

        {testResult && (
          <p className={`connection-test-result ${testResult.ok ? "success" : "error"}`}>
            {testResult.message}
          </p>
        )}
      </section>

      {/* Advanced Configuration (Collapsed) */}
      <div className="connection-advanced-toggle">
        <button
          type="button"
          className="toggle-button"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? "收起高级配置" : "展开高级配置（直连 Provider）"}
        </button>
      </div>

      {showAdvanced && (
        <div className="connection-advanced-content">
          <div className="form-grid compact">
            <label>
              <span>默认提供商</span>
              <select
                value={config.activeProvider}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    activeProvider: event.target.value as ProviderId,
                  }))
                }
              >
                {providerIds.map((providerId) => (
                  <option key={providerId} value={providerId}>
                    {getProviderPresentation(providerId).label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="provider-grid">
            {providerIds.map((providerId) => {
              const provider = config.providers[providerId];
              const providerFocus = buildProviderCardFocus({
                providerId,
                hasApiKey: provider.hasApiKey,
                apiKeyPreview: provider.apiKeyPreview,
                clearFlag: clearFlags[providerId],
              });
              return (
                <section key={providerId} className="provider-card">
                  <div className="row-head">
                    <div className="provider-title">
                      <strong>{providerFocus.label}</strong>
                      <p className="muted">{providerFocus.description}</p>
                    </div>
                    <span className={provider.hasApiKey ? "status-chip active" : "status-chip"}>
                      {providerFocus.statusLabel}
                    </span>
                  </div>
                  <label>
                    <span>API Key</span>
                    <input
                      type={showKeys ? "text" : "password"}
                      value={secrets[providerId]}
                      onChange={(event) => updateSecret(providerId, event.target.value)}
                      placeholder={providerFocus.apiKeyPlaceholder}
                      disabled={clearFlags[providerId]}
                    />
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={showKeys}
                      onChange={(event) => setShowKeys(event.target.checked)}
                    />
                    <span>显示 API Key</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={clearFlags[providerId]}
                      onChange={(event) => updateClearFlag(providerId, event.target.checked)}
                    />
                    <span>保存时清空已保存 API Key</span>
                  </label>
                  <label>
                    <span>Base URL</span>
                    <input
                      value={provider.baseUrl}
                      onChange={(event) => updateProvider(providerId, "baseUrl", event.target.value)}
                      placeholder="默认即可"
                    />
                  </label>
                  <label>
                    <span>默认模型</span>
                    <input
                      value={provider.model}
                      onChange={(event) => updateProvider(providerId, "model", event.target.value)}
                      placeholder="输入模型 ID"
                    />
                  </label>
                </section>
              );
            })}
          </div>

          <div className="list-card form-card">
            <div>
              <p className="eyebrow">模型角色路由</p>
              <p className="muted">只在某个环节需要单独模型时填写，保持最少必要配置。</p>
            </div>
            <div className="form-grid compact">
              {roleIds.map((role) => (
                <label key={role}>
                  <span>{roleLabels[role]}</span>
                  <input
                    value={config.roleModels[role]}
                    onChange={(event) => updateRole(role, event.target.value)}
                    placeholder="输入模型 ID"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save Bar */}
      <div className="connection-save-bar">
        <p className="muted" aria-live="polite">{footerNote}</p>
      </div>
    </form>
  );
}
