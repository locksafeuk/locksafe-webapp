/**
 * GET /api/admin/social/twitter/callback
 *
 * Twitter OAuth 1.0a callback. Exchanges oauth_token + oauth_verifier for
 * permanent access tokens. Saves to SocialAccount DB record.
 *
 * Query params: oauth_token, oauth_verifier
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!(payload && payload.type === "admin");
}

function redirect(request: NextRequest, params: string) {
  return NextResponse.redirect(new URL(`/admin/social-connect?${params}`, request.url));
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const url = new URL(request.url);
  const oauthToken    = url.searchParams.get("oauth_token");
  const oauthVerifier = url.searchParams.get("oauth_verifier");
  const denied        = url.searchParams.get("denied");

  if (denied) {
    return redirect(request, "error=twitter_denied&platform=twitter");
  }
  if (!oauthToken || !oauthVerifier) {
    return redirect(request, "error=twitter_missing_params&platform=twitter");
  }

  const cookieStore = await cookies();
  const oauthTokenSecret = cookieStore.get("twitter_oauth_token_secret")?.value;
  if (!oauthTokenSecret) {
    return redirect(request, "error=twitter_session_expired&platform=twitter");
  }

  const apiKey    = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  if (!apiKey || !apiSecret) {
    return redirect(request, "error=twitter_app_not_configured&platform=twitter");
  }

  try {
    const { TwitterApi } = require("twitter-api-v2") as typeof import("twitter-api-v2");
    const tempClient = new TwitterApi({
      appKey: apiKey,
      appSecret,
      accessToken: oauthToken,
      accessSecret: oauthTokenSecret,
    });

    const { client: loggedClient, accessToken, accessSecret } = await tempClient.login(oauthVerifier);

    // Get authenticated user info
    const me = await loggedClient.v2.me({ "user.fields": ["profile_image_url", "username", "name"] });
    const userId   = me.data.id;
    const username = me.data.username;
    const name     = me.data.name;

    // Upsert SocialAccount in DB
    await prisma.socialAccount.upsert({
      where: { platform_accountId: { platform: "TWITTER", accountId: userId } },
      create: {
        platform:     "TWITTER",
        accountId:    userId,
        accountName:  name,
        accountHandle: `@${username}`,
        accessToken,
        refreshToken: accessSecret, // Store access secret in refreshToken field
        isActive:     true,
      },
      update: {
        accountName:  name,
        accountHandle: `@${username}`,
        accessToken,
        refreshToken: accessSecret,
        isActive:     true,
      },
    });

    // Deactivate any placeholder records for Twitter
    await prisma.socialAccount.updateMany({
      where: { platform: "TWITTER", accountId: "PLACEHOLDER" },
      data: { isActive: false },
    });

    console.log(`[Twitter Connect] Connected @${username} (${userId})`);

    // Clear the temp cookie
    const res = redirect(request, `success=twitter&platform=twitter&handle=${encodeURIComponent("@" + username)}`);
    res.cookies.delete("twitter_oauth_token_secret");
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Twitter OAuth callback failed";
    console.error("[Twitter Callback]", msg);
    return redirect(request, `error=${encodeURIComponent(msg)}&platform=twitter`);
  }
}
