import type { ProviderConfigSummary, ProviderId } from "@/types/settings";

export type ProviderPresentation = {
  label: string;
  description: string;
};

export type ProviderSettingsSummaryFocus = {
  activeProviderLabel: string;
  costPresetLabel: string;
  writingModelLabel: string;
};

export type ProviderCardFocus = {
  label: string;
  description: string;
  statusLabel: string;
  apiKeyPlaceholder: string;
};

export function getProviderPresentation(providerId: ProviderId): ProviderPresentation;
export function buildProviderSettingsSummaryFocus(
  config: Pick<ProviderConfigSummary, "activeProvider" | "costPreset" | "roleModels">,
): ProviderSettingsSummaryFocus;
export function buildProviderCardFocus(input: {
  providerId: ProviderId;
  hasApiKey: boolean;
  apiKeyPreview: string;
  clearFlag: boolean;
}): ProviderCardFocus;
export function buildProviderSettingsFooterNote(input: {
  message: string;
  costPresetLabel: string;
  writingModelLabel: string;
}): string;
