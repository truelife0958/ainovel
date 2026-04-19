/**
 * Combine chapter documents into a single .txt blob for export. Each
 * chapter is separated by two blank lines; the title (if any) is
 * prefixed as its own line.
 *
 * @param {Array<{ title?: string, content: string }>} chapters
 * @returns {string}
 */
export function combineChaptersAsTxt(chapters) {
  if (!Array.isArray(chapters) || chapters.length === 0) return "";
  return chapters
    .map((ch) => {
      const title = ch && ch.title ? `${ch.title}\n\n` : "";
      return `${title}${String(ch && ch.content ? ch.content : "").trim()}`;
    })
    .join("\n\n\n");
}

/**
 * Sanitize a filename for use in HTTP Content-Disposition. Removes path
 * separators and ASCII control characters; truncates to 120 chars.
 *
 * @param {string} name
 * @returns {string}
 */
export function safeFileName(name) {
  return String(name || "export").replace(/[\\/\x00-\x1f]/g, "_").slice(0, 120);
}
