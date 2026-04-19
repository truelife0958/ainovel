import { NextResponse } from "next/server";

import { withRouteLogging } from "@/lib/api/with-route-logging";
import { sanitizeInput } from "@/lib/api/sanitize";
import { readProjectIdeation, updateProjectIdeation } from "@/lib/projects/state.js";
import { requireProjectRoot } from "@/lib/projects/discovery.js";

export const GET = withRouteLogging(
  "GET /api/projects/current/ideation",
  async () => {
    const ideation = await readProjectIdeation(await requireProjectRoot());
    return NextResponse.json({ ok: true, data: ideation });
  },
  "Unable to load ideation",
);

export const PUT = withRouteLogging(
  "PUT /api/projects/current/ideation",
  async (request) => {
    const body = await request.json();
    const patch = typeof body === "object" && body !== null ? body : {};

    const sanitizedPatch: Record<string, string | number> = {};
    if (typeof patch.title === "string") sanitizedPatch.title = sanitizeInput(patch.title, 200);
    if (typeof patch.genre === "string") sanitizedPatch.genre = sanitizeInput(patch.genre, 100);
    if (typeof patch.targetReader === "string") sanitizedPatch.targetReader = sanitizeInput(patch.targetReader, 200);
    if (typeof patch.platform === "string") sanitizedPatch.platform = sanitizeInput(patch.platform, 100);
    if (typeof patch.goldenFingerName === "string") sanitizedPatch.goldenFingerName = sanitizeInput(patch.goldenFingerName, 200);
    if (typeof patch.goldenFingerType === "string") sanitizedPatch.goldenFingerType = sanitizeInput(patch.goldenFingerType, 100);
    if (typeof patch.goldenFingerStyle === "string") sanitizedPatch.goldenFingerStyle = sanitizeInput(patch.goldenFingerStyle, 200);
    if (typeof patch.coreSellingPoints === "string") sanitizedPatch.coreSellingPoints = sanitizeInput(patch.coreSellingPoints, 2000);
    if (typeof patch.protagonistStructure === "string") sanitizedPatch.protagonistStructure = sanitizeInput(patch.protagonistStructure, 500);
    if (typeof patch.protagonistName === "string") sanitizedPatch.protagonistName = sanitizeInput(patch.protagonistName, 100);
    if (typeof patch.targetWords === "number") sanitizedPatch.targetWords = Math.max(0, Math.floor(patch.targetWords));
    if (typeof patch.targetChapters === "number") sanitizedPatch.targetChapters = Math.max(0, Math.floor(patch.targetChapters));

    const ideation = await updateProjectIdeation(await requireProjectRoot(), sanitizedPatch);
    return NextResponse.json({ ok: true, data: ideation });
  },
  "Unable to save ideation",
);
