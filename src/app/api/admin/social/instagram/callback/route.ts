/**
 * GET /api/admin/social/instagram/callback
 *
 * Facebook Login OAuth callback for Instagram Business.
 * 1. Exchanges code for short-lived user token
 * 2. Exchanges for long-lived token (60 days)
 * 3. Gets list of Facebook Pages the user manages
 * 4. For each page, checks for a linked Instagram Business Account
 * 5. Saves the Instagram Business Account to SocialAccount DB
 *
 * Query params: code, state
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

const META_API = "https://graph.facebook.com/v19.0";

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
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirect(request, `error=${encodeURIComponent(error)}&platform=instagram`);
  }
  if (!code || !state) {
    return redirect(request, "error=instagram_missing_params&platform=instagram");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("instagram_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return redirect(request, "error=instagram_state_mismatch&platform=instagram");
  }

  const appId     = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return redirect(request, "error=facebook_app_not_configured&platform=instagram");
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk"}/api/admin/social/instagram/callback`;

  try {
    // Step 1: Exchange code for short-lived user access token
    const shortTokenRes = await fetch(
      `${META_API}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(callbackUrl)}&client_secret=${appSecret}&code=${code}`
    );

    if (!shortTokenRes.ok) {
      const err = await shortTokenRes.text();
      return redirect(request, `error=${encodeURIComponent("Token exchange failed: " + err)}&platform=instagram`);
    }

    const shortTokenData = await shortTokenRes.json() as { access_token: string };
    const shortToken = shortTokenData.access_token;

    // Step 2: Exchange short-lived for long-lived token (60 days)
    const longTokenRes = await fetch(
      `${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
    );

    const longTokenData = await longTokenRes.json() as {
      access_token: string;
      expires_in?: number;
      token_type?: string;
    };
    const userToken  = longTokenData.access_token || shortToken;
    const expiresAt  = longTokenData.expires_in
      ? new Date(Date.now() + longTokenData.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

    // Step 3: Get Facebook Pages the user manages
    const pagesRes = await fetch(`${META_API}/me/accounts?access_token=${userToken}`);
    const pagesData = await pagesRes.json() as {
      data?: Array<{ id: string; name: string; access_token: string }>;
    };

    if (!pagesData.data || pagesData.data.length === 0) {
      return redirect(request, "error=no_facebook_pages&platform=instagram");
    }

    let igAccountId  = "";
    let igPageToken  = "";
    let igPageId     = "";
    let igPageName   = "";

    // Step 4: Find the page with an Instagram Business Account
    for (const page of pagesData.data) {
      const igRes = await fetch(
        `${META_API}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igRes.json() as {
        instagram_business_account?: { id: string };
      };

      if (igData.instagram_business_account?.id) {
        igAccountId = igData.instagram_business_account.id;
        igPageToken = page.access_token;
        igPageId    = page.id;
        igPageName  = page.name;
        break;
      }
    }

    if (!igAccountId) {
      return redirect(request, "error=no_instagram_business_account&platform=instagram");
    }

    // Step 5: Get Instagram account details
    const igDetailsRes = await fetch(
      `${META_API}/${igAccountId}?fields=username,name,profile_picture_url&access_token=${igPageToken}`
    );
    const igDetails = await igDetailsRes.json() as {
      username?: string;
      name?: string;
      profile_picture_url?: string;
    };

    // Upsert SocialAccount
    await prisma.socialAccount.upsert({
      where: { platform_accountId: { platform: "INSTAGRAM", accountId: igAccountId } },
      create: {
        platform:       "INSTAGRAM",
        accountId:      igAccountId,
        accountName:    igDetails.name || igPageName,
        accountHandle:  igDetails.username ? `@${igDetails.username}` : undefined,
        profileImage:   igDetails.profile_picture_url || undefined,
        accessToken:    userToken,
        tokenExpiresAt: expiresAt,
        pageId:         igPageId,
        pageAccessToken: igPageToken,
        isActive:       true,
      },
      update: {
        accountName:    igDetails.name || igPageName,
        accountHandle:  igDetails.username ? `@${igDetails.username}` : undefined,
        profileImage:   igDetails.profile_picture_url || undefined,
        accessToken:    userToken,
        tokenExpiresAt: expiresAt,
        pageId:         igPageId,
        pageAccessToken: igPageToken,
        isActive:       true,
      },
    });

    // Deactivate placeholder
    await prisma.socialAccount.updateMany({
      where: { platform: "INSTAGRAM", accountId: "PLACEHOLDER_ACCOUNT_ID" },
      data: { isActive: false },
    });

    console.log(`[Instagram Connect] Connected IG account ${igAccountId} (@${igDetails.username}) via page ${igPageId}`);

    const res = redirect(
      request,
      `success=instagram&platform=instagram&handle=${encodeURIComponent("@" + (igDetails.username || igAccountId))}`
    );
    res.cookies.delete("instagram_oauth_state");
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Instagram OAuth callback failed";
    console.error("[Instagram Callback]", msg);
    return redirect(request, `error=${encodeURIComponent(msg)}&platform=instagram`);
  }
}
