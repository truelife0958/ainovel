import { NextResponse } from "next/server";

/**
 * Inject a stable X-Request-Id for every /api/* request so failures can
 * be correlated in logs. Honors an inbound x-request-id up to 128 chars
 * (useful for upstream tracing), otherwise generates a UUID.
 */
export function middleware(req: Request) {
  const existing = req.headers.get("x-request-id");
  const requestId = existing && existing.length > 0 && existing.length <= 128
    ? existing
    : crypto.randomUUID();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("X-Request-Id", requestId);
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
