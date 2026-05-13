/**
 * GET  /api/admin/google-ads/config  — retrieve current API credentials (secrets masked)
 * PUT  /api/admin/google-ads/config  — save / update credentials
 *
 * Admin-only. Stores the Google Ads API keys in the DB so admins don't need
 * to edit environment variables or touch the Vercel dashboard.
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

function maskSecret(s: string): string {
  if (!s || s.length < 8) return "••••••••";
  return s.slice(0, 4) + "••••••••" + s.slice(-4);
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = await prisma.googleAdsApiConfig.findUnique({ where: { key: "default" } });

  if (!cfg) {
    return NextResponse.json({ configured: false, config: null });
  }

  return NextResponse.json({
    configured: true,
    config: {
      id: cfg.id,
      developerToken: maskSecret(cfg.developerToken),
      oauthClientId: cfg.oauthClientId,            // not a secret, safe to expose
      oauthClientSecret: maskSecret(cfg.oauthClientSecret),
      loginCustomerId: cfg.loginCustomerId,
      redirectUri: cfg.redirectUri,
      updatedAt: cfg.updatedAt,
    },
  });
}

interface ConfigBody {
  developerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  loginCustomerId?: string;
  redirectUri?: string;
}

export async function PUT(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ConfigBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { developerToken, oauthClientId, oauthClientSecret, loginCustomerId, redirectUri } = body;

  // Validate required fields only when not doing a partial update
  const existing = await prisma.googleAdsApiConfig.findUnique({ where: { key: "default" } });

  const merged = {
    developerToken:    developerToken    ?? existing?.developerToken    ?? "",
    oauthClientId:     oauthClientId     ?? existing?.oauthClientId     ?? "",
    oauthClientSecret: oauthClientSecret ?? existing?.oauthClientSecret ?? "",
    loginCustomerId:   loginCustomerId   ?? existing?.loginCustomerId   ?? "",
    redirectUri:       redirectUri       ?? existing?.redirectUri       ?? "",
  };

  const missing = (Object.entries(merged) as [string, string][])
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  // Sanitise customer ID: strip dashes, ensure numeric
  merged.loginCustomerId = merged.loginCustomerId.replace(/-/g, "");
  if (!/^\d{8,12}$/.test(merged.loginCustomerId)) {
    return NextResponse.json(
      { error: "loginCustomerId must be a 8–12 digit numeric customer ID" },
      { status: 400 },
    );
  }

  const cfg = await prisma.googleAdsApiConfig.upsert({
    where: { key: "default" },
    create: { key: "default", ...merged },
    update: merged,
  });

  return NextResponse.json({
    ok: true,
    config: {
      id: cfg.id,
      oauthClientId: cfg.oauthClientId,
      loginCustomerId: cfg.loginCustomerId,
      redirectUri: cfg.redirectUri,
      updatedAt: cfg.updatedAt,
    },
  });
}
