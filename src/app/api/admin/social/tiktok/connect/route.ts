/**
 * GET /api/admin/social/tiktok/connect
 *
 * Initiates the TikTok OAuth 2.0 flow for the Content Posting API.
 * Requires TIKTOK_CLIENT_KEY (from an audited TikTok developer app).
 * Redirects the admin to TikTok's authorization page.
 *
 * Required scopes: user.info.basic, video.publish
 * (Public posting also requires the app to have passed TikTok's audit and a
 *  URL-verified domain for PULL_FROM_URL image hosting.)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import crypto from "node:crypto";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!(payload && payload.type === "admin");
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  if (!clientKey) {
    return NextResponse.redirect(
      new URL("/admin/social-connect?error=tiktok_app_not_configured&platform=tiktok", request.url)
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk"}/api/admin/social/tiktok/callback`;

  const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
  authUrl.searchParams.set("client_key", clientKey);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "user.info.basic,video.publish");
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("tiktok_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
