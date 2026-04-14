import type { ChapterBrief, ChapterBriefValidation } from "@/types/briefs";
import type { ProjectDocument, ProjectDocumentMeta } from "@/types/documents";
import type { ModelRole, ProviderId } from "@/types/settings";

export type DocumentAiMode = "outline_plan" | "chapter_plan" | "chapter_write";
export type DocumentAiApplyMode = "replace" | "append";

export type ProviderInvocation = {
  provider: ProviderId;
  model: string;
  role: ModelRole;
  instructions: string;
  prompt: string;
};

export type DocumentAiResult = {
  target: "brief" | "document";
  provider: ProviderId;
  model: string;
  role: ModelRole;
  generatedText: string;
  document: ChapterBrief | ProjectDocument;
  documents: ProjectDocumentMeta[];
  briefValidation: ChapterBriefValidation | null;
};
