import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { buildChapterRepairRecommendation } from "../ai/repair-request.js";
import { asObject, asArray } from "../utils.js";

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[、,，/|+；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildLatestChapterValidation(meta) {
  if (!meta) {
    return { missingFields: [], warnings: [] };
  }

  const missingFields = [];

  if (!String(meta.goal || "").trim()) {
    missingFields.push("目标");
  }
  if (!String(meta.obstacle || "").trim()) {
    missingFields.push("阻力");
  }
  if (!String(meta.cost || "").trim()) {
    missingFields.push("代价");
  }
  if (splitList(meta.coolpoint_patterns).length === 0) {
    missingFields.push("爽点");
  }
  if (!String(meta.strand || "").trim()) {
    missingFields.push("Strand");
  }
  if (!String(meta.antagonist_tier || "").trim()) {
    missingFields.push("反派层级");
  }
  if (!String(meta.pov || "").trim()) {
    missingFields.push("视角/主角");
  }
  if (splitList(meta.key_entities).length === 0) {
    missingFields.push("关键实体");
  }
  if (!String(meta.change || "").trim()) {
    missingFields.push("本章变化");
  }
  if (!String(meta.end_question || "").trim()) {
    missingFields.push("章末未闭合问题");
  }
  if (!String(meta.hook || "").trim()) {
    missingFields.push("钩子");
  }

  const warnings = [];
  if (String(meta.hook || "").trim() && !String(meta.hook_type || "").trim()) {
    warnings.push({
      code: "missing_hook_type",
      severity: "medium",
      message: "钩子建议使用“类型 - 内容”格式，便于后续节奏统计和承接。",
    });
  }
  if (String(meta.hook || "").trim() && !String(meta.end_question || "").trim()) {
    warnings.push({
      code: "hook_without_end_question",
      severity: "high",
      message: "已有章末钩子，但缺少“章末未闭合问题”，读者追更驱动力可能不够明确。",
    });
  }
  if (!String(meta.hook || "").trim() && String(meta.end_question || "").trim()) {
    warnings.push({
      code: "end_question_without_hook",
      severity: "high",
      message: "已有章末未闭合问题，但没有对应钩子，结尾张力可能落空。",
    });
  }

  return { missingFields, warnings };
}

async function readJsonOrDefault(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readJsonLines(path) {
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export async function readProjectReviewSummary(projectRoot) {
  const root = resolve(projectRoot);
  const state = await readJsonOrDefault(join(root, ".webnovel", "state.json"), {});
  const workflow = await readJsonOrDefault(join(root, ".webnovel", "workflow_state.json"), {});
  const callTrace = await readJsonLines(join(root, ".webnovel", "observability", "call_trace.jsonl"));
  const dataTiming = await readJsonLines(
    join(root, ".webnovel", "observability", "data_agent_timing.jsonl"),
  );

  const history = asArray(workflow.history);
  const warnings = asArray(state.disambiguation_warnings);
  const pending = asArray(state.disambiguation_pending);
  const checkpoints = asArray(state.review_checkpoints);
  const activeThreads = asArray(asObject(state.plot_threads).active_threads);
  const foreshadowing = asArray(asObject(state.plot_threads).foreshadowing);
  const lastStable = asObject(workflow.last_stable_state);
  const latestChapterMeta = Object.entries(asObject(state.chapter_meta))
    .map(([key, value]) => ({
      chapter: toPositiveNumber(key),
      meta: asObject(value),
    }))
    .filter((item) => item.chapter > 0)
    .sort((left, right) => right.chapter - left.chapter)[0];

  const recentRuns = history
    .map((item) => {
      const entry = asObject(item);
      return {
        taskId: String(entry.task_id || ""),
        command: String(entry.command || ""),
        chapter: Number(entry.chapter || 0),
        status: String(entry.status || "unknown"),
        completedAt: String(entry.completed_at || ""),
      };
    })
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, 5);

  const completedTasks = history.filter((item) => asObject(item).status === "completed").length;
  const failedTasks = history.filter((item) => asObject(item).status === "failed").length;

  const averageDataLatencyMs = dataTiming.length
    ? Math.round(
        dataTiming.reduce((sum, item) => sum + Number(asObject(item).elapsed_ms || 0), 0) /
          dataTiming.length,
      )
    : 0;

  const taskCompletedEvents = callTrace.filter((item) => asObject(item).event === "task_completed");
  const latestChapterRepair = latestChapterMeta
    ? buildChapterRepairRecommendation(buildLatestChapterValidation(latestChapterMeta.meta))
    : { primaryAction: null, secondaryActions: [], summary: "" };

  return {
    totalTasks: history.length,
    completedTasks,
    failedTasks,
    warningCount: warnings.length + pending.length,
    pendingCount: pending.length,
    reviewCheckpointCount: checkpoints.length,
    activeThreadCount: activeThreads.length,
    foreshadowCount: foreshadowing.length,
    dataEventsCount: dataTiming.length,
    averageDataLatencyMs,
    lastStable: {
      command: String(lastStable.command || ""),
      chapter: Number(lastStable.chapter_num || 0),
      completedAt: String(lastStable.completed_at || ""),
      reviewCompleted: Boolean(asObject(lastStable.artifacts).review_completed),
    },
    latestChapterMeta: latestChapterMeta
      ? {
          chapter: latestChapterMeta.chapter,
          hookType: String(latestChapterMeta.meta.hook_type || ""),
          hook: String(latestChapterMeta.meta.hook || ""),
          strand: String(latestChapterMeta.meta.strand || ""),
          coolpointPatterns: splitList(latestChapterMeta.meta.coolpoint_patterns),
          endQuestion: String(latestChapterMeta.meta.end_question || ""),
          antagonistTier: String(latestChapterMeta.meta.antagonist_tier || ""),
          pov: String(latestChapterMeta.meta.pov || ""),
          keyEntities: splitList(latestChapterMeta.meta.key_entities),
          change: String(latestChapterMeta.meta.change || ""),
          updatedAt: String(latestChapterMeta.meta.updated_at || ""),
        }
      : null,
    latestChapterRepair,
    recentRuns:
      recentRuns.length > 0
        ? recentRuns
        : taskCompletedEvents.map((item, index) => {
            const payload = asObject(asObject(item).payload);
            return {
              taskId: `trace-${index + 1}`,
              command: String(payload.command || ""),
              chapter: Number(payload.chapter || 0),
              status: Number(payload.failed_steps || 0) > 0 ? "failed" : "completed",
              completedAt: String(asObject(item).timestamp || ""),
            };
          }),
  };
}
