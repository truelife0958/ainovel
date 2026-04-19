import { NextResponse } from "next/server";

import { withRouteLogging } from "@/lib/api/with-route-logging";
import { sanitizeInput } from "@/lib/api/sanitize";
import {
  listProjectsWithCurrent,
  setCurrentProject,
} from "@/lib/projects/workspace.js";
import { getCurrentProjectSummary } from "@/lib/projects/discovery.js";

export const GET = withRouteLogging(
  "GET /api/projects/current",
  async () => {
    const project = await getCurrentProjectSummary();
    if (!project) {
      return NextResponse.json(
        { ok: false, error: "No project found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, data: project });
  },
  "Unable to load current project",
);

export const PUT = withRouteLogging(
  "PUT /api/projects/current",
  async (request) => {
    const body = await request.json();
    const projectId = sanitizeInput(body.projectId, 200);

    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: "Project ID is required" },
        { status: 400 },
      );
    }

    const project = await setCurrentProject(process.cwd(), projectId);
    const workspace = await listProjectsWithCurrent();

    return NextResponse.json({
      ok: true,
      data: { project, workspace },
    });
  },
  "Unable to switch project",
);
