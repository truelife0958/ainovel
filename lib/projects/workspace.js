import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import { listProjectRoots, readProjectSummary, resolveCurrentProjectRoot } from "./discovery.js";

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isProjectRoot(path) {
  return pathExists(join(path, ".webnovel", "state.json"));
}

function sanitizeSegment(value) {
  const trimmed = String(value || "").trim();
  const normalized = trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^\.+|\.+$/g, "");

  if (normalized) {
    return normalized.slice(0, 60);
  }

  return `novel-${Date.now()}`;
}

function ensureInsideWorkspace(workspaceRoot, targetRoot) {
  const relativePath = relative(workspaceRoot, targetRoot);
  if (
    !relativePath ||
    relativePath === "." ||
    relativePath.split(/[\\/]/).includes("..")
  ) {
    throw new Error("Project path is outside the workspace");
  }
  return relativePath;
}

function nowDateString() {
  return new Date().toISOString().slice(0, 10);
}

function nowDateTimeString() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function createStatePayload(input) {
  return {
    project_info: {
      title: input.title,
      genre: input.genre || "未设置",
      created_at: nowDateString(),
      target_words: input.targetWords,
      target_chapters: input.targetChapters,
      target_reader: input.targetReader || "通用网文读者",
      platform: "通用版",
    },
    progress: {
      current_chapter: input.initialChapter || 0,
      total_words: 0,
      last_updated: nowDateTimeString(),
      volumes_completed: [],
      current_volume: 1,
      volumes_planned: [],
    },
    protagonist_state: {
      name: "",
      power: {
        realm: "",
        layer: 1,
        bottleneck: "",
      },
      location: {
        current: "",
        last_chapter: 0,
      },
      golden_finger: {
        name: "",
        level: 1,
        cooldown: 0,
        skills: [],
      },
      attributes: {},
    },
    relationships: {},
    disambiguation_warnings: [],
    disambiguation_pending: [],
    world_settings: {
      power_system: [],
      factions: [],
      locations: [],
    },
    plot_threads: {
      active_threads: [],
      foreshadowing: [],
    },
    review_checkpoints: [],
    chapter_meta: {},
    strand_tracker: {
      last_quest_chapter: 0,
      last_fire_chapter: 0,
      last_constellation_chapter: 0,
      current_dominant: "quest",
      chapters_since_switch: 0,
      history: [],
    },
  };
}

async function writeStarterFiles(projectRoot, title) {
  await writeFile(join(projectRoot, ".webnovel", "index.db"), "", "utf8");
  await writeFile(
    join(projectRoot, "设定集", "作品定位.md"),
    `# 作品定位\n\n- 书名：${title}\n- 核心卖点：\n- 目标读者：\n- 爽点节奏：\n`,
    "utf8",
  );
  await writeFile(
    join(projectRoot, "大纲", "总纲.md"),
    `# 总纲\n\n## 核心矛盾\n\n## 主线推进\n\n## 爆点设计\n`,
    "utf8",
  );
  await writeFile(
    join(projectRoot, "正文", "第0001章.md"),
    "# 第0001章\n\n> 章节目标：建立主角处境，抛出首个钩子。\n",
    "utf8",
  );
}

async function readAllProjectSummaries(workspaceRoot) {
  const projectRoots = await listProjectRoots(workspaceRoot);
  const currentRoot = await resolveCurrentProjectRoot(workspaceRoot);
  const projects = await Promise.all(projectRoots.map((root) => readProjectSummary(root)));

  projects.sort((left, right) => {
    if (left.root === currentRoot) {
      return -1;
    }
    if (right.root === currentRoot) {
      return 1;
    }
    return left.title.localeCompare(right.title, "zh-Hans-CN");
  });

  return {
    workspaceRoot,
    currentProjectId: currentRoot ? basename(currentRoot) : null,
    projects,
  };
}

export async function listProjectsWithCurrent(workspaceRoot = process.cwd()) {
  const resolvedRoot = resolve(workspaceRoot);
  return readAllProjectSummaries(resolvedRoot);
}

export async function setCurrentProject(workspaceRoot = process.cwd(), projectRootOrId) {
  const resolvedWorkspace = resolve(workspaceRoot);
  const targetRoot = resolve(resolvedWorkspace, projectRootOrId);

  ensureInsideWorkspace(resolvedWorkspace, targetRoot);

  if (!(await isProjectRoot(targetRoot))) {
    throw new Error("Project root is invalid");
  }

  await mkdir(join(resolvedWorkspace, ".claude"), { recursive: true });
  await writeFile(
    join(resolvedWorkspace, ".claude", ".webnovel-current-project"),
    relative(resolvedWorkspace, targetRoot),
    "utf8",
  );

  return readProjectSummary(targetRoot);
}

export async function createProject(workspaceRoot = process.cwd(), input = {}) {
  const resolvedWorkspace = resolve(workspaceRoot);
  const title = String(input.title || "").trim();

  if (!title) {
    throw new Error("Title is required");
  }

  const targetWords = Number(input.targetWords || 0);
  const targetChapters = Number(input.targetChapters || 0);

  if (!Number.isFinite(targetWords) || targetWords < 0) {
    throw new Error("Target words must be a positive number");
  }
  if (!Number.isFinite(targetChapters) || targetChapters < 0) {
    throw new Error("Target chapters must be a positive number");
  }

  const folderName = sanitizeSegment(input.folderName || title);
  const projectRoot = join(resolvedWorkspace, folderName);

  if (await pathExists(projectRoot)) {
    throw new Error("Project directory already exists");
  }

  await mkdir(join(projectRoot, ".webnovel"), { recursive: true });
  await mkdir(join(projectRoot, "设定集"), { recursive: true });
  await mkdir(join(projectRoot, "大纲"), { recursive: true });
  await mkdir(join(projectRoot, "正文"), { recursive: true });

  await writeFile(
    join(projectRoot, ".webnovel", "state.json"),
    JSON.stringify(
      createStatePayload({
        title,
        genre: String(input.genre || "").trim(),
        targetWords,
        targetChapters,
        targetReader: String(input.targetReader || "").trim(),
        initialChapter: 1,
      }),
      null,
      2,
    ),
    "utf8",
  );

  await writeStarterFiles(projectRoot, title);
  await setCurrentProject(resolvedWorkspace, projectRoot);

  return readProjectSummary(projectRoot);
}
