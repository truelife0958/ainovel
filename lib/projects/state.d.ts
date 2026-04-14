import type { ProjectIdeation } from "@/types/ideation";

export function readProjectIdeation(projectRoot: string): Promise<ProjectIdeation>;
export function updateProjectIdeation(
  projectRoot: string,
  patch?: Partial<ProjectIdeation>,
): Promise<ProjectIdeation>;
