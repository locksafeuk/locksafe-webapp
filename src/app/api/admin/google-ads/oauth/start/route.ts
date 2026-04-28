/**
 * GET /api/admin/google-ads/oauth/start
 *
 * Builds the Google consent-screen URL and redirects the admin to it. A short-
 * lived signed `state` cookie is set so the callback can verify the response
 * came from a flow we initiated (CSRF protection).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/google-ads";
import crypto from "node:crypto";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!(payload && payload.type === "admin");
}

export async function GET(_request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redirectUri = process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json(
      { error: "GOOGLE_ADS_OAUTH_REDIRECT_URI not configured" },
      { status: 500 },
    );
  }

  // Random state. Stored both in the URL and a short-lived HttpOnly cookie;
  // the callback compares the two to defeat CSRF.
  const state = crypto.randomBytes(24).toString("hex");
  const url = buildAuthUrl(redirectUri, state);

  const res = NextResponse.redirect(url);
  res.cookies.set("google_ads_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  return res;
}
