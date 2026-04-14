import type { ProjectSummary, ProjectWorkspace } from "@/types/project";

export type CreateProjectInput = {
  title: string;
  folderName?: string;
  genre?: string;
  targetWords?: number;
  targetChapters?: number;
  targetReader?: string;
};

export function listProjectsWithCurrent(workspaceRoot?: string): Promise<ProjectWorkspace>;
export function setCurrentProject(
  workspaceRoot: string | undefined,
  projectRootOrId: string,
): Promise<ProjectSummary>;
export function createProject(
  workspaceRoot: string | undefined,
  input: CreateProjectInput,
): Promise<ProjectSummary>;
