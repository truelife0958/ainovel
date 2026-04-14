import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import {
  listProjectsWithCurrent,
  setCurrentProject,
} from "@/lib/projects/workspace.js";
import { getCurrentProjectSummary } from "@/lib/projects/discovery.js";

export async function GET() {
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
    const projectId = body.projectId;

    if (!projectId || typeof projectId !== "string") {
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
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to switch project"),
      },
      { status: 400 },
    );
  }
}
