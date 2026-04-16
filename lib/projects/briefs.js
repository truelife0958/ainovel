import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";

import { extractChapterNumber } from "../utils.js";

function briefFileName(chapterNumber) {
  return `ch${String(chapterNumber).padStart(4, "0")}.md`;
}

function defaultBriefContent(chapterNumber) {
  return `## 第${String(chapterNumber).padStart(4, "0")}章章节任务书

- 目标:
- 阻力:
- 代价:
- 爽点:
- Strand:
- 反派层级:
- 视角/主角:
- 关键实体:
- 本章变化:
- 章末未闭合问题:
- 钩子:
`;
}

async function statOrNull(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

export async function readChapterBrief(projectRoot, chapterFileName) {
  const root = resolve(projectRoot);
  const chapterNumber = extractChapterNumber(chapterFileName);
  const fileName = briefFileName(chapterNumber);
  const absolutePath = join(root, ".webnovel", "briefs", fileName);
  const fileStat = await statOrNull(absolutePath);

  if (!fileStat) {
    return {
      chapterNumber,
      title: `第${String(chapterNumber).padStart(4, "0")}章任务书`,
      fileName,
      relativePath: relative(root, absolutePath),
      content: defaultBriefContent(chapterNumber),
      updatedAt: "",
    };
  }

  return {
    chapterNumber,
    title: `第${String(chapterNumber).padStart(4, "0")}章任务书`,
    fileName,
    relativePath: relative(root, absolutePath),
    content: await readFile(absolutePath, "utf8"),
    updatedAt: fileStat.mtime.toISOString(),
  };
}

export async function updateChapterBrief(projectRoot, chapterFileName, content) {
  const root = resolve(projectRoot);
  const chapterNumber = extractChapterNumber(chapterFileName);
  const fileName = briefFileName(chapterNumber);
  const absolutePath = join(root, ".webnovel", "briefs", fileName);

  await mkdir(join(root, ".webnovel", "briefs"), { recursive: true });
  await writeFile(absolutePath, content, "utf8");

  return readChapterBrief(root, chapterFileName);
}
