import { NextRequest } from "next/server";

/**
 * Fail-closed cron auth: allows Vercel native cron (x-vercel-cron: 1) or a
 * valid Bearer token matching CRON_SECRET. Returns false if CRON_SECRET is
 * unset and the request did not come from Vercel's cron scheduler.
 */
export function verifyCronAuth(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
