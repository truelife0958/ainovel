import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * 加密工具模块 - 使用 AES-256-GCM 加密敏感数据
 */

// 获取加密密钥（从环境变量或生成固定密钥）
function getEncryptionKey() {
  const envKey = process.env.WEBNOVEL_WRITER_KEY;
  if (envKey) {
    return scryptSync(envKey, "webnovel-salt-v2", 32);
  }
  // Fallback: 生产环境警告
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[webnovel-writer] WARNING: WEBNOVEL_WRITER_KEY not set. " +
      "Using hostname-based encryption key, which is insecure. " +
      "Set WEBNOVEL_WRITER_KEY environment variable for production."
    );
  }
  const machineKey = process.env.COMPUTERNAME || process.env.HOSTNAME || "default-machine";
  return scryptSync(machineKey, "webnovel-writer-v2", 32);
}

/**
 * 加密敏感字符串
 * @param {string} text - 要加密的文本
 * @returns {string} 加密后的文本 (base64格式: iv:encryptedData:authTag)
 */
export function encryptSecret(text) {
  if (!text) {
    return "";
  }

  try {
    const key = getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag();

    // 格式: iv:authTag:encrypted
    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * 解密敏感字符串
 * @param {string} encryptedText - 加密后的文本
 * @returns {string} 解密后的原文
 */
export function decryptSecret(encryptedText) {
  if (!encryptedText) {
    return "";
  }

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    // 非加密格式（明文 key），直接返回
    return encryptedText;
  }

  try {
    const [ivB64, authTagB64, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : "unknown error"}. ` +
      "This usually means the encryption key has changed. Please re-enter your API keys in Settings.",
    );
  }
}

/**
 * 验证 API Key 格式
 * @param {string} apiKey - API Key
 * @param {string} provider - 提供商 (openai/anthropic/openrouter)
 * @returns {{valid: boolean, message: string}}
 */
export function validateApiKeyFormat(apiKey, provider) {
  if (!apiKey || typeof apiKey !== "string") {
    return { valid: false, message: "API Key 不能为空" };
  }

  const trimmed = apiKey.trim();

  // 环境变量绕过检测（用于测试）
  if (process.env.SKIP_API_KEY_VALIDATION === "true") {
    return { valid: true, message: "跳过验证（测试模式）" };
  }

  if (provider === "openai") {
    // OpenAI API Key 格式: sk-xxxx... (sk- 开头，长度 >= 18)
    if (!trimmed.startsWith("sk-") || trimmed.length < 18) {
      return { valid: false, message: "OpenAI API Key 应以 sk- 开头，至少18个字符" };
    }
  } else if (provider === "anthropic") {
    // Anthropic API Key 格式: sk-ant-xxxx... 或 anthropic-xxxx...
    if ((!trimmed.startsWith("sk-ant-") && !trimmed.startsWith("anthropic-")) || trimmed.length < 20) {
      return { valid: false, message: "Anthropic API Key 格式不正确" };
    }
  } else if (provider === "openrouter") {
    // OpenRouter 格式多样，只检查基本长度
    if (trimmed.length < 10) {
      return { valid: false, message: "OpenRouter API Key 至少需要10个字符" };
    }
  } else if (provider === "deepseek") {
    // DeepSeek API Key: sk-... 格式
    if (trimmed.length < 10) {
      return { valid: false, message: "DeepSeek API Key 至少需要10个字符" };
    }
  } else if (provider === "qwen") {
    // 通义千问 API Key: sk-... 格式（DashScope）
    if (trimmed.length < 10) {
      return { valid: false, message: "通义千问 API Key 至少需要10个字符" };
    }
  } else if (provider === "glm") {
    // 智谱 API Key: 通常为十六进制或 JWT 格式
    if (trimmed.length < 10) {
      return { valid: false, message: "智谱 API Key 至少需要10个字符" };
    }
  } else if (provider === "gemini") {
    // Google Gemini API Key: AIza... 格式
    if (trimmed.length < 10) {
      return { valid: false, message: "Gemini API Key 至少需要10个字符" };
    }
  } else if (provider === "mistral") {
    // Mistral API Key
    if (trimmed.length < 10) {
      return { valid: false, message: "Mistral API Key 至少需要10个字符" };
    }
  } else if (provider === "custom") {
    // 通用API Key（NewAPI/OneAPI 等聚合接口，格式多样）
    if (trimmed.length < 5) {
      return { valid: false, message: "API Key 至少需要5个字符" };
    }
  }

  return { valid: true, message: "格式正确" };
}

/**
 * 安全地掩码显示 API Key
 * @param {string} apiKey - API Key
 * @returns {string} 掩码后的显示
 */
export function maskApiKeyDisplay(apiKey) {
  if (!apiKey) {
    return "";
  }

  const trimmed = apiKey.trim();

  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}