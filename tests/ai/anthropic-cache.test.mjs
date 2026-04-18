import { test } from "node:test";
import assert from "node:assert/strict";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

test("Anthropic request body includes cache_control on system prompt by default", async () => {
  process.env.NODE_ENV = "test";
  let captured;
  const fakeFetch = async (url, init) => {
    captured = { url, init };
    return {
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "hello" }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 10,
        },
      }),
    };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch;
  const originalEnv = process.env.WEBNOVEL_DISABLE_PROMPT_CACHE;
  delete process.env.WEBNOVEL_DISABLE_PROMPT_CACHE;
  try {
    const { invokeProviderModel } = await import("../../lib/ai/providers.js?t=" + Date.now());
    const result = await invokeProviderModel(
      { apiKey: "sk-test-anthropic" },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001", instructions: "system text", prompt: "user text" },
    );
    const body = JSON.parse(captured.init.body);
    assert.ok(Array.isArray(body.system), "system should be array for cache_control");
    assert.equal(body.system[0].cache_control.type, "ephemeral");
    assert.equal(body.system[0].text, "system text");
    assert.equal(result.text, "hello");
    assert.equal(result.usage.input_tokens, 10);
    assert.equal(result.usage.cache_creation_input_tokens, 10);
    assert.ok(typeof result.latencyMs === "number");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) process.env.WEBNOVEL_DISABLE_PROMPT_CACHE = originalEnv;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
});

test("WEBNOVEL_DISABLE_PROMPT_CACHE=1 omits cache_control and uses plain string system", async () => {
  process.env.NODE_ENV = "test";
  let captured;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return { ok: true, json: async () => ({ content: [{ type: "text", text: "hi" }], usage: { input_tokens: 1, output_tokens: 1 } }) };
  };
  process.env.WEBNOVEL_DISABLE_PROMPT_CACHE = "1";
  try {
    const { invokeProviderModel } = await import("../../lib/ai/providers.js?t=" + Date.now());
    await invokeProviderModel(
      { apiKey: "sk-test-anthropic" },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001", instructions: "sys", prompt: "u" },
    );
    const body = JSON.parse(captured.init.body);
    assert.equal(typeof body.system, "string", "system falls back to plain string when caching disabled");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.WEBNOVEL_DISABLE_PROMPT_CACHE;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
});

test("Anthropic response shape is { text, usage, latencyMs }", async () => {
  process.env.NODE_ENV = "test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      content: [{ type: "text", text: "some chapter prose" }],
      usage: { input_tokens: 42, output_tokens: 17 },
    }),
  });
  try {
    const { invokeProviderModel } = await import("../../lib/ai/providers.js?t=" + Date.now());
    const result = await invokeProviderModel(
      { apiKey: "sk-test-anthropic" },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001", instructions: "s", prompt: "u" },
    );
    assert.equal(typeof result.text, "string");
    assert.equal(result.usage.input_tokens, 42);
    assert.ok(result.latencyMs >= 0);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
});

