import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createProject,
  listProjectsWithCurrent,
  setCurrentProject,
} from "../../lib/projects/workspace.js";

const createdDirs = [];

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "webnovel-workspace-"));
  createdDirs.push(root);
  return root;
}

async function makeProject(root, name, title = "现有项目") {
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
          genre: "玄幻升级",
          target_words: 1000000,
          target_chapters: 300,
        },
        progress: {
          current_chapter: 12,
          current_volume: 2,
          total_words: 84000,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  return projectRoot;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("createProject creates a compatible project skeleton and selects it", async () => {
  const workspace = await makeWorkspace();

  const created = await createProject(workspace, {
    title: "新书计划",
    genre: "都市异能",
    targetWords: 600000,
    targetChapters: 180,
  });

  assert.equal(created.title, "新书计划");
  assert.equal(created.genre, "都市异能");
  assert.equal(created.currentChapter, 1);

  await stat(join(created.root, ".webnovel", "state.json"));
  await stat(join(created.root, ".webnovel", "index.db"));
  await stat(join(created.root, "设定集"));
  await stat(join(created.root, "大纲"));
  await stat(join(created.root, "正文"));

  const pointer = await readFile(join(workspace, ".claude", ".webnovel-current-project"), "utf8");
  assert.equal(pointer.trim(), created.id);

  await access(join(created.root, "设定集", "作品定位.md"));
  await access(join(created.root, "大纲", "总纲.md"));
  await access(join(created.root, "正文", "第0001章.md"));
});

test("listProjectsWithCurrent returns discovered projects and current project metadata", async () => {
  const workspace = await makeWorkspace();
  const projectA = await makeProject(workspace, "novel-a", "项目 A");
  const projectB = await makeProject(workspace, "novel-b", "项目 B");

  await setCurrentProject(workspace, projectB);

  const result = await listProjectsWithCurrent(workspace);

  assert.equal(result.currentProjectId, "novel-b");
  assert.equal(result.projects.length, 2);
  assert.equal(result.projects[0].id, "novel-b");
  assert.equal(result.projects[1].id, "novel-a");
});

test("setCurrentProject rejects paths outside the workspace", async () => {
  const workspace = await makeWorkspace();
  const externalRoot = await makeWorkspace();
  const externalProject = await makeProject(externalRoot, "outside-project", "外部项目");

  await assert.rejects(
    () => setCurrentProject(workspace, externalProject),
    /outside the workspace/i,
  );
});
