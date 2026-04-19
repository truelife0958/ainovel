import { NextResponse } from "next/server";

import { withRouteLogging } from "@/lib/api/with-route-logging";
import { sanitizeInput, sanitizeContent, validateContentSize } from "@/lib/api/sanitize";
import { readChapterBrief, updateChapterBrief } from "@/lib/projects/briefs.js";
import { requireProjectRoot } from "@/lib/projects/discovery.js";
import { syncChapterArtifacts } from "@/lib/projects/sync.js";

const MAX_BRIEF_SIZE = 50000; // 50KB

export const GET = withRouteLogging(
  "GET /api/projects/current/briefs",
  async (request) => {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("file");
    if (!fileName) {
      throw new Error("Chapter file name is required");
    }
    const sanitizedFileName = sanitizeInput(fileName, 200);
    const brief = await readChapterBrief(await requireProjectRoot(), sanitizedFileName);
    return NextResponse.json({ ok: true, data: brief });
  },
  "Unable to load chapter brief",
);

export const PUT = withRouteLogging(
  "PUT /api/projects/current/briefs",
  async (request) => {
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
  },
  "Unable to save chapter brief",
);
