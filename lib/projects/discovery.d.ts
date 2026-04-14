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

export function listProjectRoots(workspaceRoot?: string): Promise<string[]>;
export function resolveCurrentProjectRoot(workspaceRoot?: string): Promise<string | null>;
export function requireProjectRoot(workspaceRoot?: string): Promise<string>;
export function readProjectSummary(projectRoot: string): Promise<ProjectSummary>;
export function getCurrentProjectSummary(workspaceRoot?: string): Promise<ProjectSummary | null>;
