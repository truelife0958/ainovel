"use client";

import { extractUsage, formatAiCall } from "@/lib/ai/telemetry.js";

type AiStatusLineProps = {
  lastCall: { latencyMs: number; usage: unknown } | null;
};

export function AiStatusLine({ lastCall }: AiStatusLineProps) {
  if (!lastCall) return null;
  const normalized = extractUsage(lastCall.usage);
  const display = formatAiCall({
    latencyMs: lastCall.latencyMs,
    usage: normalized.input || normalized.output
      ? { input: normalized.input, output: normalized.output }
      : null,
  });
  const cacheHint = normalized.cacheRead > 0 ? ` · cache hit ${normalized.cacheRead}` : "";
  return (
    <span
      className="ai-status-line"
      title="上次 AI 调用的耗时与 token 用量"
    >
      {display}{cacheHint}
    </span>
  );
}
