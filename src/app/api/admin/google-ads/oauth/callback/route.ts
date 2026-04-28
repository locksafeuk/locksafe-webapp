/**
 * GET /api/admin/google-ads/oauth/callback
 *
 * Handles the OAuth redirect from Google. Exchanges the `code` for a refresh
 * token and persists it on a GoogleAdsAccount row. Verifies CSRF via the
 * `state` parameter against the cookie set by /oauth/start.
 *
 * Query params: code, state, error?, scope?
 *
 * After exchange, we don't yet know which Google Ads customer the admin
 * intends to manage with this token (one OAuth grant can access many).
 * Strategy: store the credentials in a GoogleAdsAccount row keyed by the
 * MCC's GOOGLE_ADS_LOGIN_CUSTOMER_ID env var as a placeholder customerId,
 * then redirect to /admin/integrations/google-ads where the admin picks
 * which customer account to actually sync.
 *
 * For Phase 1 we keep it simple: if GOOGLE_ADS_LOGIN_CUSTOMER_ID is set we
 * also use it as the customerId for the connected account row (single-account
 * setups). Multi-customer selection lands in Phase 2.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { exchangeAuthCode } from "@/lib/google-ads";
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return redirectToAdmin(`error=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return redirectToAdmin("error=missing_code_or_state");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_ads_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return redirectToAdmin("error=state_mismatch");
  }

  const redirectUri = process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI;
  if (!redirectUri) {
    return redirectToAdmin("error=redirect_uri_not_configured");
  }

  const mccId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (!mccId) {
    return redirectToAdmin("error=login_customer_id_not_configured");
  }

  try {
    const tokens = await exchangeAuthCode(code, redirectUri);

    // Phase 1 single-account assumption: customerId = MCC ID. The account
    // selection UI in Phase 2 will let the admin add per-customer rows.
    const customerId = mccId;

    await prisma.googleAdsAccount.upsert({
      where: { customerId },
      create: {
        customerId,
        loginCustomerId: mccId,
        name: `Google Ads (${customerId})`,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        tokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope ?? null,
        isActive: true,
      },
      update: {
        loginCustomerId: mccId,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        tokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope ?? null,
        isActive: true,
      },
    });

    const res = redirectToAdmin("connected=1");
    res.cookies.delete("google_ads_oauth_state");
    return res;
  } catch (err) {
    console.error("[GoogleAds OAuth] callback failed:", err);
    return redirectToAdmin(
      `error=${encodeURIComponent(err instanceof Error ? err.message : "exchange_failed")}`,
    );
  }
}

function redirectToAdmin(query: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";
  return NextResponse.redirect(`${base}/admin/integrations/google-ads?${query}`);
}
