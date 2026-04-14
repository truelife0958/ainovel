import type { ChapterContext } from "@/types/context";

export function buildChapterContext(
  projectRoot: string,
  chapterFileName: string,
  dependencies?: {
    runCommand?: () => Promise<string>;
  },
): Promise<ChapterContext>;
