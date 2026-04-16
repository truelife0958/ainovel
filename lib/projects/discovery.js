import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { asObject } from "../utils.js";

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isProjectRoot(path) {
  return pathExists(join(path, ".webnovel", "state.json"));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function countMarkdownFiles(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    const counts = await Promise.all(
      entries.map(async (entry) => {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          return 1;
        }
        if (entry.isDirectory()) {
          return countMarkdownFiles(join(path, entry.name));
        }
        return 0;
      }),
    );
    return counts.reduce((sum, count) => sum + count, 0);
  } catch {
    return 0;
  }
}

export async function listProjectRoots(workspaceRoot = process.cwd()) {
  const resolvedRoot = resolve(workspaceRoot);
  const candidates = [resolvedRoot];

  try {
    const entries = await readdir(resolvedRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name.startsWith(".")) {
        continue;
      }
      candidates.push(join(resolvedRoot, entry.name));
    }
  } catch {
    return [];
  }

  const validRoots = [];
  for (const candidate of candidates) {
    if (await isProjectRoot(candidate)) {
      validRoots.push(candidate);
    }
  }

  return validRoots;
}

export async function resolveCurrentProjectRoot(workspaceRoot = process.cwd()) {
  const resolvedRoot = resolve(workspaceRoot);
  const pointerPath = join(resolvedRoot, ".claude", ".webnovel-current-project");

  if (await pathExists(pointerPath)) {
    const rawTarget = (await readFile(pointerPath, "utf8")).trim();
    if (rawTarget) {
      const target = resolve(resolvedRoot, rawTarget);
      if (await isProjectRoot(target)) {
        return target;
      }
    }
  }

  const [fallback] = await listProjectRoots(resolvedRoot);
  if (fallback) {
    return fallback;
  }

  return null;
}

export async function readProjectSummary(projectRoot) {
  const resolvedRoot = resolve(projectRoot);
  const state = await readJson(join(resolvedRoot, ".webnovel", "state.json"));
  const projectInfo = asObject(state.project_info);
  const progress = asObject(state.progress);

  const [settingFilesCount, outlineFilesCount, chaptersCount] = await Promise.all([
    countMarkdownFiles(join(resolvedRoot, "设定集")),
    countMarkdownFiles(join(resolvedRoot, "大纲")),
    countMarkdownFiles(join(resolvedRoot, "正文")),
  ]);

  return {
    id: basename(resolvedRoot),
    root: resolvedRoot,
    title: projectInfo.title || basename(resolvedRoot),
    genre: projectInfo.genre || "未设置",
    currentChapter: Number(progress.current_chapter || 0),
    currentVolume: Number(progress.current_volume || 1),
    totalWords: Number(progress.total_words || 0),
    targetWords: Number(projectInfo.target_words || 0),
    targetChapters: Number(projectInfo.target_chapters || 0),
    settingFilesCount,
    outlineFilesCount,
    chaptersCount,
  };
}

export async function requireProjectRoot(workspaceRoot = process.cwd()) {
  const root = await resolveCurrentProjectRoot(workspaceRoot);
  if (root) return root;
  throw new Error("No compatible project found. Create a project or switch to an existing project first.");
}

export async function getCurrentProjectSummary(workspaceRoot = process.cwd()) {
  const projectRoot = await resolveCurrentProjectRoot(workspaceRoot);
  if (!projectRoot) {
    return null;
  }
  return readProjectSummary(projectRoot);
}
