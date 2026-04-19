import { NextResponse } from "next/server";

import { withRouteLogging } from "@/lib/api/with-route-logging";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { readProviderRuntimeStatus } from "@/lib/settings/provider-config.js";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60000;

const getHandler = withRouteLogging(
  "GET /api/settings/providers/test",
  async () => {
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
  },
  "Unable to test provider connection",
);

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`test:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfter) },
      },
    );
  }

  return getHandler(request);
}
