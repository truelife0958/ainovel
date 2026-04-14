export type ReviewRun = {
  taskId: string;
  command: string;
  chapter: number;
  status: string;
  completedAt: string;
};

export type ReviewSummary = {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  warningCount: number;
  pendingCount: number;
  reviewCheckpointCount: number;
  activeThreadCount: number;
  foreshadowCount: number;
  dataEventsCount: number;
  averageDataLatencyMs: number;
  lastStable: {
    command: string;
    chapter: number;
    completedAt: string;
    reviewCompleted: boolean;
  };
  latestChapterMeta: {
    chapter: number;
    hookType: string;
    hook: string;
    strand: string;
    coolpointPatterns: string[];
    endQuestion: string;
    antagonistTier: string;
    pov: string;
    keyEntities: string[];
    change: string;
    updatedAt: string;
  } | null;
  latestChapterRepair: {
    primaryAction: {
      key?: string;
      label: string;
      request: string;
    } | null;
    secondaryActions: Array<{
      key?: string;
      label: string;
      request: string;
    }>;
    summary: string;
  };
  recentRuns: ReviewRun[];
};
