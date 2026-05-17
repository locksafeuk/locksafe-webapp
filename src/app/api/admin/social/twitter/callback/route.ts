/**
 * GET /api/admin/social/twitter/callback
 *
 * Twitter OAuth 2.0 PKCE callback. Exchanges code for access + refresh tokens.
 * Saves to SocialAccount DB record.
 *
 * Query params: code, state
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

  const url   = new URL(request.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirect(request, `error=${encodeURIComponent(error)}&platform=twitter`);
  }
  if (!code || !state) {
    return redirect(request, "error=twitter_missing_params&platform=twitter");
  }

  const cookieStore = await cookies();
  const codeVerifier   = cookieStore.get("twitter_code_verifier")?.value;
  const expectedState  = cookieStore.get("twitter_oauth_state")?.value;

  if (!codeVerifier || !expectedState || expectedState !== state) {
    return redirect(request, "error=twitter_state_mismatch&platform=twitter");
  }

  const clientId     = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirect(request, "error=twitter_app_not_configured&platform=twitter");
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk"}/api/admin/social/twitter/callback`;

  try {
    const { TwitterApi } = require("twitter-api-v2") as typeof import("twitter-api-v2");
    const client = new TwitterApi({ clientId, clientSecret });

    const { client: loggedClient, accessToken, refreshToken, expiresIn } =
      await client.loginWithOAuth2({ code, codeVerifier, redirectUri: callbackUrl });

    const me = await loggedClient.v2.me({ "user.fields": ["profile_image_url", "username", "name"] });
    const userId   = me.data.id;
    const username = me.data.username;
    const name     = me.data.name;

    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h default

    await prisma.socialAccount.upsert({
      where: { platform_accountId: { platform: "TWITTER", accountId: userId } },
      create: {
        platform:      "TWITTER",
        accountId:     userId,
        accountName:   name,
        accountHandle: `@${username}`,
        accessToken,
        refreshToken:  refreshToken ?? null,
        tokenExpiresAt,
        isActive:      true,
      },
      update: {
        accountName:   name,
        accountHandle: `@${username}`,
        accessToken,
        refreshToken:  refreshToken ?? null,
        tokenExpiresAt,
        isActive:      true,
      },
    });

    await prisma.socialAccount.updateMany({
      where: { platform: "TWITTER", accountId: "PLACEHOLDER" },
      data: { isActive: false },
    });

    console.log(`[Twitter Connect] Connected @${username} (${userId})`);

    const res = redirect(request, `success=twitter&platform=twitter&handle=${encodeURIComponent("@" + username)}`);
    res.cookies.delete("twitter_code_verifier");
    res.cookies.delete("twitter_oauth_state");
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Twitter OAuth callback failed";
    console.error("[Twitter Callback]", msg);
    return redirect(request, `error=${encodeURIComponent(msg)}&platform=twitter`);
  }
}
