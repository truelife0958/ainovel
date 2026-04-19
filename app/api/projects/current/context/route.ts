import { NextResponse } from "next/server";

import { withRouteLogging } from "@/lib/api/with-route-logging";
import { sanitizeInput } from "@/lib/api/sanitize";
import { buildChapterContext } from "@/lib/projects/context.js";
import { requireProjectRoot } from "@/lib/projects/discovery.js";

export const GET = withRouteLogging(
  "GET /api/projects/current/context",
  async (request) => {
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
  },
  "Unable to load chapter context",
);
