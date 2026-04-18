import type { DocumentAiApplyMode, DocumentAiMode, DocumentAiResult, ProviderInvocation } from "@/types/ai";
import type { ProjectDocumentKind } from "@/types/documents";

export function applyResult(
  originalContent: string | null | undefined,
  generatedText: string | null | undefined,
  applyMode: DocumentAiApplyMode,
): { content: string; downgraded: boolean };

export function runDocumentAiAction(
  input: {
    projectRoot: string;
    configRoot?: string;
    kind: ProjectDocumentKind;
    fileName: string;
    mode: DocumentAiMode;
    userRequest?: string;
    applyMode: DocumentAiApplyMode;
    signal?: AbortSignal;
  },
  dependencies?: {
    invokeModel?: (
      payload: ProviderInvocation,
    ) => Promise<string | { text: string; usage: unknown; latencyMs: number }>;
    buildContext?: (
      projectRoot: string,
      fileName: string,
    ) => Promise<{
      chapterNumber: number;
      outline: string;
      previousSummaries: string[];
      stateSummary: string;
      guidanceItems: string[];
      error?: string;
    }>;
    syncChapterArtifacts?: (
      projectRoot: string,
      fileName: string,
      input: {
        briefContent: string;
        chapterContent?: string;
      },
    ) => Promise<unknown>;
  },
): Promise<DocumentAiResult>;
