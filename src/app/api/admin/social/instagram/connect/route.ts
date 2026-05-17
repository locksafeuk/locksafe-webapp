/**
 * GET /api/admin/social/instagram/connect
 *
 * Initiates Facebook Login OAuth with Instagram Business scopes.
 * Instagram Business API uses Facebook's OAuth infrastructure.
 * Requires FACEBOOK_APP_ID env var (from Meta Developer App).
 *
 * Required permissions:
 *   instagram_basic, instagram_content_publish, pages_show_list,
 *   pages_read_engagement, business_management
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

  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) {
    return NextResponse.redirect(
      new URL("/admin/social-connect?error=facebook_app_not_configured&platform=instagram", request.url)
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk"}/api/admin/social/instagram/callback`;

  const authUrl = new URL("https://www.facebook.com/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management"
  );

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("instagram_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
