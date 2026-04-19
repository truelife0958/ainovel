/**
 * Filter a list of chapter metas by a user query.
 *
 * - Empty query returns all chapters.
 * - Pure numeric query matches only by exact chapter number (so "1"
 *   finds chapter 1 but not 10/11/12, even though their filenames
 *   contain a "1").
 * - Non-numeric query matches title or filename substring, case
 *   insensitive.
 *
 * @param {Array<{ title?: string, fileName: string, chapterNumber?: number }>} chapters
 * @param {string} query
 * @returns {Array<typeof chapters[number]>}
 */
export function filterChapters(chapters, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return chapters;
  const numeric = Number(q);
  const numericExact = Number.isFinite(numeric) && String(numeric) === q;
  if (numericExact) {
    return chapters.filter((ch) => ch.chapterNumber === numeric);
  }
  return chapters.filter((ch) => {
    if (ch.title && String(ch.title).toLowerCase().includes(q)) return true;
    if (ch.fileName && String(ch.fileName).toLowerCase().includes(q)) return true;
    return false;
  });
}
