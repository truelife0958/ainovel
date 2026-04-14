import type { ProjectSummary } from "@/types/project";

export type DashboardMetric = {
  label: string;
  value: string;
  hint: string;
};

export function buildDashboardMetrics(project: ProjectSummary | null): DashboardMetric[];
