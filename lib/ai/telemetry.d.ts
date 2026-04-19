export type NormalizedUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
};
export function extractUsage(raw: unknown): NormalizedUsage;
export function formatAiCall(call: { latencyMs: number; usage: { input: number; output: number } | null }): string;
