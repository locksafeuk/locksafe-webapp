import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders, type RateLimitConfig } from "@/lib/rate-limit";

const DEFAULT_AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: parseInteger(process.env.AUTH_RATE_LIMIT_ATTEMPTS, 5),
  windowSeconds: parseInteger(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS, 60),
};

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRequestIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function enforceAuthRateLimit(
  request: NextRequest,
  namespace: string,
  config: RateLimitConfig = DEFAULT_AUTH_RATE_LIMIT,
): NextResponse | null {
  const identifier = `${namespace}:${getRequestIdentifier(request)}`;
  const result = checkRateLimit(identifier, config);

  if (result.success) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Too many attempts. Please wait a minute and try again.",
    },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    },
  );
}
