import { basename } from "node:path";

/**
 * Extract chapter number from a file name.
 * Prefers "第N章" pattern (last occurrence); falls back to first digit sequence.
 * @param {string} chapterFileName
 * @returns {number}
 */
export function extractChapterNumber(chapterFileName) {
  const base = basename(String(chapterFileName || ""));
  const chapterMatch = base.match(/第\s*(\d{1,5})\s*章/gu);
  if (chapterMatch && chapterMatch.length > 0) {
    const last = chapterMatch[chapterMatch.length - 1];
    const num = last.match(/(\d{1,5})/);
    if (num) return Number(num[1]);
  }
  const match = base.match(/(\d{1,5})/);
  if (!match) {
    throw new Error("Unable to infer chapter number from file name");
  }
  return Number(match[1]);
}

/**
 * Safely cast a value to a plain object. Returns {} for non-objects.
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
export function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * Safely cast a value to an array. Returns [] for non-arrays.
 * @param {unknown} value
 * @returns {unknown[]}
 */
export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Map asset node type to Chinese label.
 * @param {"setting" | "outline" | "chapter"} type
 * @returns {string}
 */
export function typeLabel(type) {
  switch (type) {
    case "setting": return "设定";
    case "outline": return "大纲";
    case "chapter": return "章节";
    default: return type;
  }
}
