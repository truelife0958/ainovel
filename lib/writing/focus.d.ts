import type { ChapterContext } from "@/types/context";

export type WritingAssistantFocus = {
  notes: string[];
  fallback: string;
};

export type WritingContextFocus = {
  outlineText: string;
  previousSummaryText: string;
  stateSummaryText: string;
  guidanceItems: string[];
};

export function buildWritingAssistantFocus(input: {
  recommendationSummary: string;
  assistantMessage: string;
  statusMessage: string;
  projectTitle: string;
  documentCount: number;
}): WritingAssistantFocus;

export function buildWritingContextFocus(context: ChapterContext | null): WritingContextFocus;
