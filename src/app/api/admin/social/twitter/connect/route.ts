/**
 * GET /api/admin/social/twitter/connect
 *
 * Initiates Twitter OAuth 2.0 PKCE flow.
 * Requires TWITTER_CLIENT_ID + TWITTER_CLIENT_SECRET env vars.
 * Redirects admin to Twitter authorization page.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

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

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/admin/social-connect?error=twitter_app_not_configured&platform=twitter", request.url)
    );
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk"}/api/admin/social/twitter/callback`;

  try {
    const { TwitterApi } = require("twitter-api-v2") as typeof import("twitter-api-v2");
    const client = new TwitterApi({ clientId, clientSecret });
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(callbackUrl, {
      scope: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    });

    const res = NextResponse.redirect(url);
    // Store codeVerifier + state in HttpOnly cookies for callback verification
    res.cookies.set("twitter_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    res.cookies.set("twitter_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Twitter OAuth init failed";
    console.error("[Twitter Connect]", msg);
    return NextResponse.redirect(
      new URL(`/admin/social-connect?error=${encodeURIComponent(msg)}&platform=twitter`, request.url)
    );
  }
}
