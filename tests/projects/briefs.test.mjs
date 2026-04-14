import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  readChapterBrief,
  updateChapterBrief,
} from "../../lib/projects/briefs.js";

const createdDirs = [];

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "webnovel-briefs-"));
  createdDirs.push(root);
  return root;
}

async function makeProject(root) {
  const projectRoot = join(root, "novel-briefs");
  await mkdir(join(projectRoot, ".webnovel"), { recursive: true });
  await mkdir(join(projectRoot, "正文"), { recursive: true });
  await writeFile(
    join(projectRoot, ".webnovel", "state.json"),
    JSON.stringify({
      project_info: { title: "任务书项目" },
      progress: { current_chapter: 5, current_volume: 1, total_words: 10000 },
    }),
    "utf8",
  );
  await writeFile(join(projectRoot, "正文", "第0005章.md"), "# 第0005章\n\n原正文", "utf8");
  return projectRoot;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("readChapterBrief returns a default brief document when no file exists", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const brief = await readChapterBrief(projectRoot, "第0005章.md");

  assert.equal(brief.chapterNumber, 5);
  assert.equal(brief.fileName, "ch0005.md");
  assert.match(brief.content, /章节任务书/);
  assert.match(brief.content, /- 目标:/);
  assert.match(brief.content, /- Strand:/);
  assert.match(brief.content, /- 章末未闭合问题:/);
  assert.match(brief.content, /- 钩子:/);
});

test("updateChapterBrief persists the brief under .webnovel/briefs", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const brief = await updateChapterBrief(projectRoot, "第0005章.md", "## 章节任务书\n\n- 目标：拿到账本");

  assert.equal(brief.chapterNumber, 5);
  assert.match(brief.content, /拿到账本/);

  const stored = await readFile(join(projectRoot, ".webnovel", "briefs", "ch0005.md"), "utf8");
  assert.match(stored, /拿到账本/);
});
