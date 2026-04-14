import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  readProjectIdeation,
  updateProjectIdeation,
} from "../../lib/projects/state.js";

const createdDirs = [];

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "webnovel-state-"));
  createdDirs.push(root);
  return root;
}

async function makeProject(root) {
  const projectRoot = join(root, "novel-state");
  await mkdir(join(projectRoot, ".webnovel"), { recursive: true });
  await writeFile(
    join(projectRoot, ".webnovel", "state.json"),
    JSON.stringify(
      {
        project_info: {
          title: "旧标题",
          genre: "都市",
          target_words: 400000,
          target_chapters: 100,
          golden_finger_name: "旧金手指",
          core_selling_points: "旧卖点",
          protagonist_structure: "旧结构",
          target_reader: "男频",
          platform: "通用版",
        },
        protagonist_state: {
          name: "林夜",
        },
        progress: {
          current_chapter: 6,
          current_volume: 1,
          total_words: 32000,
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

test("readProjectIdeation returns the supported ideation fields", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const ideation = await readProjectIdeation(projectRoot);

  assert.equal(ideation.title, "旧标题");
  assert.equal(ideation.genre, "都市");
  assert.equal(ideation.goldenFingerName, "旧金手指");
  assert.equal(ideation.protagonistName, "林夜");
  assert.equal(ideation.targetWords, 400000);
});

test("updateProjectIdeation persists controlled ideation fields only", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const updated = await updateProjectIdeation(projectRoot, {
    title: "新标题",
    genre: "规则怪谈",
    goldenFingerName: "灰雾账本",
    protagonistName: "顾迟",
    coreSellingPoints: "规则副本+都市升级",
    protagonistStructure: "孤狼调查者",
    targetReader: "泛男频",
    platform: "网页通用版",
    targetWords: 800000,
    targetChapters: 180,
  });

  assert.equal(updated.title, "新标题");
  assert.equal(updated.goldenFingerName, "灰雾账本");
  assert.equal(updated.protagonistName, "顾迟");
  assert.equal(updated.targetWords, 800000);

  const state = JSON.parse(await readFile(join(projectRoot, ".webnovel", "state.json"), "utf8"));
  assert.equal(state.project_info.title, "新标题");
  assert.equal(state.project_info.core_selling_points, "规则副本+都市升级");
  assert.equal(state.protagonist_state.name, "顾迟");
  assert.equal(state.progress.current_chapter, 6);
});
