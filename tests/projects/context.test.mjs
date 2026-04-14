import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildChapterContext } from "../../lib/projects/context.js";

const createdDirs = [];

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "webnovel-context-"));
  createdDirs.push(root);
  return root;
}

async function makeProject(root) {
  const projectRoot = join(root, "novel-context");
  await mkdir(join(projectRoot, ".webnovel"), { recursive: true });
  await mkdir(join(projectRoot, "正文"), { recursive: true });
  await writeFile(
    join(projectRoot, ".webnovel", "state.json"),
    JSON.stringify({
      project_info: { title: "上下文项目", genre: "都市脑洞" },
      progress: { current_chapter: 5, current_volume: 1, total_words: 10000 },
    }),
    "utf8",
  );
  await writeFile(join(projectRoot, "正文", "第0005章.md"), "# 第0005章\n\n正文", "utf8");
  return projectRoot;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("buildChapterContext parses JSON payload from extract_chapter_context.py", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const context = await buildChapterContext(projectRoot, "第0005章.md", {
    runCommand: async () =>
      JSON.stringify({
        chapter: 5,
        outline: "### 第5章：账本异动",
        previous_summaries: ["### 第4章摘要\n主角发现钟表店异常"],
        state_summary: "**进度**: 第5章 / 10000字",
        writing_guidance: {
          guidance_items: ["先接上章异常", "章末必须留新钩子"],
        },
      }),
  });

  assert.equal(context.chapterNumber, 5);
  assert.match(context.outline, /账本异动/);
  assert.match(context.previousSummaries[0], /钟表店异常/);
  assert.equal(context.guidanceItems[1], "章末必须留新钩子");
});

test("buildChapterContext falls back to minimal context when script fails", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const context = await buildChapterContext(projectRoot, "第0005章.md", {
    runCommand: async () => {
      throw new Error("python failed");
    },
  });

  assert.equal(context.chapterNumber, 5);
  assert.equal(context.outline, "");
  assert.equal(context.previousSummaries.length, 0);
  assert.match(context.stateSummary, /第5章/);
});
