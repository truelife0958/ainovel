import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { sanitizeInput, sanitizeContent, validateContentSize } from "@/lib/api/sanitize";
import { log } from "@/lib/log.js";
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
    const fileName = sanitizeInput(searchParams.get("file") ?? "", MAX_FILENAME_LENGTH) || null;
    const projectRoot = await requireProjectRoot();

    const data = fileName
      ? await readProjectDocument(projectRoot, kind, fileName)
      : await listProjectDocuments(projectRoot, kind);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    log.error("route_failed", {
      route: "GET /api/projects/current/documents",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
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
    log.error("route_failed", {
      route: "POST /api/projects/current/documents",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
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
    const safeFileName = sanitizeInput(body.fileName, MAX_FILENAME_LENGTH);
    const document = await updateProjectDocument(projectRoot, kind, safeFileName, content);
    if (kind === "chapter") {
      const brief = await readChapterBrief(projectRoot, safeFileName);
      await syncChapterArtifacts(projectRoot, safeFileName, {
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
    log.error("route_failed", {
      route: "PUT /api/projects/current/documents",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to save document"),
      },
      { status: 400 },
    );
  }
}
