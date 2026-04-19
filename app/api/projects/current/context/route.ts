import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { sanitizeInput } from "@/lib/api/sanitize";
import { log } from "@/lib/log.js";
import { buildChapterContext } from "@/lib/projects/context.js";
import { requireProjectRoot } from "@/lib/projects/discovery.js";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawFileName = searchParams.get("file");
    if (!rawFileName) {
      throw new Error("Chapter file name is required");
    }

    const fileName = sanitizeInput(rawFileName, 200);
    if (!fileName) {
      throw new Error("Invalid file name");
    }

    const projectRoot = await requireProjectRoot();
    const context = await buildChapterContext(projectRoot, fileName);
    return NextResponse.json({ ok: true, data: context });
  } catch (error) {
    log.error("route_failed", {
      route: "GET /api/projects/current/context",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to load chapter context"),
      },
      { status: 500 },
    );
  }
}
