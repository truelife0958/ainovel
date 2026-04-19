import { NextResponse } from "next/server";

import { withRouteLogging } from "@/lib/api/with-route-logging";
import { sanitizeInput } from "@/lib/api/sanitize";
import {
  listProjectsWithCurrent,
  createProject,
} from "@/lib/projects/workspace.js";

export const GET = withRouteLogging(
  "GET /api/projects",
  async () => {
    const workspace = await listProjectsWithCurrent();
    return NextResponse.json({ ok: true, data: workspace });
  },
  "Unable to list projects",
);

export const POST = withRouteLogging(
  "POST /api/projects",
  async (request) => {
    const body = await request.json();

    const safeTitle = sanitizeInput(body.title, 200);
    if (!safeTitle) {
      return NextResponse.json(
        { ok: false, error: "Project title is required" },
        { status: 400 },
      );
    }

    const project = await createProject(process.cwd(), { ...body, title: safeTitle });
    const workspace = await listProjectsWithCurrent();

    return NextResponse.json({
      ok: true,
      data: { project, workspace },
    });
  },
  "Unable to create project",
);
