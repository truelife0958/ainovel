/**
 * Sanitize user text input by stripping control characters.
 * Preserves printable characters and common whitespace (\n, \r, \t).
 */
export function sanitizeInput(value: string | undefined, maxLength: number): string {
  if (!value || typeof value !== "string") {
    return "";
  }
  const sanitized = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return sanitized.slice(0, maxLength);
}

/**
 * Sanitize document content by stripping dangerous control characters
 * while preserving newlines, carriage returns, and tabs.
 */
export function sanitizeContent(value: string | undefined, maxSize: number): string {
  if (!value || typeof value !== "string") {
    return "";
  }
  const sanitized = value.replace(
    /[\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0B\x0C\x0E\x0F\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1A\x1B\x1C\x1D\x1E\x1F\x7F]/g,
    "",
  );
  return sanitized.slice(0, maxSize);
}

/**
 * Validate content byte size against a maximum.
 * Throws if content exceeds maxSize bytes.
 */
export function validateContentSize(content: string, maxSize: number, label = "Content"): void {
  const size = Buffer.byteLength(content, "utf8");
  if (size > maxSize) {
    throw new Error(
      `${label} too large: ${Math.round(size / 1024)}KB, max ${Math.round(maxSize / 1024)}KB`,
    );
  }
}
