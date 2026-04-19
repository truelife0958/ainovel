import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { log } from "@/lib/log.js";
import { requireProjectRoot } from "@/lib/projects/discovery.js";
import { readProjectReviewSummary } from "@/lib/projects/review.js";

export async function GET(request: Request) {
  try {
    const projectRoot = await requireProjectRoot();
    const summary = await readProjectReviewSummary(projectRoot);
    return NextResponse.json({ ok: true, data: summary });
  } catch (error) {
    log.error("route_failed", {
      route: "GET /api/projects/current/review",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      { ok: false, error: sanitizeErrorMessage(error, "Unable to load review summary") },
      { status: 500 },
    );
  }
}
