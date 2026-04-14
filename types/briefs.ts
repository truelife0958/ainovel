export type ChapterBrief = {
  chapterNumber: number;
  title: string;
  fileName: string;
  relativePath: string;
  content: string;
  updatedAt: string;
};

export type ParsedChapterBrief = {
  title: string;
  goal: string;
  conflict: string;
  carry: string;
  obstacle: string;
  cost: string;
  coolpoint: string;
  coolpointPatterns: string[];
  strand: string;
  antagonistTier: string;
  pov: string;
  keyEntities: string[];
  change: string;
  endQuestion: string;
  hookType: string;
  hook: string;
  rawHook: string;
  rawCoolpoint: string;
};

export type ChapterBriefWarning = {
  code: string;
  severity: "high" | "medium";
  message: string;
};

export type ChapterBriefValidation = {
  missingFields: string[];
  warnings: ChapterBriefWarning[];
};
