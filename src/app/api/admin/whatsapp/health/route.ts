/**
 * GET /api/admin/whatsapp/health
 *
 * Active health check for the WhatsApp Cloud API integration. Pings
 * Meta's Graph API with the current token + phone number ID to confirm:
 *   - WHATSAPP_ACCESS_TOKEN is valid and not expired
 *   - Token has the right scopes to read the phone number
 *   - WHATSAPP_PHONE_NUMBER_ID matches the token's permitted scope
 *   - WhatsApp Business Account ID is reachable via the token
 *
 * Read-only — does NOT send any message. Safe to call repeatedly.
 *
 * Auth: admin JWT cookie.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

const GRAPH = "https://graph.facebook.com/v18.0";

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !phoneNumberId || !businessAccountId) {
    return NextResponse.json({
      ok: false,
      stage: "config",
      error: "Missing WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_BUSINESS_ACCOUNT_ID env var",
    });
  }

  const checks: Record<string, unknown> = {};

  // 1. Ping the phone number — requires whatsapp_business_messaging or
  //    whatsapp_business_management scope on the token.
  try {
    const url = `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,name_status&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const body = await res.json();
    checks.phoneNumber = {
      httpStatus: res.status,
      ok: res.ok,
      data: res.ok ? body : undefined,
      error: !res.ok ? body : undefined,
    };
  } catch (err) {
    checks.phoneNumber = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // 2. Ping the WhatsApp Business Account — requires whatsapp_business_management scope.
  try {
    const url = `${GRAPH}/${businessAccountId}?fields=name,timezone_id,message_template_namespace&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const body = await res.json();
    checks.businessAccount = {
      httpStatus: res.status,
      ok: res.ok,
      data: res.ok ? body : undefined,
      error: !res.ok ? body : undefined,
    };
  } catch (err) {
    checks.businessAccount = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // 3. Optional: list approved message templates so admin sees what's
  //    available for cold-outreach sends. Read-only.
  try {
    const url = `${GRAPH}/${businessAccountId}/message_templates?fields=name,language,status,category&limit=50&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const body = await res.json();
    checks.templates = {
      httpStatus: res.status,
      ok: res.ok,
      count: res.ok ? (body.data?.length ?? 0) : undefined,
      templates: res.ok ? body.data : undefined,
      error: !res.ok ? body : undefined,
    };
  } catch (err) {
    checks.templates = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allOk = Object.values(checks).every((c: any) => c && c.ok);

  return NextResponse.json({
    ok: allOk,
    checks,
    webhookUrl: "https://www.locksafe.uk/api/webhooks/whatsapp",
    note: "If phoneNumber or businessAccount check fails with code=190 or OAuthException → token is expired/invalid, generate fresh one from Meta.",
  });
}
