import type { ChapterBriefValidation, ParsedChapterBrief } from "@/types/briefs";

export function parseChapterBriefContent(content: string): ParsedChapterBrief;
export function formatChapterBriefForPrompt(parsed: ParsedChapterBrief): string;
export function validateChapterBrief(parsed: ParsedChapterBrief): ChapterBriefValidation;
