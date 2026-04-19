import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { sanitizeInput, sanitizeContent, validateContentSize } from "@/lib/api/sanitize";
import { log } from "@/lib/log.js";
import { readChapterBrief, updateChapterBrief } from "@/lib/projects/briefs.js";
import { requireProjectRoot } from "@/lib/projects/discovery.js";
import { syncChapterArtifacts } from "@/lib/projects/sync.js";

const MAX_BRIEF_SIZE = 50000; // 50KB

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("file");
    if (!fileName) {
      throw new Error("Chapter file name is required");
    }

    const sanitizedFileName = sanitizeInput(fileName, 200);

    const brief = await readChapterBrief(await requireProjectRoot(), sanitizedFileName);
    return NextResponse.json({ ok: true, data: brief });
  } catch (error) {
    log.error("route_failed", {
      route: "GET /api/projects/current/briefs",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to load chapter brief"),
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.fileName !== "string" || !body.fileName.trim()) {
      throw new Error("Chapter file name is required");
    }

    const sanitizedFileName = sanitizeInput(body.fileName, 200);

    const rawContent = typeof body.content === "string" ? body.content : "";
    validateContentSize(rawContent, MAX_BRIEF_SIZE, "Brief");
    const content = sanitizeContent(rawContent, MAX_BRIEF_SIZE);

    const projectRoot = await requireProjectRoot();
    const brief = await updateChapterBrief(projectRoot, sanitizedFileName, content);
    await syncChapterArtifacts(projectRoot, sanitizedFileName, {
      briefContent: brief.content,
    });

    return NextResponse.json({ ok: true, data: brief });
  } catch (error) {
    log.error("route_failed", {
      route: "PUT /api/projects/current/briefs",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to save chapter brief"),
      },
      { status: 500 },
    );
  }
}
