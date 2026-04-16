import { mkdir, readFile, rm, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { parseChapterBriefContent } from "./brief-format.js";
import { extractChapterNumber, asObject } from "../utils.js";
import { acquireFileLock, releaseFileLock, atomicWriteJSON } from "./file-lock.js";


function chapterKey(chapterNumber) {
  return String(chapterNumber).padStart(4, "0");
}



function cleanText(value) {
  return String(value || "").replace(/\r/g, "").trim();
}

function summarizeChapterContent(content) {
  const lines = cleanText(content)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith(">"));

  const joined = lines.join(" ");
  return joined.slice(0, 180);
}

async function readState(projectRoot) {
  const root = resolve(projectRoot);
  const statePath = join(root, ".webnovel", "state.json");
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    return { root, statePath, state };
  } catch {
    return { root, statePath, state: {} };
  }
}

async function writeSummaryFile(root, chapterNumber, summaryText, hookText) {
  const summariesDir = join(root, ".webnovel", "summaries");
  await mkdir(summariesDir, { recursive: true });
  const summaryPath = join(summariesDir, `ch${chapterKey(chapterNumber)}.md`);

  const parts = ["## 剧情摘要", summaryText || "暂无摘要"];
  if (hookText) {
    parts.push("", "## 章末钩子", hookText);
  }

  await writeFile(summaryPath, `${parts.join("\n")}\n`, "utf8");
}

async function deleteSummaryFile(root, key) {
  const summaryPath = join(root, ".webnovel", "summaries", `ch${key}.md`);
  await rm(summaryPath, { force: true });
}

export async function syncChapterArtifacts(projectRoot, chapterFileName, input = {}) {
  const chapterNumber = extractChapterNumber(chapterFileName);
  const key = chapterKey(chapterNumber);

  // Serialize concurrent writes to the same project's state.json
  const lockKey = resolve(projectRoot) + ":state";
  await acquireFileLock(lockKey);

  try {
    const { root, statePath, state } = await readState(projectRoot);
    const chapterMeta = asObject(state.chapter_meta);
    const currentMeta = asObject(chapterMeta[key]);
    const parsedBrief = parseChapterBriefContent(input.briefContent);
    const now = new Date();

    const nextMeta = {
      ...currentMeta,
      goal: parsedBrief.goal || currentMeta.goal || "",
      conflict: parsedBrief.conflict || currentMeta.conflict || "",
      carry: parsedBrief.carry || currentMeta.carry || "",
      obstacle: parsedBrief.obstacle || currentMeta.obstacle || "",
      cost: parsedBrief.cost || currentMeta.cost || "",
      hook_type: parsedBrief.hookType || currentMeta.hook_type || "",
      hook: parsedBrief.hook || parsedBrief.rawHook || currentMeta.hook || "",
      strand: parsedBrief.strand || currentMeta.strand || "",
      antagonist_tier: parsedBrief.antagonistTier || currentMeta.antagonist_tier || "",
      pov: parsedBrief.pov || currentMeta.pov || "",
      key_entities:
        parsedBrief.keyEntities.length > 0
          ? parsedBrief.keyEntities
          : Array.isArray(currentMeta.key_entities)
            ? currentMeta.key_entities
            : [],
      change: parsedBrief.change || currentMeta.change || "",
      end_question: parsedBrief.endQuestion || currentMeta.end_question || "",
      coolpoint_patterns:
        parsedBrief.coolpointPatterns.length > 0
          ? parsedBrief.coolpointPatterns
          : Array.isArray(currentMeta.coolpoint_patterns)
            ? currentMeta.coolpoint_patterns
            : [],
      updated_at: now.toISOString(),
    };

    const progress = asObject(state.progress);

    // Update total words from current chapter content
    let totalWords = Number(progress.total_words || 0);
    if (typeof input.chapterContent === "string") {
      totalWords = input.chapterContent.length;
    }

    const nextState = {
      ...state,
      progress: {
        ...progress,
        current_chapter: Math.max(Number(progress.current_chapter || 0), chapterNumber),
        total_words: totalWords,
        last_updated: now.toISOString().replace("T", " ").slice(0, 19),
      },
      chapter_meta: {
        ...chapterMeta,
        [key]: nextMeta,
      },
    };

    // Atomic write to prevent partial file on crash
    await atomicWriteJSON(statePath, nextState);

    if (typeof input.chapterContent === "string") {
      const trimmed = cleanText(input.chapterContent);
      if (trimmed) {
        await writeSummaryFile(root, chapterNumber, summarizeChapterContent(trimmed), nextMeta.hook);
      } else {
        await deleteSummaryFile(root, key);
      }
    }

    return {
      chapterNumber,
      chapterKey: key,
      chapterMeta: nextMeta,
    };
  } finally {
    releaseFileLock(lockKey);
  }
}
