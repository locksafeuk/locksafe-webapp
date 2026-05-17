/**
 * GET /api/admin/social/twitter/connect
 *
 * Initiates Twitter OAuth 1.0a 3-legged flow.
 * Requires TWITTER_API_KEY + TWITTER_API_SECRET env vars (from Twitter Dev Portal).
 * Redirects admin to Twitter authorization page.
 * Sets an HttpOnly cookie with the oauth_token_secret for the callback.
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

  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.redirect(
      new URL("/admin/social-connect?error=twitter_app_not_configured&platform=twitter", request.url)
    );
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk"}/api/admin/social/twitter/callback`;

  try {
    const { TwitterApi } = require("twitter-api-v2") as typeof import("twitter-api-v2");
    const client = new TwitterApi({ appKey: apiKey, appSecret });
    const authLink = await client.generateAuthLink(callbackUrl, { linkMode: "authorize" });

    // Store the oauth_token_secret in an HttpOnly cookie (needed for the callback)
    const res = NextResponse.redirect(authLink.url);
    res.cookies.set("twitter_oauth_token_secret", authLink.oauth_token_secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
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
