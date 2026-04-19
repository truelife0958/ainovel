import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "./sanitize-error";
import { log } from "../log.js";

export type RouteHandler = (
  request: Request,
  ctx: { requestId: string },
) => Promise<Response>;

/**
 * Higher-order Next.js route handler. Extracts the request-id, invokes
 * the inner handler, and normalizes error outcomes:
 *   - AbortError / aborted signal → HTTP 499 "Request cancelled"
 *   - anything else → HTTP 500 with log.error + sanitized message
 *
 * Consumers keep any rate-limit preamble *outside* this wrapper;
 * wrapper handles only happy-path execution + error envelope.
 */
export function withRouteLogging(
  routeLabel: string,
  handler: RouteHandler,
  fallbackMessage = "Unable to process request",
): (request: Request) => Promise<Response> {
  return async function routeHandler(request) {
    const requestId = request.headers.get("x-request-id") ?? "unknown";
    try {
      return await handler(request, { requestId });
    } catch (error) {
      const isAbort =
        (error as Error | undefined)?.name === "AbortError" ||
        request.signal?.aborted;
      if (isAbort) {
        return NextResponse.json(
          { ok: false, error: "Request cancelled" },
          { status: 499 },
        );
      }
      log.error("route_failed", {
        route: routeLabel,
        requestId,
        error: (error as Error | undefined)?.message ?? String(error),
      });
      return NextResponse.json(
        { ok: false, error: sanitizeErrorMessage(error, fallbackMessage) },
        { status: 500 },
      );
    }
  };
}
