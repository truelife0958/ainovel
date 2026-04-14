import type {
  ModelRole,
  ProviderConfig,
  ProviderConfigSummary,
  ProviderRuntimeStatus,
} from "@/types/settings";

export function providerDisplayName(providerId: string): string;
export function readProviderConfig(configRoot?: string): Promise<ProviderConfig>;
export function updateProviderConfig(configRoot?: string, patch?: object): Promise<ProviderConfig>;
export function readProviderConfigSummary(configRoot?: string): Promise<ProviderConfigSummary>;
export function createProviderRuntimeStatus(
  config: ProviderConfigSummary,
  role: ModelRole,
): ProviderRuntimeStatus;
export function readProviderRuntimeStatus(
  configRoot: string | undefined,
  role: ModelRole,
): Promise<ProviderRuntimeStatus>;
