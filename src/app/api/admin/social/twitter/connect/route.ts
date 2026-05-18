/**
 * GET /api/admin/social/twitter/connect
 *
 * Uses static OAuth 1.0a env vars (TWITTER_API_KEY/SECRET + ACCESS_TOKEN/SECRET)
 * to verify credentials, look up the account, and upsert a SocialAccount DB record.
 * No web OAuth flow needed since we already hold permanent access tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { TwitterApi } from "twitter-api-v2";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

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

  const apiKey       = process.env.TWITTER_API_KEY;
  const apiSecret    = process.env.TWITTER_API_SECRET;
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return NextResponse.redirect(
      new URL("/admin/social-connect?error=twitter_app_not_configured&platform=twitter", request.url)
    );
  }

  try {
    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });
    const { data: me } = await client.v2.me({ "user.fields": ["name", "username", "profile_image_url"] });

    await prisma.socialAccount.upsert({
      where: { platform_accountId: { platform: "TWITTER", accountId: me.id } },
      create: {
        platform:       "TWITTER",
        accountId:      me.id,
        accountName:    me.name,
        accountHandle:  `@${me.username}`,
        accessToken:    accessToken,
        tokenExpiresAt: null, // OAuth 1.0a tokens are permanent
        isActive:       true,
      },
      update: {
        accountName:    me.name,
        accountHandle:  `@${me.username}`,
        accessToken:    accessToken,
        tokenExpiresAt: { set: null }, // clear any old expiry; OAuth 1.0a tokens are permanent
        isActive:       true,
      },
    });

    console.log(`[Twitter Connect] Connected: @${me.username} (${me.id})`);

    return NextResponse.redirect(
      new URL(`/admin/social-connect?success=twitter&platform=twitter&name=${encodeURIComponent(me.name)}`, request.url)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Twitter connect failed";
    console.error("[Twitter Connect]", msg);
    return NextResponse.redirect(
      new URL(`/admin/social-connect?error=${encodeURIComponent(msg)}&platform=twitter`, request.url)
    );
  }
}
