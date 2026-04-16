import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { asObject } from "../utils.js";
import { acquireFileLock, releaseFileLock, atomicWriteJSON } from "./file-lock.js";

async function readState(projectRoot) {
  const statePath = join(resolve(projectRoot), ".webnovel", "state.json");
  const raw = await readFile(statePath, "utf8");
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    throw new Error("state.json is corrupted — please restore from backup or re-initialize the project");
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("state.json has invalid structure");
  }
  return { statePath, state };
}

function toNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

export async function readProjectIdeation(projectRoot) {
  const { state } = await readState(projectRoot);
  const projectInfo = asObject(state.project_info);
  const protagonistState = asObject(state.protagonist_state);

  return {
    title: String(projectInfo.title || ""),
    genre: String(projectInfo.genre || ""),
    targetWords: toNumber(projectInfo.target_words),
    targetChapters: toNumber(projectInfo.target_chapters),
    targetReader: String(projectInfo.target_reader || ""),
    platform: String(projectInfo.platform || ""),
    goldenFingerName: String(projectInfo.golden_finger_name || ""),
    goldenFingerType: String(projectInfo.golden_finger_type || ""),
    goldenFingerStyle: String(projectInfo.golden_finger_style || ""),
    coreSellingPoints: String(projectInfo.core_selling_points || ""),
    protagonistStructure: String(projectInfo.protagonist_structure || ""),
    protagonistName: String(protagonistState.name || ""),
  };
}

export async function updateProjectIdeation(projectRoot, patch = {}) {
  const lockKey = resolve(projectRoot) + ":state";
  await acquireFileLock(lockKey);
  try {
    const { statePath, state } = await readState(projectRoot);
    const projectInfo = asObject(state.project_info);
    const protagonistState = asObject(state.protagonist_state);

    const nextState = {
      ...state,
      project_info: {
        ...projectInfo,
        title: String(patch.title ?? projectInfo.title ?? "").trim(),
        genre: String(patch.genre ?? projectInfo.genre ?? "").trim(),
        target_words: toNumber(patch.targetWords ?? projectInfo.target_words),
        target_chapters: toNumber(patch.targetChapters ?? projectInfo.target_chapters),
        target_reader: String(patch.targetReader ?? projectInfo.target_reader ?? "").trim(),
        platform: String(patch.platform ?? projectInfo.platform ?? "").trim(),
        golden_finger_name: String(
          patch.goldenFingerName ?? projectInfo.golden_finger_name ?? "",
        ).trim(),
        golden_finger_type: String(
          patch.goldenFingerType ?? projectInfo.golden_finger_type ?? "",
        ).trim(),
        golden_finger_style: String(
          patch.goldenFingerStyle ?? projectInfo.golden_finger_style ?? "",
        ).trim(),
        core_selling_points: String(
          patch.coreSellingPoints ?? projectInfo.core_selling_points ?? "",
        ).trim(),
        protagonist_structure: String(
          patch.protagonistStructure ?? projectInfo.protagonist_structure ?? "",
        ).trim(),
      },
      protagonist_state: {
        ...protagonistState,
        name: String(patch.protagonistName ?? protagonistState.name ?? "").trim(),
      },
    };

    await atomicWriteJSON(statePath, nextState);

    return readProjectIdeation(projectRoot);
  } finally {
    releaseFileLock(lockKey);
  }
}
