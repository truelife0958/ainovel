import { NextResponse } from "next/server";

import { withRouteLogging } from "@/lib/api/with-route-logging";
import { sanitizeInput } from "@/lib/api/sanitize";
import { requireProjectRoot } from "@/lib/projects/discovery.js";
import { listProjectDocuments, readProjectDocument } from "@/lib/projects/documents.js";
import { combineChaptersAsTxt, safeFileName } from "@/lib/projects/export.js";

export const GET = withRouteLogging(
  "GET /api/projects/current/export",
  async (request) => {
    const projectRoot = await requireProjectRoot();
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const file = sanitizeInput(url.searchParams.get("file") || "", 200);

    if (format === "md") {
      if (!file) throw new Error("file query param is required for format=md");
      const doc = await readProjectDocument(projectRoot, "chapter", file);
      return new NextResponse(doc.content, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeFileName(doc.fileName)}"`,
        },
      });
    }

    if (format === "txt-all") {
      const metas = await listProjectDocuments(projectRoot, "chapter");
      const chapters = await Promise.all(
        metas.map(async (m) => {
          const d = await readProjectDocument(projectRoot, "chapter", m.fileName);
          return { title: d.title, content: d.content };
        }),
      );
      const body = combineChaptersAsTxt(chapters);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="export-${Date.now()}.txt"`,
        },
      });
    }

    throw new Error("Unsupported export format. Use format=md&file=... or format=txt-all.");
  },
  "Unable to export",
);
