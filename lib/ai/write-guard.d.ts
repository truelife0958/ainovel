import type { ChapterBriefValidation } from "@/types/briefs";

export type ChapterWriteGuardResult = {
  requiresConfirmation: boolean;
  summary: string;
  buttonLabel: string;
};

export function evaluateChapterWriteGuard(
  validation: ChapterBriefValidation | null | undefined,
): ChapterWriteGuardResult;
