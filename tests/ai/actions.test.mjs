import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runDocumentAiAction } from "../../lib/ai/actions.js";
import { readChapterBrief } from "../../lib/projects/briefs.js";
import { updateProviderConfig } from "../../lib/settings/provider-config.js";

const createdDirs = [];

async function makeTempDir(prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  createdDirs.push(root);
  return root;
}

async function makeProject(root) {
  const projectRoot = join(root, "webnovel-project");
  await mkdir(join(projectRoot, ".webnovel"), { recursive: true });
  await mkdir(join(projectRoot, "大纲"), { recursive: true });
  await mkdir(join(projectRoot, "正文"), { recursive: true });
  await writeFile(
    join(projectRoot, ".webnovel", "state.json"),
    JSON.stringify(
      {
        project_info: {
          title: "灰雾长夜",
          genre: "都市脑洞",
          target_reader: "男频读者",
          core_selling_points: "规则副本+都市升级",
          golden_finger_name: "灰雾账本",
        },
        protagonist_state: {
          name: "林夜",
        },
        progress: {
          current_chapter: 5,
          current_volume: 1,
          total_words: 20000,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(join(projectRoot, "大纲", "总纲.md"), "# 总纲\n\n原大纲", "utf8");
  await writeFile(join(projectRoot, "正文", "第0005章.md"), "# 第0005章\n\n原正文", "utf8");
  // Return the actual project root (NOT the workspace root) because
  // runDocumentAiAction expects the resolved project root — the same
  // value that requireProjectRoot() returns in API routes.
  return projectRoot;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("runDocumentAiAction routes outline planning to outlining role and replaces content", async () => {
  const workspace = await makeTempDir("webnovel-ai-project-");
  const configRoot = await makeTempDir("webnovel-ai-config-");
  const projectRoot = await makeProject(workspace);

  await updateProviderConfig(configRoot, {
    activeProvider: "openai",
    providers: {
      openai: {
        apiKey: "sk-test-openai",
        model: "gpt-5-mini",
      },
    },
    roleModels: {
      outlining: "gpt-5",
    },
  });

  const calls = [];
  const result = await runDocumentAiAction(
    {
      projectRoot,
      configRoot,
      kind: "outline",
      fileName: "总纲.md",
      mode: "outline_plan",
      userRequest: "强化第一卷冲突链",
      applyMode: "replace",
    },
    {
      invokeModel: async (payload) => {
        calls.push(payload);
        return "## AI 规划结果\n\n新的卷纲结构";
      },
    },
  );

  assert.equal(calls[0].role, "outlining");
  assert.equal(calls[0].model, "gpt-5");
  assert.match(calls[0].prompt, /强化第一卷冲突链/);
  assert.match(result.document.content, /新的卷纲结构/);
  assert.equal(result.briefValidation, null);
});

test("runDocumentAiAction appends generated text for chapter writing", async () => {
  const workspace = await makeTempDir("webnovel-ai-project-");
  const configRoot = await makeTempDir("webnovel-ai-config-");
  const projectRoot = await makeProject(workspace);

  await updateProviderConfig(configRoot, {
    activeProvider: "anthropic",
    providers: {
      anthropic: {
        apiKey: "sk-ant-test",
        model: "claude-sonnet-4-5",
      },
    },
    roleModels: {
      writing: "claude-sonnet-4-5",
    },
  });

  const result = await runDocumentAiAction(
    {
      projectRoot,
      configRoot,
      kind: "chapter",
      fileName: "第0005章.md",
      mode: "chapter_write",
      userRequest: "补强章末钩子",
      applyMode: "append",
    },
    {
      invokeModel: async (payload) => {
        assert.match(payload.prompt, /Chapter Brief/);
        assert.match(payload.prompt, /目标：/);
        assert.match(payload.prompt, /Strand：/);
        assert.match(payload.prompt, /钩子类型：/);
        assert.match(payload.prompt, /章末未闭合问题：/);
        return "\n\n新的正文续写";
      },
    },
  );

  assert.match(result.document.content, /原正文/);
  assert.match(result.document.content, /新的正文续写/);
  assert.deepEqual(result.briefValidation?.missingFields, [
    "目标",
    "阻力",
    "代价",
    "爽点",
    "Strand",
    "反派层级",
    "视角/主角",
    "关键实体",
    "本章变化",
    "章末未闭合问题",
    "钩子",
  ]);
});

test("runDocumentAiAction writes chapter planning output into dedicated brief storage", async () => {
  const workspace = await makeTempDir("webnovel-ai-project-");
  const configRoot = await makeTempDir("webnovel-ai-config-");
  const projectRoot = await makeProject(workspace);

  await updateProviderConfig(configRoot, {
    activeProvider: "openai",
    providers: {
      openai: {
        apiKey: "sk-test-openai",
        model: "gpt-5-mini",
      },
    },
    roleModels: {
      outlining: "gpt-5-mini",
    },
  });

  const result = await runDocumentAiAction(
    {
      projectRoot,
      configRoot,
      kind: "chapter",
      fileName: "第0005章.md",
      mode: "chapter_plan",
      userRequest: "先拆出本章目标和章末钩子",
      applyMode: "replace",
    },
    {
      invokeModel: async (payload) => {
        assert.match(payload.prompt, /上一章摘要/);
        assert.match(payload.prompt, /章末必须留新钩子/);
        assert.match(payload.instructions, /chapter-planning assistant/);
        assert.match(payload.prompt, /目标.*阻力.*代价.*爽点.*Strand.*反派层级.*视角\/主角.*关键实体.*本章变化.*章末未闭合问题.*钩子/s);
        return "## 章节任务书\n\n- 目标: 查清钟表店异常\n- Strand: Quest\n- 钩子: 悬念钩 - 账本自动翻页";
      },
      buildContext: async () => ({
        chapterNumber: 5,
        outline: "### 第5章：钟表店异动",
        previousSummaries: ["### 上一章摘要\n主角发现钟表店异常"],
        stateSummary: "**进度**: 第5章 / 20000字",
        guidanceItems: ["先接异常", "章末必须留新钩子"],
        error: "",
      }),
    },
  );

  assert.equal(result.target, "brief");
  assert.match(result.document.content, /章节任务书/);
  assert.match(result.document.content, /Strand: Quest/);
  assert.deepEqual(result.briefValidation?.missingFields, [
    "阻力",
    "代价",
    "爽点",
    "反派层级",
    "视角/主角",
    "关键实体",
    "本章变化",
    "章末未闭合问题",
  ]);
  assert.equal(result.briefValidation?.warnings.length, 1);
  assert.equal(result.briefValidation?.warnings[0]?.code, "hook_without_end_question");

  const brief = await readChapterBrief(projectRoot, "第0005章.md");
  assert.match(brief.content, /账本自动翻页/);
});

test("runDocumentAiAction fails clearly when active provider key is missing", async () => {
  const workspace = await makeTempDir("webnovel-ai-project-");
  const configRoot = await makeTempDir("webnovel-ai-config-");
  const projectRoot = await makeProject(workspace);

  await assert.rejects(
    () =>
      runDocumentAiAction({
        projectRoot,
        configRoot,
        kind: "chapter",
        fileName: "第0005章.md",
        mode: "chapter_plan",
        userRequest: "先规划本章",
        applyMode: "replace",
      }),
    /api key/i,
  );
});
