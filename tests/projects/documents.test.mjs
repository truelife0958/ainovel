import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createProjectDocument,
  listProjectDocuments,
  readProjectDocument,
  updateProjectDocument,
} from "../../lib/projects/documents.js";

const createdDirs = [];

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "webnovel-docs-"));
  createdDirs.push(root);
  return root;
}

async function makeProject(root) {
  const projectRoot = join(root, "novel-docs");
  await mkdir(join(projectRoot, ".webnovel"), { recursive: true });
  await mkdir(join(projectRoot, "设定集"), { recursive: true });
  await mkdir(join(projectRoot, "大纲"), { recursive: true });
  await mkdir(join(projectRoot, "正文"), { recursive: true });
  await mkdir(join(projectRoot, "正文", "第1卷"), { recursive: true });
  await writeFile(
    join(projectRoot, ".webnovel", "state.json"),
    JSON.stringify({
      project_info: {
        title: "文档项目",
      },
      progress: {
        current_chapter: 3,
        current_volume: 1,
        total_words: 12000,
      },
    }),
    "utf8",
  );
  await writeFile(join(projectRoot, "设定集", "主角卡.md"), "# 主角卡", "utf8");
  await writeFile(join(projectRoot, "设定集", "世界观.md"), "# 世界观", "utf8");
  await writeFile(join(projectRoot, "大纲", "总纲.md"), "# 总纲", "utf8");
  await writeFile(join(projectRoot, "正文", "第0003章.md"), "# 第0003章\n\n原文", "utf8");
  await writeFile(join(projectRoot, "正文", "第1卷", "第0004章.md"), "# 第0004章\n\n卷内正文", "utf8");
  return projectRoot;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("listProjectDocuments returns markdown documents grouped by kind", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const settings = await listProjectDocuments(projectRoot, "setting");
  const outlines = await listProjectDocuments(projectRoot, "outline");
  const chapters = await listProjectDocuments(projectRoot, "chapter");

  assert.deepEqual(
    settings.map((item) => item.title),
    ["世界观", "主角卡"],
  );
  assert.equal(outlines[0].fileName, "总纲.md");
  assert.equal(chapters[0].title, "第0003章");
  assert.equal(chapters[1].fileName, "第1卷/第0004章.md");
});

test("readProjectDocument and updateProjectDocument round-trip content", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const before = await readProjectDocument(projectRoot, "chapter", "第0003章.md");
  assert.match(before.content, /原文/);

  const nested = await readProjectDocument(projectRoot, "chapter", "第1卷/第0004章.md");
  assert.match(nested.content, /卷内正文/);

  const updated = await updateProjectDocument(projectRoot, "chapter", "第0003章.md", "# 第0003章\n\n新正文");
  assert.match(updated.content, /新正文/);

  const fileContent = await readFile(join(projectRoot, "正文", "第0003章.md"), "utf8");
  assert.match(fileContent, /新正文/);
});

test("createProjectDocument creates a new markdown file and rejects traversal", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const created = await createProjectDocument(projectRoot, "outline", {
    title: "第一卷卷纲",
    content: "# 第一卷卷纲\n\n卷目标",
  });

  assert.equal(created.fileName, "第一卷卷纲.md");
  assert.match(created.content, /卷目标/);

  await assert.rejects(
    () =>
      updateProjectDocument(
        projectRoot,
        "outline",
        "../hack.md",
        "# hacked",
      ),
    /invalid document path/i,
  );
});
