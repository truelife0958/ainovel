export function splitPromptParts(input: {
  guardrails: string;
  project: Record<string, unknown>;
  ideation: Record<string, unknown>;
  task: string;
  currentDocument: { title: string; fileName: string; content: string };
}): { staticPrefix: string; dynamicBody: string };
