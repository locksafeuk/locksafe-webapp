/**
 * POST /api/admin/customers/send-sms
 *
 * Generic admin endpoint to send an arbitrary SMS to a single phone
 * number via the platform's SMS pipeline (Zadarma primary, Twilio
 * fallback). Used for one-off customer comms — apology messages,
 * "we couldn't fulfil tonight" notices, etc.
 *
 * Defaults to DRY RUN — body must include `{ dryRun: false }` to
 * actually send. Dry run returns the normalized phone + message
 * preview so the admin can confirm before firing.
 *
 * Auth: admin JWT cookie.
 *
 * Body:
 *   {
 *     phone:     string,    // E.164 or UK 07... format
 *     message:   string,    // SMS body (will be sent as-is, no URLs through Zadarma)
 *     jobId?:    string,    // optional — for audit linkage
 *     reason?:   string,    // free-text reason for the SMS (audit)
 *     dryRun?:   boolean,   // default true
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";
import { normalizePhoneNumber } from "@/lib/phone";

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

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    phone?: string;
    message?: string;
    jobId?: string;
    reason?: string;
    dryRun?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const phoneRaw = (body.phone || "").trim();
  const message = (body.message || "").trim();
  const dryRun = body.dryRun !== false;

  if (!phoneRaw) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > 320) {
    // Two SMS segments max — cheap guard.
    return NextResponse.json(
      { error: `message too long (${message.length} chars; max 320)` },
      { status: 400 },
    );
  }

  const phoneNormalized = normalizePhoneNumber(phoneRaw);
  if (!/^\+\d{10,15}$/.test(phoneNormalized)) {
    return NextResponse.json(
      {
        error: `phone format invalid after normalization: "${phoneNormalized}" — expected E.164 (+44...)`,
      },
      { status: 400 },
    );
  }

  if (dryRun) {
    return NextResponse.json({
      mode: "dry_run",
      preview: {
        phoneNormalized,
        phoneRaw,
        message,
        messageLength: message.length,
        smsSegments: Math.ceil(message.length / 160),
        reason: body.reason,
        jobId: body.jobId,
      },
      note: "DRY RUN — no SMS sent. POST again with { dryRun: false } to actually send.",
    });
  }

  // Real send.
  const sendResult = await sendSMS(phoneNormalized, message, {
    logContext: `admin-customer-sms${body.jobId ? `:job=${body.jobId}` : ""}`,
  });

  return NextResponse.json({
    mode: "live_send",
    phoneNormalized,
    sent: sendResult.success,
    error: sendResult.success ? null : sendResult.error,
    reason: body.reason,
    jobId: body.jobId,
  });
}
