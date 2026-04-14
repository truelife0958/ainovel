/**
 * Sanitize error messages before sending to the client.
 * Strips absolute filesystem paths that could leak server internals.
 */
const PATH_PATTERN = /(?:[A-Za-z]:[\\/]|\/)(?:[^\s"'`:)]+[\\/])*[^\s"'`:)]+/g;

export function sanitizeErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const knownMessages: Record<string, string> = {
    "Unsupported document kind": "不支持的文档类型",
    "Document file name is required": "缺少文件名",
    "Document title or file name is required": "缺少标题或文件名",
    "Chapter file name is required": "缺少章节文件名",
    "Unsupported AI mode": "不支持的 AI 模式",
    "Unsupported apply mode": "不支持的写入模式",
    "Invalid document path": "无效的文档路径",
    "Unable to infer chapter number from file name": "无法从文件名解析章节号",
    "Project path is outside the workspace": "路径越界",
    "Project root is invalid": "项目无效",
    "Project directory already exists": "项目已存在",
  };

  const msg = error.message;
  if (knownMessages[msg]) {
    return knownMessages[msg];
  }

  // For known prefix patterns (e.g. "Brief too large:", "Content too large:")
  if (msg.startsWith("Brief too large:") || msg.startsWith("Content too large:")) {
    return msg;
  }

  // Strip filesystem paths from unknown errors
  return msg.replace(PATH_PATTERN, "[path]");
}
