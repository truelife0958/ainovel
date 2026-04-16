import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { requireProjectRoot } from "@/lib/projects/discovery.js";
import { readProjectReviewSummary } from "@/lib/projects/review.js";

export async function GET() {
  try {
    const projectRoot = await requireProjectRoot();
    const summary = await readProjectReviewSummary(projectRoot);
    return NextResponse.json({ ok: true, data: summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: sanitizeErrorMessage(error, "Unable to load review summary") },
      { status: 500 },
    );
  }
}
