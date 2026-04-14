import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { sanitizeInput, sanitizeContent, validateContentSize } from "@/lib/api/sanitize";
import {
  createProjectDocument,
  listProjectDocuments,
  readProjectDocument,
  updateProjectDocument,
} from "@/lib/projects/documents.js";
import { requireProjectRoot } from "@/lib/projects/discovery.js";
import { readChapterBrief } from "@/lib/projects/briefs.js";
import { syncChapterArtifacts } from "@/lib/projects/sync.js";

const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILENAME_LENGTH = 200;

function asKind(value: string | null) {
  if (value === "setting" || value === "outline" || value === "chapter") {
    return value;
  }
  throw new Error("Unsupported document kind");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kind = asKind(searchParams.get("kind"));
    const fileName = searchParams.get("file");
    const projectRoot = await requireProjectRoot();

    const data = fileName
      ? await readProjectDocument(projectRoot, kind, fileName)
      : await listProjectDocuments(projectRoot, kind);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to load documents"),
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kind = asKind(body.kind);

    const title = sanitizeInput(body.title, 200);
    const fileName = sanitizeInput(body.fileName, MAX_FILENAME_LENGTH);

    if (!title && !fileName) {
      throw new Error("Document title or file name is required");
    }

    const projectRoot = await requireProjectRoot();
    const document = await createProjectDocument(projectRoot, kind, {
      title,
      fileName,
      content: "",
    });
    if (kind === "chapter") {
      const brief = await readChapterBrief(projectRoot, document.fileName);
      await syncChapterArtifacts(projectRoot, document.fileName, {
        briefContent: brief.content,
        chapterContent: document.content,
      });
    }
    const documents = await listProjectDocuments(projectRoot, kind);

    return NextResponse.json({
      ok: true,
      data: {
        document,
        documents,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to create document"),
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const kind = asKind(body.kind);

    if (typeof body.fileName !== "string" || !body.fileName.trim()) {
      throw new Error("Document file name is required");
    }

    const rawContent = typeof body.content === "string" ? body.content : "";
    validateContentSize(rawContent, MAX_CONTENT_SIZE);
    const content = sanitizeContent(rawContent, MAX_CONTENT_SIZE);

    const projectRoot = await requireProjectRoot();
    const document = await updateProjectDocument(projectRoot, kind, body.fileName, content);
    if (kind === "chapter") {
      const brief = await readChapterBrief(projectRoot, body.fileName);
      await syncChapterArtifacts(projectRoot, body.fileName, {
        briefContent: brief.content,
        chapterContent: document.content,
      });
    }
    const documents = await listProjectDocuments(projectRoot, kind);

    return NextResponse.json({
      ok: true,
      data: {
        document,
        documents,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to save document"),
      },
      { status: 400 },
    );
  }
}
