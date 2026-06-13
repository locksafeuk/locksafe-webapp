/**
 * GET /api/admin/microsoft-ads/oauth-callback
 *
 * Receives the redirect from Microsoft's OAuth consent screen with
 * ?code=… (authorization code) and ?state=… (CSRF token we issued).
 *
 * Exchanges the code for an access_token + refresh_token via the
 * MS Identity Platform token endpoint, then redirects the admin to
 * /admin/microsoft-ads/connect?token=<one-time-id> so the connect
 * page can display the refresh_token ONCE for them to paste into
 * Vercel as MICROSOFT_ADS_REFRESH_TOKEN.
 *
 * The refresh token is stored in an HTTP-only signed cookie for
 * exactly one minute. It is NEVER persisted to the database — we
 * want Vercel env vars to remain the single source of truth.
 *
 * Auth: must arrive with a valid admin JWT cookie AND a matching
 *       oauth-state cookie set by the /connect page when it
 *       initiated the flow. CSRF rejects if either is missing.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { exchangeMicrosoftOAuthCode } from "@/lib/microsoft-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const c = await cookies();
  const t = c.get("auth_token")?.value;
  if (!t) return null;
  const p = await verifyToken(t);
  return p?.type === "admin" ? p : null;
}

function callbackRedirectUri(request: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
  return `${base.replace(/\/$/, "")}/api/admin/microsoft-ads/oauth-callback`;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url   = new URL(request.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/microsoft-ads/connect?err=${encodeURIComponent(errDesc ?? error)}`, request.url),
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/microsoft-ads/connect?err=missing_code", request.url),
    );
  }

  // CSRF — the /connect page set an HTTP-only cookie before redirecting.
  const c = await cookies();
  const expectedState = c.get("ms_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(
      new URL("/admin/microsoft-ads/connect?err=state_mismatch", request.url),
    );
  }

  const clientId     = process.env.MICROSOFT_ADS_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_ADS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/admin/microsoft-ads/connect?err=missing_client_creds", request.url),
    );
  }

  const exchange = await exchangeMicrosoftOAuthCode({
    clientId,
    clientSecret,
    code,
    redirectUri: callbackRedirectUri(request),
  });
  if ("error" in exchange) {
    return NextResponse.redirect(
      new URL(`/admin/microsoft-ads/connect?err=${encodeURIComponent(exchange.error)}`, request.url),
    );
  }

  // Drop the refresh_token in a 60-second HTTP-only cookie so the
  // /connect page can display it once. Never written to DB.
  const response = NextResponse.redirect(
    new URL("/admin/microsoft-ads/connect?got=1", request.url),
  );
  response.cookies.set("ms_oauth_refresh", exchange.refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60,
    path:     "/admin/microsoft-ads",
  });
  // Clear the state cookie — it has done its job.
  response.cookies.set("ms_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}
