import type { ChapterBriefValidation } from "@/types/briefs";

export type ChapterRepairRequest = {
  key?: string;
  label: string;
  request: string;
};

export function buildChapterRepairRequest(
  validation: ChapterBriefValidation | null | undefined,
): ChapterRepairRequest | null;
export function buildChapterRepairActions(
  validation: ChapterBriefValidation | null | undefined,
): ChapterRepairRequest[];
export function buildChapterRepairRecommendation(
  validation: ChapterBriefValidation | null | undefined,
): {
  primaryAction: ChapterRepairRequest | null;
  secondaryActions: ChapterRepairRequest[];
  summary: string;
};
export function buildChapterRepairAdvice(
  validation: ChapterBriefValidation | null | undefined,
): string;
