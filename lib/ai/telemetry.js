/**
 * Normalize a provider-specific usage blob into a common shape.
 *
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {{ input: number, output: number, cacheRead: number, cacheCreate: number }}
 */
export function extractUsage(raw) {
  if (!raw || typeof raw !== "object") {
    return { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
  }
  const r = raw;
  // Anthropic
  if ("input_tokens" in r || "output_tokens" in r) {
    return {
      input: Number(r.input_tokens) || 0,
      output: Number(r.output_tokens) || 0,
      cacheRead: Number(r.cache_read_input_tokens) || 0,
      cacheCreate: Number(r.cache_creation_input_tokens) || 0,
    };
  }
  // OpenAI-compatible (OpenAI Chat Completions, DeepSeek, Qwen, GLM, Mistral, OpenRouter)
  if ("prompt_tokens" in r || "completion_tokens" in r) {
    return {
      input: Number(r.prompt_tokens) || 0,
      output: Number(r.completion_tokens) || 0,
      cacheRead: 0,
      cacheCreate: 0,
    };
  }
  // Gemini
  if ("promptTokenCount" in r || "candidatesTokenCount" in r) {
    return {
      input: Number(r.promptTokenCount) || 0,
      output: Number(r.candidatesTokenCount) || 0,
      cacheRead: 0,
      cacheCreate: 0,
    };
  }
  return { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
}

function formatK(n) {
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(1) + "k";
}

/**
 * Format `{ latencyMs, usage }` for display in the bottom bar.
 *
 * @param {{ latencyMs: number, usage: { input: number, output: number } | null }} call
 * @returns {string}
 */
export function formatAiCall(call) {
  const sec = (call.latencyMs / 1000).toFixed(1) + "s";
  if (!call.usage) return `${sec} · —`;
  return `${sec} · ${formatK(call.usage.input)}→${formatK(call.usage.output)} tokens`;
}
