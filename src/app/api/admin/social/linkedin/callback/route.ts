/**
 * GET /api/admin/social/linkedin/callback
 *
 * LinkedIn OAuth 2.0 callback. Exchanges code for access token,
 * fetches the organization the admin manages, saves to SocialAccount DB.
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
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirect(request, `error=${encodeURIComponent(error)}&platform=linkedin`);
  }
  if (!code || !state) {
    return redirect(request, "error=linkedin_missing_params&platform=linkedin");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("linkedin_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return redirect(request, "error=linkedin_state_mismatch&platform=linkedin");
  }

  const clientId     = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirect(request, "error=linkedin_app_not_configured&platform=linkedin");
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk"}/api/admin/social/linkedin/callback`;

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  callbackUrl,
        client_id:     clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return redirect(request, `error=${encodeURIComponent("Token exchange failed: " + err)}&platform=linkedin`);
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    const accessToken = tokenData.access_token;
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Get authenticated member's profile
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json() as { sub: string; name?: string; picture?: string };

    // Get organizations this member administers
    const orgRes = await fetch(
      "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName,logoV2(original~:playableStreams))))",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    let orgId   = "";
    let orgName = "LockSafe UK";
    let orgHandle = "";

    if (orgRes.ok) {
      const orgData = await orgRes.json() as {
        elements?: Array<{
          organization?: string;
          "organization~"?: { id: number; localizedName: string };
        }>;
      };
      const first = orgData.elements?.[0];
      if (first) {
        const orgUrn = first.organization || "";
        // URN format: urn:li:organization:XXXXXXX
        orgId   = orgUrn.split(":").pop() || "";
        orgName = first["organization~"]?.localizedName || "LockSafe UK";
        orgHandle = `linkedin.com/company/${orgId}`;
      }
    }

    // Fall back to member URN if no org found
    if (!orgId) {
      orgId = profile.sub || "unknown";
      orgName = profile.name || "LockSafe UK";
      orgHandle = "linkedin.com/in/me";
    }

    // Upsert SocialAccount in DB
    await prisma.socialAccount.upsert({
      where: { platform_accountId: { platform: "LINKEDIN", accountId: orgId } },
      create: {
        platform:      "LINKEDIN",
        accountId:     orgId,
        accountName:   orgName,
        accountHandle: orgHandle,
        accessToken,
        refreshToken:  tokenData.refresh_token || null,
        tokenExpiresAt: expiresAt,
        isActive:      true,
      },
      update: {
        accountName:   orgName,
        accountHandle: orgHandle,
        accessToken,
        refreshToken:  tokenData.refresh_token || null,
        tokenExpiresAt: expiresAt,
        isActive:      true,
      },
    });

    // Deactivate placeholder records
    await prisma.socialAccount.updateMany({
      where: { platform: "LINKEDIN", accountId: "PLACEHOLDER_ORG_ID" },
      data: { isActive: false },
    });

    console.log(`[LinkedIn Connect] Connected org: ${orgName} (${orgId})`);

    const res = redirect(request, `success=linkedin&platform=linkedin&name=${encodeURIComponent(orgName)}`);
    res.cookies.delete("linkedin_oauth_state");
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LinkedIn OAuth callback failed";
    console.error("[LinkedIn Callback]", msg);
    return redirect(request, `error=${encodeURIComponent(msg)}&platform=linkedin`);
  }
}
