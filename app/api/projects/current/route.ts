import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { sanitizeInput } from "@/lib/api/sanitize";
import { log } from "@/lib/log.js";
import {
  listProjectsWithCurrent,
  setCurrentProject,
} from "@/lib/projects/workspace.js";
import { getCurrentProjectSummary } from "@/lib/projects/discovery.js";

export async function GET(request: Request) {
  try {
    const project = await getCurrentProjectSummary();
    if (!project) {
      return NextResponse.json(
        { ok: false, error: "No project found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, data: project });
  } catch (error) {
    log.error("route_failed", {
      route: "GET /api/projects/current",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to load current project"),
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
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
  } catch (error) {
    log.error("route_failed", {
      route: "PUT /api/projects/current",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to switch project"),
      },
      { status: 500 },
    );
  }
}
