import type { ChapterBrief } from "@/types/briefs";

export function readChapterBrief(projectRoot: string, chapterFileName: string): Promise<ChapterBrief>;
export function updateChapterBrief(
  projectRoot: string,
  chapterFileName: string,
  content: string,
): Promise<ChapterBrief>;
