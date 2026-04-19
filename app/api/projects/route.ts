import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { sanitizeInput } from "@/lib/api/sanitize";
import { log } from "@/lib/log.js";
import {
  listProjectsWithCurrent,
  createProject,
} from "@/lib/projects/workspace.js";

export async function GET(request: Request) {
  try {
    const workspace = await listProjectsWithCurrent();
    return NextResponse.json({ ok: true, data: workspace });
  } catch (error) {
    log.error("route_failed", {
      route: "GET /api/projects",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to list projects"),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    log.error("route_failed", {
      route: "POST /api/projects",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to create project"),
      },
      { status: 500 },
    );
  }
}
