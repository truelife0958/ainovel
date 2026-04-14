export type ProviderId = "openai" | "anthropic" | "openrouter" | "deepseek" | "qwen" | "glm" | "gemini" | "mistral" | "custom";
export type CostPreset = "quality" | "balanced" | "budget";
export type ModelRole = "ideation" | "outlining" | "writing" | "review";

export type ProviderEntry = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type ProviderEntrySummary = Omit<ProviderEntry, "apiKey"> & {
  hasApiKey: boolean;
  apiKeyPreview: string;
};

export type ProviderConfig = {
  activeProvider: ProviderId;
  costPreset: CostPreset;
  providers: Record<ProviderId, ProviderEntry>;
  roleModels: Record<ModelRole, string>;
};

export type ProviderConfigSummary = Omit<ProviderConfig, "providers"> & {
  providers: Record<ProviderId, ProviderEntrySummary>;
};

export type ProviderRuntimeStatus = {
  available: boolean;
  providerId: ProviderId;
  providerLabel: string;
  model: string;
  message: string;
};
