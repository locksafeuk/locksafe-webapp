/**
 * GET /api/admin/social/linkedin/connect
 *
 * Initiates LinkedIn OAuth 2.0 flow for organization page posting.
 * Requires LINKEDIN_CLIENT_ID env var (from LinkedIn Developer App).
 * Redirects admin to LinkedIn authorization page.
 *
 * Required scopes: w_organization_social, r_organization_social, rw_organization_admin
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

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/admin/social-connect?error=linkedin_app_not_configured&platform=linkedin", request.url)
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk"}/api/admin/social/linkedin/callback`;

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", "r_organization_social w_organization_social rw_organization_admin openid profile");

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("linkedin_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
