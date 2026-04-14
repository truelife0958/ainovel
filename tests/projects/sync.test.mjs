import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { syncChapterArtifacts } from "../../lib/projects/sync.js";

const createdDirs = [];

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "webnovel-sync-"));
  createdDirs.push(root);
  return root;
}

async function makeProject(root) {
  const projectRoot = join(root, "novel-sync");
  await mkdir(join(projectRoot, ".webnovel"), { recursive: true });
  await mkdir(join(projectRoot, "正文"), { recursive: true });
  await writeFile(
    join(projectRoot, ".webnovel", "state.json"),
    JSON.stringify(
      {
        project_info: { title: "同步项目", genre: "都市脑洞" },
        progress: { current_chapter: 4, current_volume: 1, total_words: 9000 },
        chapter_meta: {},
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    join(projectRoot, "正文", "第0005章.md"),
    "# 第0005章\n\n林夜推开钟表店的门，灰雾账本开始自动翻页。\n\n店里每一只钟都在倒着走。",
    "utf8",
  );
  return projectRoot;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("syncChapterArtifacts writes chapter_meta fields from brief content", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  await syncChapterArtifacts(projectRoot, "第0005章.md", {
    briefContent: `## 第0005章章节任务书

- 本章目标：查清钟表店异常
- 主要冲突：账本主动暴走
- 承接上章：追查异响来源
- 关键阻力：规则不断变化
- 代价：暴露自身异常感知
- 章末钩子：账本自动翻页，显出父亲名字`,
  });

  const state = JSON.parse(await readFile(join(projectRoot, ".webnovel", "state.json"), "utf8"));
  assert.equal(state.chapter_meta["0005"].goal, "查清钟表店异常");
  assert.equal(state.chapter_meta["0005"].hook, "账本自动翻页，显出父亲名字");
  assert.equal(state.chapter_meta["0005"].obstacle, "规则不断变化");
  assert.equal(state.progress.current_chapter, 5);
});

test("syncChapterArtifacts enriches chapter_meta from chapter plan format", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  await syncChapterArtifacts(projectRoot, "第0005章.md", {
    briefContent: `### 第 5 章：钟表店的逆向账本
- 目标: 逼出账本背后的操盘者
- 阻力: 店内规则每十秒重写一次
- 代价: 林夜必须公开自己能看见灰雾
- 爽点: 认知反杀 - 当众拆穿假店主的规则漏洞 / 身份掉马
- Strand: Constellation
- 反派层级: 小
- 视角/主角: 林夜
- 关键实体: 灰雾账本、逆行钟、假店主
- 本章变化: 林夜首次确认父亲与灰雾账本有关
- 章末未闭合问题: 父亲为什么会在二十年前就留下名字
- 钩子: 悬念钩 - 账本翻到空白页，浮出第二个血字姓名`,
  });

  const state = JSON.parse(await readFile(join(projectRoot, ".webnovel", "state.json"), "utf8"));
  assert.equal(state.chapter_meta["0005"].goal, "逼出账本背后的操盘者");
  assert.equal(state.chapter_meta["0005"].obstacle, "店内规则每十秒重写一次");
  assert.equal(state.chapter_meta["0005"].cost, "林夜必须公开自己能看见灰雾");
  assert.equal(state.chapter_meta["0005"].hook_type, "悬念钩");
  assert.equal(state.chapter_meta["0005"].hook, "账本翻到空白页，浮出第二个血字姓名");
  assert.equal(state.chapter_meta["0005"].strand, "Constellation");
  assert.equal(state.chapter_meta["0005"].antagonist_tier, "小");
  assert.equal(state.chapter_meta["0005"].pov, "林夜");
  assert.deepEqual(state.chapter_meta["0005"].key_entities, ["灰雾账本", "逆行钟", "假店主"]);
  assert.equal(state.chapter_meta["0005"].change, "林夜首次确认父亲与灰雾账本有关");
  assert.equal(state.chapter_meta["0005"].end_question, "父亲为什么会在二十年前就留下名字");
  assert.deepEqual(state.chapter_meta["0005"].coolpoint_patterns, ["认知反杀", "身份掉马"]);
});

test("syncChapterArtifacts writes chapter summary file from chapter content", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  await syncChapterArtifacts(projectRoot, "第0005章.md", {
    briefContent: `## 第0005章章节任务书

- 本章目标：查清钟表店异常
- 章末钩子：账本自动翻页，显出父亲名字`,
    chapterContent:
      "# 第0005章\n\n林夜推开钟表店的门，灰雾账本开始自动翻页。\n\n店里每一只钟都在倒着走。\n\n最后一页浮现出父亲的名字。",
  });

  const summary = await readFile(join(projectRoot, ".webnovel", "summaries", "ch0005.md"), "utf8");
  assert.match(summary, /## 剧情摘要/);
  assert.match(summary, /灰雾账本开始自动翻页/);
  assert.match(summary, /## 章末钩子/);
  assert.match(summary, /父亲的名字/);
});
