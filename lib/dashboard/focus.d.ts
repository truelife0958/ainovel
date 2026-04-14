import type { ProjectSummary } from "@/types/project";

export type DashboardFocusItem = {
  label: string;
  value: string;
};

export type DashboardFocus = {
  snapshot: DashboardFocusItem[];
  nextSteps: string[];
  gaps: string[];
};

export function buildDashboardFocus(project: ProjectSummary | null): DashboardFocus;
