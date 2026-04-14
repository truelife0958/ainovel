import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { readProjectIdeation, updateProjectIdeation } from "@/lib/projects/state.js";
import { requireProjectRoot } from "@/lib/projects/discovery.js";

export async function GET() {
  try {
    const ideation = await readProjectIdeation(await requireProjectRoot());
    return NextResponse.json({ ok: true, data: ideation });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to load ideation"),
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const ideation = await updateProjectIdeation(await requireProjectRoot(), body ?? {});
    return NextResponse.json({ ok: true, data: ideation });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to save ideation"),
      },
      { status: 400 },
    );
  }
}
