import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readProjectReviewSummary } from "../../lib/projects/review.js";

const createdDirs = [];

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "webnovel-review-"));
  createdDirs.push(root);
  return root;
}

async function makeProject(root) {
  const projectRoot = join(root, "novel-review");
  await mkdir(join(projectRoot, ".webnovel", "observability"), { recursive: true });
  await writeFile(
    join(projectRoot, ".webnovel", "state.json"),
    JSON.stringify(
      {
        project_info: {
          title: "审查项目",
        },
        chapter_meta: {
          "0002": {
            hook: "他发现钟表店老板认识父亲",
            hook_type: "悬念钩",
            strand: "Quest",
            coolpoint_patterns: ["试探博弈"],
            end_question: "老板为何隐瞒父亲行踪",
          },
          "0003": {
            hook: "账本空白页出现第二个名字",
            hook_type: "悬念钩",
            strand: "Constellation",
            coolpoint_patterns: ["认知反杀", "身份掉马"],
            end_question: "第二个名字为何提前出现",
            antagonist_tier: "小",
            pov: "陈默",
            key_entities: ["灰雾账本", "钟表店"],
            change: "陈默确认父亲与账本存在直接联系",
            updated_at: "2026-03-23T18:03:40.000000",
          },
        },
        disambiguation_warnings: [{ entity: "陈默" }],
        disambiguation_pending: [{ entity: "灰雾账本" }, { entity: "静海市" }],
        review_checkpoints: [{ chapter: 2, score: 7.5 }, { chapter: 3, score: 8.2 }],
        plot_threads: {
          active_threads: [{ name: "父亲失踪" }, { name: "灰雾账本来源" }],
          foreshadowing: [{ clue: "钟表店" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".webnovel", "workflow_state.json"),
    JSON.stringify(
      {
        last_stable_state: {
          command: "webnovel-write",
          chapter_num: 3,
          completed_at: "2026-03-23T18:03:33.238597",
          artifacts: {
            review_completed: true,
          },
        },
        history: [
          { task_id: "1", command: "webnovel-write", chapter: 1, status: "completed" },
          { task_id: "2", command: "webnovel-write", chapter: 2, status: "failed" },
          { task_id: "3", command: "webnovel-review", chapter: 3, status: "completed" },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".webnovel", "observability", "call_trace.jsonl"),
    [
      JSON.stringify({
        timestamp: "2026-03-23T18:02:50.776519",
        event: "task_completed",
        payload: { command: "webnovel-write", chapter: 1, completed_steps: 1, failed_steps: 0 },
      }),
      JSON.stringify({
        timestamp: "2026-03-23T18:03:33.273687",
        event: "task_completed",
        payload: { command: "webnovel-write", chapter: 2, completed_steps: 0, failed_steps: 1 },
      }),
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".webnovel", "observability", "data_agent_timing.jsonl"),
    [
      JSON.stringify({ timestamp: "2026-03-23T18:02:25.862062", tool_name: "index_manager:stats", success: true, elapsed_ms: 699 }),
      JSON.stringify({ timestamp: "2026-03-23T18:03:25.862062", tool_name: "entity_manager:upsert", success: true, elapsed_ms: 120 }),
    ].join("\n"),
    "utf8",
  );

  return projectRoot;
}

test.after(async () => {
  await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

test("readProjectReviewSummary aggregates workflow, warning and observability data", async () => {
  const workspace = await makeWorkspace();
  const projectRoot = await makeProject(workspace);

  const summary = await readProjectReviewSummary(projectRoot);

  assert.equal(summary.totalTasks, 3);
  assert.equal(summary.completedTasks, 2);
  assert.equal(summary.failedTasks, 1);
  assert.equal(summary.warningCount, 3);
  assert.equal(summary.reviewCheckpointCount, 2);
  assert.equal(summary.activeThreadCount, 2);
  assert.equal(summary.foreshadowCount, 1);
  assert.equal(summary.dataEventsCount, 2);
  assert.equal(summary.lastStable.command, "webnovel-write");
  assert.equal(summary.recentRuns[0].status, "completed");
  assert.equal(summary.latestChapterMeta?.chapter, 3);
  assert.equal(summary.latestChapterMeta?.hookType, "悬念钩");
  assert.equal(summary.latestChapterMeta?.hook, "账本空白页出现第二个名字");
  assert.equal(summary.latestChapterMeta?.strand, "Constellation");
  assert.deepEqual(summary.latestChapterMeta?.coolpointPatterns, ["认知反杀", "身份掉马"]);
  assert.equal(summary.latestChapterMeta?.endQuestion, "第二个名字为何提前出现");
  assert.equal(summary.latestChapterRepair?.primaryAction?.key, "core");
  assert.equal(summary.latestChapterRepair?.primaryAction?.label, "补目标冲突代价");
  assert.match(summary.latestChapterRepair?.summary || "", /优先处理|建议优先处理/);
});
