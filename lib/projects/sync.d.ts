export function syncChapterArtifacts(
  projectRoot: string,
  chapterFileName: string,
  input?: {
    briefContent?: string;
    chapterContent?: string;
  },
): Promise<{
  chapterNumber: number;
  chapterKey: string;
  chapterMeta: Record<string, string>;
}>;
