/**
 * GET /api/admin/microsoft-ads/oauth-result
 *
 * Returns the refresh_token captured by the OAuth callback (and
 * stored in the 60-second `ms_oauth_refresh` HTTP-only cookie).
 * After this endpoint reads it once, the cookie is cleared — single
 * use only.
 *
 * Response shape:
 *   { refreshToken: string } | { error: string }
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

export async function GET(_request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c     = await cookies();
  const token = c.get("ms_oauth_refresh")?.value;
  if (!token) {
    return NextResponse.json({ error: "no_refresh_token" }, { status: 404 });
  }

  // Single-use — clear the cookie immediately on read.
  const res = NextResponse.json({ refreshToken: token });
  res.cookies.set("ms_oauth_refresh", "", { maxAge: 0, path: "/admin/microsoft-ads" });
  return res;
}
