export type ProjectSummary = {
  id: string;
  root: string;
  title: string;
  genre: string;
  currentChapter: number;
  currentVolume: number;
  totalWords: number;
  targetWords: number;
  targetChapters: number;
  settingFilesCount: number;
  outlineFilesCount: number;
  chaptersCount: number;
};

export type ProjectWorkspace = {
  workspaceRoot: string;
  currentProjectId: string | null;
  projects: ProjectSummary[];
};
