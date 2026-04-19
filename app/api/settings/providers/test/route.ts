import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { log } from "@/lib/log.js";
import { readProviderRuntimeStatus } from "@/lib/settings/provider-config.js";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60000;

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`test:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.retryAfter),
        },
      },
    );
  }

  try {
    const status = await readProviderRuntimeStatus(
      process.env.WEBNOVEL_WRITER_CONFIG_ROOT,
      "writing",
    );

    return NextResponse.json({
      ok: status.available,
      message: status.message,
      providerId: status.providerId,
      providerLabel: status.providerLabel,
      model: status.model,
    });
  } catch (error) {
    log.error("route_failed", {
      route: "GET /api/settings/providers/test",
      requestId: request.headers.get("x-request-id") ?? "unknown",
      error: (error as Error)?.message ?? String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        message: sanitizeErrorMessage(error, "Unable to test provider connection"),
      },
      { status: 500 },
    );
  }
}
