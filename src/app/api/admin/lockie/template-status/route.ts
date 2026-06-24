/**
 * GET /api/admin/lockie/template-status
 *
 * Returns WhatsApp template approval status for every TWILIO_CONTENT_SID_*
 * env var. Lets the admin UI show "approved / pending / received / rejected"
 * for each template without leaving the page.
 *
 * §40 (2026-06-24): added for the app_update_nudge_v1 submission flow.
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

interface ApprovalRequest {
  name?: string;
  category?: string;
  status?: string;
  rejection_reason?: string;
  content_type?: string;
}

interface ApprovalListResponse {
  whatsapp?: ApprovalRequest;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured" },
      { status: 500 },
    );
  }

  // Find every TWILIO_CONTENT_SID_* env var; for each, fetch approval status.
  const sidEnvKeys = Object.keys(process.env).filter((k) => k.startsWith("TWILIO_CONTENT_SID_"));
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

  const results = await Promise.all(
    sidEnvKeys.map(async (envKey) => {
      const sid = process.env[envKey];
      if (!sid) return { envKey, sid: null, error: "empty env value" };
      const templateName = envKey
        .replace(/^TWILIO_CONTENT_SID_/, "")
        .toLowerCase();
      try {
        const r = await fetch(
          `https://content.twilio.com/v1/Content/${sid}/ApprovalRequests`,
          { headers: { Authorization: authHeader } },
        );
        if (!r.ok) {
          return {
            envKey,
            templateName,
            sid,
            error: `Twilio ${r.status}`,
          };
        }
        const data = (await r.json()) as ApprovalListResponse;
        const wa = data.whatsapp;
        return {
          envKey,
          templateName,
          sid,
          status: wa?.status ?? "no-request",
          category: wa?.category,
          rejectionReason: wa?.rejection_reason || undefined,
          contentType: wa?.content_type,
        };
      } catch (e) {
        return {
          envKey,
          templateName,
          sid,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );

  return NextResponse.json({
    success: true,
    templates: results,
    totals: {
      total: results.length,
      approved: results.filter((r) => "status" in r && r.status === "approved").length,
      pending: results.filter((r) => "status" in r && (r.status === "pending" || r.status === "received")).length,
      rejected: results.filter((r) => "status" in r && r.status === "rejected").length,
      error: results.filter((r) => "error" in r && r.error).length,
    },
  });
}
