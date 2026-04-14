import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

const kindDirectoryMap = {
  setting: "设定集",
  outline: "大纲",
  chapter: "正文",
};

function getDirectoryForKind(kind) {
  const directory = kindDirectoryMap[kind];
  if (!directory) {
    throw new Error("Unsupported document kind");
  }
  return directory;
}

function toTitle(fileName) {
  return basename(fileName, extname(fileName));
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function previewFromContent(content) {
  return collapseWhitespace(content).slice(0, 120);
}

function isMarkdownFile(entry) {
  return entry.isFile() && entry.name.toLowerCase().endsWith(".md");
}

function sanitizeStem(value) {
  const trimmed = String(value || "").trim();
  const normalized = trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "");

  if (!normalized) {
    throw new Error("Document title is required");
  }

  return normalized.slice(0, 80);
}

function normalizeChapterStem(value) {
  const trimmed = sanitizeStem(value);
  const match = trimmed.match(/^第?\s*(\d+)\s*章?$/);

  if (match) {
    const num = parseInt(match[1], 10);
    // 拒绝负数和过大的章节号
    if (num < 0 || num > 99999) {
      throw new Error("章节号必须在 0-99999 之间");
    }
    return `第${String(num).padStart(4, "0")}章`;
  }

  return trimmed;
}

function normalizeFileName(kind, value) {
  const stem = kind === "chapter" ? normalizeChapterStem(value) : sanitizeStem(value);
  return stem.toLowerCase().endsWith(".md") ? stem : `${stem}.md`;
}

function extractChapterNumber(fileName) {
  const match = basename(String(fileName || "")).match(/(\d{1,5})/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function ensureSafeFileName(fileName) {
  const normalized = String(fileName || "").trim();
  if (!normalized) {
    throw new Error("Invalid document path");
  }
  // Reject absolute paths and Windows drive letters
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
    throw new Error("Invalid document path");
  }
  const segments = normalized
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0 || segments.includes("..")) {
    throw new Error("Invalid document path");
  }
  // Reject segments with invalid characters
  for (const segment of segments) {
    if (/[<>:"|?*\u0000-\u001f]/.test(segment)) {
      throw new Error("Invalid document path");
    }
  }
  if (!normalized.toLowerCase().endsWith(".md")) {
    throw new Error("Invalid document path");
  }
  return segments.join("/");
}

async function listMarkdownFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return listMarkdownFiles(absolutePath, relativePath);
      }
      if (isMarkdownFile(entry)) {
        return [relativePath];
      }
      return [];
    }),
  );
  return results.flat();
}

async function readDocumentMeta(projectRoot, kind, fileName) {
  const directory = getDirectoryForKind(kind);
  const absolutePath = join(projectRoot, directory, fileName);
  const [content, fileStat] = await Promise.all([
    readFile(absolutePath, "utf8"),
    stat(absolutePath),
  ]);

  return {
    kind,
    directory,
    fileName,
    title: toTitle(fileName),
    relativePath: relative(projectRoot, absolutePath),
    updatedAt: fileStat.mtime.toISOString(),
    preview: previewFromContent(content),
    content,
  };
}

function sortDocuments(kind, documents) {
  return documents.sort((left, right) => {
    if (kind === "chapter") {
      const chapterOrder = extractChapterNumber(left.fileName) - extractChapterNumber(right.fileName);
      if (chapterOrder !== 0) {
        return chapterOrder;
      }
      return left.fileName.localeCompare(right.fileName, "zh-Hans-CN", { numeric: true });
    }
    return left.fileName.localeCompare(right.fileName, "zh-Hans-CN");
  });
}

export async function listProjectDocuments(projectRoot, kind) {
  const resolvedRoot = resolve(projectRoot);
  const directory = getDirectoryForKind(kind);
  const targetDirectory = join(resolvedRoot, directory);

  let entries = [];
  try {
    entries = await listMarkdownFiles(targetDirectory);
  } catch {
    return [];
  }

  const docs = await Promise.all(
    entries.map(async (entry) => {
      const document = await readDocumentMeta(resolvedRoot, kind, entry);
      const { content, ...meta } = document;
      return meta;
    }),
  );

  return sortDocuments(kind, docs);
}

export async function readProjectDocument(projectRoot, kind, fileName) {
  const resolvedRoot = resolve(projectRoot);
  const safeFileName = ensureSafeFileName(fileName);
  return readDocumentMeta(resolvedRoot, kind, safeFileName);
}

export async function updateProjectDocument(projectRoot, kind, fileName, content) {
  const resolvedRoot = resolve(projectRoot);
  const directory = getDirectoryForKind(kind);
  const safeFileName = ensureSafeFileName(fileName);
  const nextContent = typeof content === "string" ? content : "";

  await mkdir(join(resolvedRoot, directory), { recursive: true });
  await writeFile(join(resolvedRoot, directory, safeFileName), nextContent, "utf8");

  return readDocumentMeta(resolvedRoot, kind, safeFileName);
}

export async function createProjectDocument(projectRoot, kind, input = {}) {
  const resolvedRoot = resolve(projectRoot);
  const fileName = normalizeFileName(kind, input.fileName || input.title);
  const content =
    typeof input.content === "string" && input.content.trim()
      ? input.content
      : `# ${toTitle(fileName)}\n\n`;

  return updateProjectDocument(resolvedRoot, kind, fileName, content);
}
