import { NextResponse } from "next/server";

import { withRouteLogging } from "@/lib/api/with-route-logging";
import { requireProjectRoot } from "@/lib/projects/discovery.js";
import { readProjectReviewSummary } from "@/lib/projects/review.js";

export const GET = withRouteLogging(
  "GET /api/projects/current/review",
  async () => {
    const projectRoot = await requireProjectRoot();
    const summary = await readProjectReviewSummary(projectRoot);
    return NextResponse.json({ ok: true, data: summary });
  },
  "Unable to load review summary",
);
