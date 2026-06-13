/**
 * POST /api/admin/microsoft-ads/oauth-start
 *
 * Begins the OAuth consent flow. Returns the Microsoft authorize URL
 * the admin should be redirected to. Sets a short-lived HTTP-only
 * `ms_oauth_state` cookie that the callback verifies (CSRF).
 *
 * Response shape:
 *   { authorizeUrl: string } | { error: string }
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { verifyToken } from "@/lib/auth";
import { buildMicrosoftAuthorizeUrl } from "@/lib/microsoft-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.MICROSOFT_ADS_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "MICROSOFT_ADS_CLIENT_ID not set in Vercel. Register your Azure app first." },
      { status: 400 },
    );
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
  const redirectUri = `${base.replace(/\/$/, "")}/api/admin/microsoft-ads/oauth-callback`;

  const state = randomBytes(24).toString("hex");
  const authorizeUrl = buildMicrosoftAuthorizeUrl({ clientId, redirectUri, state });

  const res = NextResponse.json({ authorizeUrl, redirectUri });
  res.cookies.set("ms_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   10 * 60, // 10 minutes to complete consent
    path:     "/",
  });
  return res;
}
