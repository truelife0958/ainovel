import { NextResponse } from "next/server";

import { runDocumentAiAction } from "@/lib/ai/actions";
import { withRouteLogging } from "@/lib/api/with-route-logging";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { sanitizeInput } from "@/lib/api/sanitize";
import { requireProjectRoot } from "@/lib/projects/discovery.js";

const MAX_USER_REQUEST_LENGTH = 2000;
const AI_RATE_LIMIT_MAX = 10;
const AI_RATE_LIMIT_WINDOW = 60000;

function validKind(value: unknown) {
  return value === "outline" || value === "chapter" || value === "setting";
}

function validMode(value: unknown) {
  return value === "outline_plan" || value === "chapter_plan" || value === "chapter_write"
    || value === "setting_worldview" || value === "setting_protagonist"
    || value === "setting_antagonist" || value === "setting_synopsis"
    || value === "setting_volume" || value === "reference_analysis";
}

function validApplyMode(value: unknown) {
  return value === "replace" || value === "append";
}

const runAi = withRouteLogging(
  "POST /api/projects/current/actions",
  async (request) => {
    const projectRoot = await requireProjectRoot();
    const body = await request.json();

    if (!validKind(body.kind)) {
      throw new Error("Unsupported document kind");
    }
    if (typeof body.fileName !== "string" || !body.fileName.trim()) {
      throw new Error("Document file name is required");
    }
    if (!validMode(body.mode)) {
      throw new Error("Unsupported AI mode");
    }
    if (!validApplyMode(body.applyMode)) {
      throw new Error("Unsupported apply mode");
    }

    const sanitizedFileName = sanitizeInput(body.fileName, 200);
    const sanitizedUserRequest = sanitizeInput(body.userRequest, MAX_USER_REQUEST_LENGTH);

    const result = await runDocumentAiAction({
      projectRoot,
      configRoot: process.env.WEBNOVEL_WRITER_CONFIG_ROOT,
      kind: body.kind,
      fileName: sanitizedFileName,
      mode: body.mode,
      userRequest: sanitizedUserRequest,
      applyMode: body.applyMode,
      signal: request.signal,
    });

    const maxReturnLength = 100000;
    const truncatedResult = {
      ...result,
      generatedText: result.generatedText?.slice(0, maxReturnLength),
    };

    return NextResponse.json({ ok: true, data: truncatedResult });
  },
  "Unable to run AI action",
);

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`ai:${clientIp}`, AI_RATE_LIMIT_MAX, AI_RATE_LIMIT_WINDOW);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: "AI 请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.retryAfter),
          "X-RateLimit-Limit": String(AI_RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  return runAi(request);
}
