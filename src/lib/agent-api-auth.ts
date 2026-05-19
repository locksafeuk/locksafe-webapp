import type { AdminTokenPayload } from "@/lib/auth";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function requireAdminFromCookies(): Promise<AdminTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

/**
 * Constant-time string comparison to avoid timing attacks on the cron secret.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Allow either an admin cookie OR `Authorization: Bearer ${CRON_SECRET}`.
 * Used by read-only agent surface endpoints that the daily-reliability cron
 * needs to poll without an admin session.
 */
export async function requireAdminOrCron(
  request: NextRequest,
): Promise<AdminTokenPayload | { type: "cron" } | null> {
  const admin = await requireAdminFromCookies();
  if (admin) return admin;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return null;

  const header = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return null;
  if (!safeEqual(m[1].trim(), cronSecret)) return null;
  return { type: "cron" };
}

export function unauthorizedAgentApiResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
