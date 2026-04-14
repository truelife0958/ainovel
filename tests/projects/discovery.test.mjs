import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  getCurrentProjectSummary,
  listProjectRoots,
  readProjectSummary,
  resolveCurrentProjectRoot,
} from "../../lib/projects/discovery.js";
import { getCurrentProjectSummary as readResolvedProjectSummary, requireProjectRoot } from "../../lib/projects/discovery.js";

const createdDirs = [];

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "webnovel-app-"));
  createdDirs.push(root);
  return root;
}

async function makeProject(root, name, title = "测试书") {
  const projectRoot = join(root, name);
  await mkdir(join(projectRoot, ".webnovel"), { recursive: true });
  await mkdir(join(projectRoot, "设定集"), { recursive: true });
  await mkdir(join(projectRoot, "大纲"), { recursive: true });
  await mkdir(join(projectRoot, "正文"), { recursive: true });

  await writeFile(
    join(projectRoot, ".webnovel", "state.json"),
    JSON.stringify(
      {
        project_info: {
          title,
          genre: "都市脑洞",
          target_words: 500000,
          target_chapters: 120,
        },
        progress: {
          current_chapter: 8,
          current_volume: 1,
          total_words: 35000,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(join(projectRoot, "设定集", "世界观.md"), "# 世界观", "utf8");
  await writeFile(join(projectRoot, "大纲", "总纲.md"), "# 总纲", "utf8");
  await writeFile(join(projectRoot, "正文", "第0008章.md"), "# 第八章", "utf8");

  return projectRoot;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("prefers the workspace pointer when it targets a valid project", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace, "novel-a", "指针项目");

  await mkdir(join(workspace, ".claude"), { recursive: true });
  await writeFile(
    join(workspace, ".claude", ".webnovel-current-project"),
    projectRoot,
    "utf8",
  );

  const resolved = await resolveCurrentProjectRoot(workspace);
  assert.equal(resolved, projectRoot);
});

test("falls back to discovered project roots when no pointer exists", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace, "novel-b", "回退项目");

  const roots = await listProjectRoots(workspace);
  const resolved = await resolveCurrentProjectRoot(workspace);

  assert.ok(roots.includes(projectRoot));
  assert.equal(resolved, projectRoot);
});

test("reads a project summary from the existing project files", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace, "novel-c", "摘要项目");

  const summary = await readProjectSummary(projectRoot);

  assert.equal(summary.title, "摘要项目");
  assert.equal(summary.genre, "都市脑洞");
  assert.equal(summary.currentChapter, 8);
  assert.equal(summary.chaptersCount, 1);
  assert.equal(summary.settingFilesCount, 1);
  assert.equal(summary.outlineFilesCount, 1);
});

test("requireProjectRoot follows the current-project pointer", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace, "novel-d", "当前项目");

  await mkdir(join(workspace, ".claude"), { recursive: true });
  await writeFile(join(workspace, ".claude", ".webnovel-current-project"), projectRoot, "utf8");

  const resolved = await requireProjectRoot(workspace);
  const summary = await getCurrentProjectSummary(workspace);

  assert.equal(resolved, projectRoot);
  assert.equal(summary?.title, "当前项目");
});

test("requireProjectRoot throws when no compatible project exists", async () => {
  const workspace = await makeWorkspace();

  await assert.rejects(
    () => requireProjectRoot(workspace),
    /No compatible project found/,
  );
});

test("project summary helper accepts a workspace root by following the current-project pointer", async () => {
  const workspace = await makeWorkspace();
  await makeProject(workspace, "novel-e", "工作区摘要");

  const summary = await readResolvedProjectSummary(workspace);

  assert.equal(summary.title, "工作区摘要");
  assert.equal(summary.genre, "都市脑洞");
  assert.equal(summary.currentChapter, 8);
});
