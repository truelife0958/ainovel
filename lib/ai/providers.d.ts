import type { ProviderInvocation } from "@/types/ai";
import type { ProviderEntry } from "@/types/settings";

export function invokeProviderModel(
  config: ProviderEntry,
  invocation: ProviderInvocation,
): Promise<string>;
