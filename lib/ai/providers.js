import { decryptSecret, validateApiKeyFormat } from "../settings/encryption.js";

function joinUrl(baseUrl, path) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}${path}`;
}

/**
 * Validate provider baseUrl to prevent SSRF attacks.
 * Blocks internal/private network addresses and non-HTTPS in production.
 */
function validateBaseUrl(urlStr) {
  if (!urlStr) return;

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid provider base URL: ${urlStr}`);
  }

  if (parsed.protocol !== "https:" && !(parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Provider base URL must use HTTPS in production");
    }
  }

  const hostname = parsed.hostname.toLowerCase();

  const blocked = [
    "169.254.169.254",
    "metadata.google.internal",
    "100.100.100.200",
    "0.0.0.0",
  ];
  if (blocked.includes(hostname)) {
    throw new Error("Provider base URL points to a blocked internal address");
  }

  const isPrivate = (() => {
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname.startsWith("0.") || hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }
    const m = hostname.match(/^172\.(\d+)\./);
    if (m) {
      const second = parseInt(m[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  })();

  const isPrivateIPv6 = hostname.startsWith("[") && (
    hostname === "[::1]" ||
    hostname.startsWith("[::ffff:") ||
    hostname.startsWith("[fd") ||
    hostname.startsWith("[fe80:") ||
    hostname.startsWith("[fc")
  );

  if (isPrivate || isPrivateIPv6) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Provider base URL must not point to a private network address in production");
    }
  }
}

function getDecryptedApiKey(config, provider) {
  if (!config.apiKey) {
    throw new Error(`Missing API key for ${provider}`);
  }

  let apiKey = config.apiKey;
  const parts = config.apiKey.split(":");
  if (parts.length === 3 && parts.every(p => /^[A-Za-z0-9+/=]+$/.test(p))) {
    try {
      if (process.env.NODE_ENV !== "test") {
        apiKey = decryptSecret(config.apiKey);
      }
    } catch {
      throw new Error(`API key decryption failed for ${provider}. Please re-enter your API key in Settings.`);
    }
  }

  if (process.env.NODE_ENV !== "test") {
    const validation = validateApiKeyFormat(apiKey, provider);
    if (!validation.valid) {
      throw new Error(`Invalid API key for ${provider}: ${validation.message}`);
    }
  }

  return apiKey;
}

/* ===== Response extractors ===== */

function extractOpenAiText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const output = Array.isArray(payload.output) ? payload.output : [];
  const fragments = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (block?.type === "output_text" && typeof block.text === "string") {
        fragments.push(block.text);
      }
    }
  }
  return fragments.join("\n").trim();
}

function extractAnthropicText(payload) {
  const content = Array.isArray(payload.content) ? payload.content : [];
  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function extractOpenRouterText(payload) {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const content = choice?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((item) => item?.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
      .trim();
  }
  return "";
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const parts = candidates[0]?.content?.parts || [];
  return parts
    .filter((p) => typeof p.text === "string")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error?.type ||
      payload?.message ||
      `Provider request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

const MAX_OUTPUT_LENGTH = 500000;

/**
 * Build a uniform caller from a provider strategy.
 * Handles: API-key decrypt, base-URL validation, 60 s timeout, external
 * signal chaining, response parsing, text truncation, latency timing.
 *
 * Strategy shape:
 *   defaultBaseUrl            string
 *   buildRequest({apiKey, baseUrl, invocation}) → {url, fetchInit}
 *   extractText(payload)      → string
 *   extractUsage(payload)     → unknown | null
 */
function createAdapter({ defaultBaseUrl, buildRequest, extractText, extractUsage }) {
  return async function callAdapter(config, invocation) {
    const apiKey = getDecryptedApiKey(config, invocation.provider);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    if (invocation.signal) {
      if (invocation.signal.aborted) controller.abort();
      else invocation.signal.addEventListener("abort", () => controller.abort());
    }
    const startedAt = Date.now();
    try {
      const baseUrl = config.baseUrl || defaultBaseUrl;
      validateBaseUrl(baseUrl);
      const { url, fetchInit } = buildRequest({ apiKey, baseUrl, invocation });
      const response = await fetch(url, { ...fetchInit, signal: controller.signal });
      const payload = await parseJsonResponse(response);
      const text = extractText(payload);
      if (!text) throw new Error(`${invocation.provider} returned no text output`);
      return {
        text: text.slice(0, MAX_OUTPUT_LENGTH),
        usage: extractUsage(payload),
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

const callOpenAi = createAdapter({
  defaultBaseUrl: "https://api.openai.com/v1",
  buildRequest: ({ apiKey, baseUrl, invocation }) => ({
    url: joinUrl(baseUrl, "/responses"),
    fetchInit: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: invocation.model,
        instructions: invocation.instructions,
        input: invocation.prompt,
      }),
    },
  }),
  extractText: extractOpenAiText,
  extractUsage: (p) => p.usage || null,
});

const callAnthropic = createAdapter({
  defaultBaseUrl: "https://api.anthropic.com",
  buildRequest: ({ apiKey, baseUrl, invocation }) => {
    const cacheDisabled = process.env.WEBNOVEL_DISABLE_PROMPT_CACHE === "1";
    const systemField = cacheDisabled
      ? invocation.instructions
      : [{ type: "text", text: invocation.instructions, cache_control: { type: "ephemeral" } }];
    return {
      url: joinUrl(baseUrl, "/v1/messages"),
      fetchInit: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: invocation.model,
          max_tokens: invocation.maxTokens || 8192,
          system: systemField,
          messages: [{ role: "user", content: invocation.prompt }],
        }),
      },
    };
  },
  extractText: extractAnthropicText,
  extractUsage: (p) => p.usage || null,
});

const callOpenRouter = createAdapter({
  defaultBaseUrl: "https://openrouter.ai/api/v1",
  buildRequest: ({ apiKey, baseUrl, invocation }) => ({
    url: joinUrl(baseUrl, "/chat/completions"),
    fetchInit: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: invocation.model,
        messages: [
          { role: "system", content: invocation.instructions },
          { role: "user", content: invocation.prompt },
        ],
      }),
    },
  }),
  extractText: extractOpenRouterText,
  extractUsage: (p) => p.usage || null,
});

function openAiCompatAdapter(defaultBaseUrl) {
  return createAdapter({
    defaultBaseUrl,
    buildRequest: ({ apiKey, baseUrl, invocation }) => ({
      url: joinUrl(baseUrl, "/chat/completions"),
      fetchInit: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: invocation.model,
          messages: [
            { role: "system", content: invocation.instructions },
            { role: "user", content: invocation.prompt },
          ],
          max_tokens: invocation.maxTokens || 8192,
        }),
      },
    }),
    extractText: extractOpenRouterText,
    extractUsage: (p) => p.usage || null,
  });
}

const callDeepSeek = openAiCompatAdapter("https://api.deepseek.com/v1");
const callQwen = openAiCompatAdapter("https://dashscope.aliyuncs.com/compatible-mode/v1");
const callGLM = openAiCompatAdapter("https://open.bigmodel.cn/api/paas/v4");
const callMistral = openAiCompatAdapter("https://api.mistral.ai/v1");
const callCustom = openAiCompatAdapter("");

const callGemini = createAdapter({
  defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  buildRequest: ({ apiKey, baseUrl, invocation }) => {
    const safeModel = encodeURIComponent(invocation.model);
    return {
      url: joinUrl(baseUrl, `/models/${safeModel}:generateContent`),
      fetchInit: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: invocation.prompt }] }],
          systemInstruction: { parts: [{ text: invocation.instructions }] },
          generationConfig: { maxOutputTokens: invocation.maxTokens || 8192 },
        }),
      },
    };
  },
  extractText: extractGeminiText,
  extractUsage: (p) => p.usageMetadata || null,
});

const ADAPTERS = {
  openai: callOpenAi,
  anthropic: callAnthropic,
  openrouter: callOpenRouter,
  deepseek: callDeepSeek,
  qwen: callQwen,
  glm: callGLM,
  gemini: callGemini,
  mistral: callMistral,
  custom: callCustom,
};

export async function invokeProviderModel(config, invocation) {
  const adapter = ADAPTERS[invocation.provider];
  if (!adapter) {
    throw new Error(`Unsupported provider: ${invocation.provider}`);
  }
  return adapter(config, invocation);
}
