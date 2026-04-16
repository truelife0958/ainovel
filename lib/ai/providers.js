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

  // Require HTTPS in production (allow HTTP for localhost in dev)
  if (parsed.protocol !== "https:" && !(parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Provider base URL must use HTTPS in production");
    }
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known internal/private ranges
  const blocked = [
    "169.254.169.254", // cloud metadata
    "metadata.google.internal",
    "100.100.100.200", // alibaba cloud metadata
    "0.0.0.0",
  ];
  if (blocked.includes(hostname)) {
    throw new Error("Provider base URL points to a blocked internal address");
  }

  // Block private network prefixes (IPv4)
  const isPrivate = (() => {
    if (hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname.startsWith("0.") || hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }
    // 172.16.0.0 - 172.31.255.255
    const m = hostname.match(/^172\.(\d+)\./);
    if (m) {
      const second = parseInt(m[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  })();

  // Block IPv6 private/internal ranges
  const isPrivateIPv6 = hostname.startsWith("[") && (
    hostname === "[::1]" ||
    hostname.startsWith("[::ffff:") ||    // IPv4-mapped IPv6
    hostname.startsWith("[fd") ||          // Unique local (fc00::/7)
    hostname.startsWith("[fe80:") ||       // Link-local
    hostname.startsWith("[fc")
  );

  if (isPrivate || isPrivateIPv6) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Provider base URL must not point to a private network address in production");
    }
  }
}

/**
 * 解密并验证 API Key
 */
function getDecryptedApiKey(config, provider) {
  if (!config.apiKey) {
    throw new Error(`Missing API key for ${provider}`);
  }

  // 尝试解密 - only if it matches the encrypted format (3 base64 segments)
  let apiKey = config.apiKey;
  const parts = config.apiKey.split(":");
  if (parts.length === 3 && parts.every(p => /^[A-Za-z0-9+/=]+$/.test(p))) {
    try {
      // 测试环境下不解密
      if (process.env.NODE_ENV !== "test") {
        apiKey = decryptSecret(config.apiKey);
      }
    } catch (decryptErr) {
      throw new Error(`API key decryption failed for ${provider}. Please re-enter your API key in Settings.`);
    }
  }

  // 验证格式（测试环境除外）
  if (process.env.NODE_ENV !== "test") {
    const validation = validateApiKeyFormat(apiKey, provider);
    if (!validation.valid) {
      throw new Error(`Invalid API key for ${provider}: ${validation.message}`);
    }
  }

  return apiKey;
}

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

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .filter((item) => item?.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
      .trim();
  }

  return "";
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

async function callOpenAi(config, invocation) {
  const apiKey = getDecryptedApiKey(config, "openai");

  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

  try {
    const baseUrl = config.baseUrl || "https://api.openai.com/v1";
    validateBaseUrl(baseUrl);
    const response = await fetch(joinUrl(baseUrl, "/responses"), {
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
      signal: controller.signal,
    });
    const payload = await parseJsonResponse(response);
    const text = extractOpenAiText(payload);

    if (!text) {
      throw new Error("OpenAI returned no text output");
    }

    // 限制输出长度防止内存问题
    const MAX_OUTPUT_LENGTH = 500000; // 500KB
    return text.slice(0, MAX_OUTPUT_LENGTH);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callAnthropic(config, invocation) {
  const apiKey = getDecryptedApiKey(config, "anthropic");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const baseUrl = config.baseUrl || "https://api.anthropic.com";
    validateBaseUrl(baseUrl);
    const response = await fetch(joinUrl(baseUrl, "/v1/messages"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: invocation.model,
        max_tokens: invocation.maxTokens || 8192,
        system: invocation.instructions,
        messages: [
          {
            role: "user",
            content: invocation.prompt,
          },
        ],
      }),
      signal: controller.signal,
    });
    const payload = await parseJsonResponse(response);
    const text = extractAnthropicText(payload);

    if (!text) {
      throw new Error("Anthropic returned no text output");
    }

    const MAX_OUTPUT_LENGTH = 500000;
    return text.slice(0, MAX_OUTPUT_LENGTH);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenRouter(config, invocation) {
  const apiKey = getDecryptedApiKey(config, "openrouter");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";
    validateBaseUrl(baseUrl);
    const response = await fetch(joinUrl(baseUrl, "/chat/completions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: invocation.model,
          messages: [
            {
              role: "system",
              content: invocation.instructions,
            },
            {
              role: "user",
              content: invocation.prompt,
            },
          ],
        }),
        signal: controller.signal,
      },
    );
    const payload = await parseJsonResponse(response);
    const text = extractOpenRouterText(payload);

    if (!text) {
      throw new Error("OpenRouter returned no text output");
    }

    const MAX_OUTPUT_LENGTH = 500000;
    return text.slice(0, MAX_OUTPUT_LENGTH);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 通用 OpenAI 兼容 API 调用函数
 * DeepSeek、Qwen、GLM、Mistral 等国产/开源模型均兼容 OpenAI Chat Completions API
 */
async function callOpenAiCompatible(config, invocation, providerLabel, defaultBaseUrl) {
  const apiKey = getDecryptedApiKey(config, invocation.provider);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const baseUrl = config.baseUrl || defaultBaseUrl;
    validateBaseUrl(baseUrl);
    const response = await fetch(
      joinUrl(baseUrl, "/chat/completions"),
      {
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
        signal: controller.signal,
      },
    );
    const payload = await parseJsonResponse(response);
    const text = extractOpenRouterText(payload);

    if (!text) {
      throw new Error(`${providerLabel} returned no text output`);
    }

    const MAX_OUTPUT_LENGTH = 500000;
    return text.slice(0, MAX_OUTPUT_LENGTH);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callDeepSeek(config, invocation) {
  return callOpenAiCompatible(config, invocation, "DeepSeek", "https://api.deepseek.com/v1");
}

async function callQwen(config, invocation) {
  return callOpenAiCompatible(config, invocation, "Qwen", "https://dashscope.aliyuncs.com/compatible-mode/v1");
}

async function callGLM(config, invocation) {
  return callOpenAiCompatible(config, invocation, "GLM", "https://open.bigmodel.cn/api/paas/v4");
}

async function callMistral(config, invocation) {
  return callOpenAiCompatible(config, invocation, "Mistral", "https://api.mistral.ai/v1");
}

async function callGemini(config, invocation) {
  const apiKey = getDecryptedApiKey(config, "gemini");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const baseUrl = config.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
    validateBaseUrl(baseUrl);
    // Sanitize model name to prevent path traversal
    const safeModel = encodeURIComponent(invocation.model);
    const response = await fetch(
      joinUrl(baseUrl, `/models/${safeModel}:generateContent`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: invocation.prompt }] }],
          systemInstruction: { parts: [{ text: invocation.instructions }] },
          generationConfig: {
            maxOutputTokens: invocation.maxTokens || 8192,
          },
        }),
        signal: controller.signal,
      },
    );
    const payload = await parseJsonResponse(response);
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const parts = candidates[0]?.content?.parts || [];
    const text = parts
      .filter((p) => typeof p.text === "string")
      .map((p) => p.text)
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("Gemini returned no text output");
    }

    const MAX_OUTPUT_LENGTH = 500000;
    return text.slice(0, MAX_OUTPUT_LENGTH);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callCustom(config, invocation) {
  return callOpenAiCompatible(config, invocation, "通用API", "");
}

export async function invokeProviderModel(config, invocation) {
  if (invocation.provider === "openai") {
    return callOpenAi(config, invocation);
  }
  if (invocation.provider === "anthropic") {
    return callAnthropic(config, invocation);
  }
  if (invocation.provider === "openrouter") {
    return callOpenRouter(config, invocation);
  }
  if (invocation.provider === "deepseek") {
    return callDeepSeek(config, invocation);
  }
  if (invocation.provider === "qwen") {
    return callQwen(config, invocation);
  }
  if (invocation.provider === "glm") {
    return callGLM(config, invocation);
  }
  if (invocation.provider === "gemini") {
    return callGemini(config, invocation);
  }
  if (invocation.provider === "mistral") {
    return callMistral(config, invocation);
  }
  if (invocation.provider === "custom") {
    return callCustom(config, invocation);
  }
  throw new Error(`Unsupported provider: ${invocation.provider}`);
}
