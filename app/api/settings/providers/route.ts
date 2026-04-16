import { NextResponse } from "next/server";

import { sanitizeErrorMessage } from "@/lib/api/sanitize-error";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import {
  readProviderConfigSummary,
  updateProviderConfig,
} from "@/lib/settings/provider-config.js";

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60000;

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`settings:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const config = await readProviderConfigSummary();

    return NextResponse.json({
      ok: true,
      data: config,
      rateLimit: {
        remaining: rateCheck.remaining,
        limit: RATE_LIMIT_MAX,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: sanitizeErrorMessage(error, "Unable to load provider settings") },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const clientIp = getClientIp(request);
  const rateCheck = checkRateLimit(`settings-put:${clientIp}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const body = await request.json();

    // Validate payload size to prevent abuse
    const bodyStr = JSON.stringify(body ?? {});
    if (bodyStr.length > 102400) {
      return NextResponse.json(
        { ok: false, error: "配置数据过大" },
        { status: 400 },
      );
    }

    await updateProviderConfig(process.env.WEBNOVEL_WRITER_CONFIG_ROOT, body ?? {});
    const config = await readProviderConfigSummary();

    return NextResponse.json({
      ok: true,
      data: config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: sanitizeErrorMessage(error, "Unable to save provider settings"),
      },
      { status: 500 },
    );
  }
}
