/**
 * Split a full prompt into a cacheable static prefix and a per-call
 * dynamic body. The prefix contains everything that does not change
 * between adjacent calls for the same project: guardrails, project
 * summary, ideation. Dynamic body contains the task description and
 * the current chapter/outline document content.
 *
 * This helper is currently used by tests and future prompt-builder
 * migrations; Anthropic prompt caching in lib/ai/providers.js already
 * benefits any consumer whose `instructions` string is stable.
 *
 * @param {object} input
 * @param {string} input.guardrails
 * @param {Record<string, unknown>} input.project
 * @param {Record<string, unknown>} input.ideation
 * @param {string} input.task
 * @param {{ title: string, fileName: string, content: string }} input.currentDocument
 * @returns {{ staticPrefix: string, dynamicBody: string }}
 */
export function splitPromptParts(input) {
  const p = input.project || {};
  const projectSummary = [
    `Title: ${p.title ?? ""}`,
    `Genre: ${p.genre ?? ""}`,
    `Current Chapter: ${p.currentChapter ?? 0}`,
    `Current Volume: ${p.currentVolume ?? 0}`,
    `Total Words: ${p.totalWords ?? 0}`,
    `Target Words: ${p.targetWords ?? 0}`,
    `Target Chapters: ${p.targetChapters ?? 0}`,
    `Setting Files: ${p.settingFilesCount ?? 0}`,
    `Outline Files: ${p.outlineFilesCount ?? 0}`,
    `Chapter Files: ${p.chaptersCount ?? 0}`,
  ].join("\n");

  const ideation = input.ideation || {};
  const ideationSummary = Object.keys(ideation)
    .sort()
    .map((k) => `${k}: ${ideation[k] ?? ""}`)
    .join("\n");

  const staticPrefix = [
    "# Originality Guardrails",
    input.guardrails,
    "",
    "# Project Summary",
    projectSummary,
    "",
    "# Ideation",
    ideationSummary,
  ].join("\n");

  const dynamicBody = [
    "# Task",
    input.task,
    "",
    "# Current Document",
    `Title: ${input.currentDocument.title}`,
    `File: ${input.currentDocument.fileName}`,
    "",
    input.currentDocument.content,
  ].join("\n");

  return { staticPrefix, dynamicBody };
}
