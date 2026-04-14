import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import {
  listProjectsWithCurrent,
  createProject,
} from "@/lib/projects/workspace.js";

export async function GET() {
  try {
    const workspace = await listProjectsWithCurrent();
    return NextResponse.json({ ok: true, data: workspace });
  } catch (error) {
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

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json(
        { ok: false, error: "Project title is required" },
        { status: 400 },
      );
    }

    const project = await createProject(process.cwd(), body);
    const workspace = await listProjectsWithCurrent();

    return NextResponse.json({
      ok: true,
      data: { project, workspace },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to create project"),
      },
      { status: 400 },
    );
  }
}
