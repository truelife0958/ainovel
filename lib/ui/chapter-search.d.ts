export function filterChapters<T extends { title?: string; fileName: string; chapterNumber?: number }>(
  chapters: T[],
  query: string,
): T[];
