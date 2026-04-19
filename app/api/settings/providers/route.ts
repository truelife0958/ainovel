import { NextResponse } from "next/server";

import { withRouteLogging } from "@/lib/api/with-route-logging";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import {
  readProviderConfigSummary,
  updateProviderConfig,
} from "@/lib/settings/provider-config.js";

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60000;

function rateLimit429(retryAfter: number) {
  return NextResponse.json(
    { ok: false, error: "请求过于频繁，请稍后再试" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

const getHandler = withRouteLogging(
  "GET /api/settings/providers",
  async (request) => {
    const config = await readProviderConfigSummary();
    const clientIp = getClientIp(request);
    // The caller's rate-limit record; we re-read remaining (already consumed at entry)
    const rateCheck = checkRateLimit(`settings:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
    return NextResponse.json({
      ok: true,
      data: config,
      rateLimit: {
        remaining: rateCheck.remaining,
        limit: RATE_LIMIT_MAX,
      },
    });
  },
  "Unable to load provider settings",
);

const putHandler = withRouteLogging(
  "PUT /api/settings/providers",
  async (request) => {
    const body = await request.json();
    const bodyStr = JSON.stringify(body ?? {});
    if (bodyStr.length > 102400) {
      return NextResponse.json(
        { ok: false, error: "配置数据过大" },
        { status: 400 },
      );
    }
    await updateProviderConfig(process.env.WEBNOVEL_WRITER_CONFIG_ROOT, body ?? {});
    const config = await readProviderConfigSummary();
    return NextResponse.json({ ok: true, data: config });
  },
  "Unable to save provider settings",
);

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`settings:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
  if (!rateCheck.allowed) return rateLimit429(rateCheck.retryAfter ?? 60);
  return getHandler(request);
}

export async function PUT(request: Request) {
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`settings-put:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
  if (!rateCheck.allowed) return rateLimit429(rateCheck.retryAfter ?? 60);
  return putHandler(request);
}
