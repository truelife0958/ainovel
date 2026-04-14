import type { ProjectSummary } from "@/types/project";

export type ProjectHeaderFocus = {
  title: string;
  subtitle: string;
};

export type ProjectWorkspaceRowFocus = {
  progressLabel: string;
  directoryLabel: string;
};

export function buildProjectHeaderFocus(project: ProjectSummary | null): ProjectHeaderFocus;
export function buildProjectWorkspaceRowFocus(project: ProjectSummary): ProjectWorkspaceRowFocus;
