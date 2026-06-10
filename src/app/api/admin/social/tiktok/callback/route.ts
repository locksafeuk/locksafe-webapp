/**
 * GET /api/admin/social/tiktok/callback
 *
 * TikTok OAuth 2.0 callback. Exchanges code for access + refresh tokens,
 * fetches the creator's display name, and upserts a SocialAccount DB record.
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

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return redirect(request, `error=${encodeURIComponent(error)}&platform=tiktok`);
  if (!code || !state) return redirect(request, "error=tiktok_missing_params&platform=tiktok");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("tiktok_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return redirect(request, "error=tiktok_state_mismatch&platform=tiktok");
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) {
    return redirect(request, "error=tiktok_app_not_configured&platform=tiktok");
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk"}/api/admin/social/tiktok/callback`;

  try {
    // 1) Exchange the code for tokens
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      open_id?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      const msg = tokenData.error_description || tokenData.error || "TikTok token exchange failed";
      return redirect(request, `error=${encodeURIComponent(msg)}&platform=tiktok`);
    }

    const accessToken = tokenData.access_token;
    const openId = tokenData.open_id || "unknown";
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 2) Fetch the creator display name (best-effort)
    let displayName = "LockSafe UK";
    try {
      const infoRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const info = (await infoRes.json()) as { data?: { user?: { display_name?: string } } };
      if (info.data?.user?.display_name) displayName = info.data.user.display_name;
    } catch {
      /* non-fatal */
    }

    // 3) Upsert the SocialAccount row
    await prisma.socialAccount.upsert({
      where: { platform_accountId: { platform: "TIKTOK", accountId: openId } },
      create: {
        platform: "TIKTOK",
        accountId: openId,
        accountName: displayName,
        accountHandle: "@locksafeuk",
        accessToken,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt,
        isActive: true,
      },
      update: {
        accountName: displayName,
        accessToken,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt,
        isActive: true,
      },
    });

    return redirect(request, `success=tiktok&platform=tiktok&name=${encodeURIComponent(displayName)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "TikTok connect failed";
    return redirect(request, `error=${encodeURIComponent(msg)}&platform=tiktok`);
  }
}
