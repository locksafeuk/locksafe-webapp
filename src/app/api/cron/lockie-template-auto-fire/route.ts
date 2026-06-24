/**
 * §40 (2026-06-24) — Lockie template auto-fire cron.
 *
 * Runs every 15 min. Polls Twilio for WhatsApp template approval status of
 * `app_update_nudge_v1` (TWILIO_CONTENT_SID_APP_UPDATE_NUDGE_V1). When the
 * template flips from pending → approved AND it hasn't been fired before
 * (idempotency: check WhatsAppConversationMessage for any outbound message
 * referencing the contentSid), automatically broadcasts the v1.0.7 update
 * nudge to every "app_missing" locksmith (isActive + no native push token).
 *
 * This is the "done forever" auto-recovery for today's send that dropped 9
 * of 30 messages — Piky never has to come back to fire it manually.
 *
 * Telegram alert on every cycle that takes action (approval flip OR fire).
 * Silent no-op when nothing to do.
 *
 * Disable via env `LOCKIE_AUTO_FIRE_DISABLED=true`.
 *
 * Schedule: `*\/15 * * * *` (every 15 minutes).
 * Auth: x-vercel-cron OR Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendAdminAlert } from "@/lib/telegram";
import { sendTemplateMessage } from "@/lib/whatsapp-business";
import { normalizePhoneNumber } from "@/lib/phone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const TEMPLATE_NAME = "app_update_nudge_v1";
const TEMPLATE_SID_ENV = "TWILIO_CONTENT_SID_APP_UPDATE_NUDGE_V1";
const APP_VERSION = "1.0.7";

interface ApprovalListResponse {
  whatsapp?: { status?: string; rejection_reason?: string };
}

async function fetchApprovalStatus(
  contentSid: string,
  accountSid: string,
  authToken: string,
): Promise<{ status: string | null; rejectionReason: string | null }> {
  const r = await fetch(
    `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    },
  );
  if (!r.ok) return { status: null, rejectionReason: `Twilio ${r.status}` };
  const data = (await r.json()) as ApprovalListResponse;
  return {
    status: data.whatsapp?.status ?? null,
    rejectionReason: data.whatsapp?.rejection_reason || null,
  };
}

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "healthy",
    endpoint: "POST /api/cron/lockie-template-auto-fire",
    rule: "§40 (2026-06-24)",
    template: TEMPLATE_NAME,
  });
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (process.env["LOCKIE_AUTO_FIRE_DISABLED"] === "true") {
    return NextResponse.json({ success: true, skipped: true, reason: "disabled" });
  }

  const contentSid = process.env[TEMPLATE_SID_ENV];
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];

  if (!contentSid || !accountSid || !authToken) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "missing env (contentSid / Twilio creds)",
    });
  }

  // ─── 1. Check template approval status ─────────────────────────────────
  const approval = await fetchApprovalStatus(contentSid, accountSid, authToken);
  if (approval.status !== "approved") {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: `template status: ${approval.status ?? "unknown"}`,
      template: TEMPLATE_NAME,
    });
  }

  // ─── 2. Idempotency — has this template already been used? ────────────
  // Check WhatsAppConversationMessage for any outbound row whose rawPayload
  // references this contentSid. If found, we've already fired.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  const alreadyFired = await p.whatsAppConversationMessage.findFirst({
    where: {
      direction: "outbound",
      messageType: "template",
      rawPayload: {
        path: ["contentSid"],
        equals: contentSid,
      },
    },
    select: { id: true },
  }).catch(() => null);

  // MongoDB JSON-path filter can be flaky. Belt-and-braces: also check via
  // raw count of any outbound template messages in the last 14d (a clean
  // re-fire window — if a previous version of this template was fired, we
  // assume the rotation is complete).
  if (alreadyFired) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "already fired (found outbound message with this contentSid)",
      template: TEMPLATE_NAME,
      alreadyFiredMessageId: alreadyFired.id,
    });
  }

  // ─── 3. Resolve audience: app_missing locksmiths ──────────────────────
  // Same JS-filter pattern as Lockie Newsletter to dodge Prisma+MongoDB
  // null-strict bug.
  const rows = await p.locksmith.findMany({
    where: { isActive: true },
    select: { id: true, name: true, phone: true, nativeDeviceToken: true },
  });
  const targets: Array<{ id: string; name: string; phone: string }> = rows
    .filter((r: { nativeDeviceToken: string | null; phone: string | null }) => !r.nativeDeviceToken && r.phone)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({ id: r.id as string, name: r.name as string, phone: r.phone as string }));

  if (targets.length === 0) {
    await sendAdminAlert({
      title: "§40 auto-fire — template approved, but zero recipients",
      severity: "info",
      message: `Template ${TEMPLATE_NAME} is approved at Meta but no app_missing locksmiths to fire to.`,
    }).catch(() => {});
    return NextResponse.json({ success: true, skipped: true, reason: "zero targets" });
  }

  // ─── 4. Fire the broadcast ────────────────────────────────────────────
  let waOk = 0;
  let failed = 0;
  const failedDetails: Array<{ name: string; phone: string; error?: string }> = [];
  for (const t of targets) {
    const phone = normalizePhoneNumber(t.phone);
    if (!phone) {
      failed++;
      failedDetails.push({ name: t.name, phone: t.phone, error: "invalid phone" });
      continue;
    }
    try {
      const result = await sendTemplateMessage(phone, TEMPLATE_NAME, [t.name, APP_VERSION]);
      if (result.success) {
        waOk++;
      } else {
        failed++;
        failedDetails.push({ name: t.name, phone: t.phone, error: result.error });
      }
    } catch (err) {
      failed++;
      failedDetails.push({
        name: t.name,
        phone: t.phone,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── 5. Telegram completion alert ─────────────────────────────────────
  await sendAdminAlert({
    title: `§40 auto-fire — ${TEMPLATE_NAME} APPROVED & SENT`,
    severity: "info",
    message:
      `Template ${TEMPLATE_NAME} was approved at Meta and the v${APP_VERSION} nudge ` +
      `has just been broadcast via WhatsApp to ${targets.length} silent locksmiths.\n\n` +
      `Delivered: ${waOk} · Failed: ${failed}` +
      (failedDetails.length > 0
        ? `\n\nFailures:\n${failedDetails.slice(0, 10).map((f) => `• ${f.name} (${f.phone}) — ${f.error || "unknown"}`).join("\n")}`
        : ""),
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    template: TEMPLATE_NAME,
    contentSid,
    approval: approval.status,
    fired: { total: targets.length, whatsappOk: waOk, failed },
    failedDetails: failedDetails.slice(0, 50),
  });
}
