import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAiCall, extractUsage } from "../../lib/ai/telemetry.js";

test("formatAiCall renders latency + input→output tokens", () => {
  assert.equal(
    formatAiCall({ latencyMs: 1200, usage: { input: 2300, output: 1100 } }),
    "1.2s · 2.3k→1.1k tokens",
  );
});

test("formatAiCall handles missing usage gracefully", () => {
  assert.equal(
    formatAiCall({ latencyMs: 800, usage: null }),
    "0.8s · —",
  );
});

test("formatAiCall shows small integer token counts without k suffix", () => {
  assert.equal(
    formatAiCall({ latencyMs: 500, usage: { input: 42, output: 17 } }),
    "0.5s · 42→17 tokens",
  );
});

test("extractUsage normalizes Anthropic shape", () => {
  const u = extractUsage({
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: 20,
    cache_read_input_tokens: 80,
  });
  assert.equal(u.input, 100);
  assert.equal(u.output, 50);
  assert.equal(u.cacheRead, 80);
  assert.equal(u.cacheCreate, 20);
});

test("extractUsage normalizes OpenAI Chat Completion shape", () => {
  const u = extractUsage({
    prompt_tokens: 300,
    completion_tokens: 150,
    total_tokens: 450,
  });
  assert.equal(u.input, 300);
  assert.equal(u.output, 150);
  assert.equal(u.cacheRead, 0);
});

test("extractUsage normalizes Gemini shape", () => {
  const u = extractUsage({
    promptTokenCount: 200,
    candidatesTokenCount: 80,
    totalTokenCount: 280,
  });
  assert.equal(u.input, 200);
  assert.equal(u.output, 80);
});

test("extractUsage returns zeros when input is null or unrecognized", () => {
  assert.deepEqual(extractUsage(null), { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 });
  assert.deepEqual(extractUsage(undefined), { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 });
  assert.deepEqual(extractUsage({ unknown: 123 }), { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 });
});
