import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { readProjectSummary } from "./discovery.js";

const execFileAsync = promisify(execFile);
const moduleDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(moduleDir, "../../.claude/scripts/extract_chapter_context.py");

function extractChapterNumber(chapterFileName) {
  const base = String(chapterFileName || "").replace(/\\/g, "/").split("/").pop() || "";
  const chapterMatch = base.match(/第\s*(\d{1,5})\s*章/gu);
  if (chapterMatch && chapterMatch.length > 0) {
    const last = chapterMatch[chapterMatch.length - 1];
    const num = last.match(/(\d{1,5})/);
    if (num) return Number(num[1]);
  }
  const match = base.match(/(\d{1,5})/);
  if (!match) {
    throw new Error("Unable to infer chapter number from file name");
  }
  return Number(match[1]);
}

async function defaultFallback(projectRoot, chapterNumber, error = "") {
  const project = await readProjectSummary(projectRoot);

  return {
    chapterNumber,
    outline: "",
    previousSummaries: [],
    stateSummary: `**进度**: 第${project.currentChapter}章 / ${project.totalWords}字`,
    guidanceItems: [],
    error,
  };
}

async function readScriptOutput(projectRoot, chapterNumber, runCommand) {
  const runner =
    runCommand ||
    (async () => {
      const result = await execFileAsync("python", [scriptPath, "--project-root", resolve(projectRoot), "--chapter", String(chapterNumber), "--format", "json"], {
        cwd: resolve(projectRoot),
        maxBuffer: 1024 * 1024 * 8,
      });
      return result.stdout;
    });

  return runner();
}

export async function buildChapterContext(projectRoot, chapterFileName, dependencies = {}) {
  const chapterNumber = extractChapterNumber(chapterFileName);

  try {
    const stdout = await readScriptOutput(projectRoot, chapterNumber, dependencies.runCommand);
    const payload = JSON.parse(stdout);

    return {
      chapterNumber,
      outline: String(payload.outline || ""),
      previousSummaries: Array.isArray(payload.previous_summaries) ? payload.previous_summaries : [],
      stateSummary: String(payload.state_summary || ""),
      guidanceItems: Array.isArray(payload.writing_guidance?.guidance_items)
        ? payload.writing_guidance.guidance_items.map((item) => String(item))
        : [],
      error: "",
    };
  } catch (error) {
    return defaultFallback(
      projectRoot,
      chapterNumber,
      error instanceof Error ? error.message : "context_unavailable",
    );
  }
}
