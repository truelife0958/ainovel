import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { readProjectSummary } from "./discovery.js";
import { extractChapterNumber } from "../utils.js";

const execFileAsync = promisify(execFile);
const moduleDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(moduleDir, "../../.claude/scripts/extract_chapter_context.py");



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
      const pythonBin = process.platform === "win32" ? "python" : "python3";
      const result = await execFileAsync(pythonBin, [scriptPath, "--project-root", resolve(projectRoot), "--chapter", String(chapterNumber), "--format", "json"], {
        cwd: resolve(projectRoot),
        maxBuffer: 1024 * 1024 * 8,
        timeout: 30000, // 30s timeout to prevent hanging
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
