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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  // ─── 2. Resolve audience: app_missing locksmiths ──────────────────────
  // JS-filter on nativeDeviceToken to dodge the Prisma+MongoDB null-vs-missing
  // bug (a bare `{ nativeDeviceToken: null }` misses unset-field docs).
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

  // ─── 3. Per-recipient idempotency — send only to the unsent remainder ──
  // TemplateBroadcastDelivery is the source of truth for "who already got it".
  // The unique (broadcastKey, recipientId) makes each send atomic, so this is
  // safe under concurrent and retried cron runs: no double-send, and a partial
  // broadcast resumes (instead of the old findFirst marker that locked out the
  // rest after the first recipient was recorded).
  const broadcastKey = contentSid;
  const sentRows: Array<{ recipientId: string }> = await p.templateBroadcastDelivery.findMany({
    where: { broadcastKey, status: "sent" },
    select: { recipientId: true },
  });
  const sentIds = new Set(sentRows.map((d) => d.recipientId));
  const remainder = targets.filter((t) => !sentIds.has(t.id));

  if (remainder.length === 0) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "already fired to all recipients",
      template: TEMPLATE_NAME,
      alreadySent: sentIds.size,
    });
  }

  // ─── 4. Fire to the remainder ─────────────────────────────────────────
  let waOk = 0;
  let failed = 0;
  let skippedClaimed = 0;
  const failedDetails: Array<{ name: string; phone: string; error?: string }> = [];
  for (const t of remainder) {
    // Atomic claim. A unique-constraint violation means another concurrent run
    // (or an earlier success) already owns this recipient — skip it.
    let claimId: string | null = null;
    try {
      const claim = await p.templateBroadcastDelivery.create({
        data: { broadcastKey, recipientId: t.id, status: "pending" },
        select: { id: true },
      });
      claimId = claim.id as string;
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        skippedClaimed++;
        continue;
      }
      throw e;
    }

    const phone = normalizePhoneNumber(t.phone);
    if (!phone) {
      // Release the claim so a corrected record can be retried later.
      await p.templateBroadcastDelivery.delete({ where: { id: claimId } }).catch(() => {});
      failed++;
      failedDetails.push({ name: t.name, phone: t.phone, error: "invalid phone" });
      continue;
    }
    try {
      const result = await sendTemplateMessage(phone, TEMPLATE_NAME, [t.name, APP_VERSION]);
      if (result.success) {
        await p.templateBroadcastDelivery
          .update({
            where: { id: claimId },
            data: { status: "sent", providerMessageId: result.messageId ?? null },
          })
          .catch(() => {});
        waOk++;
      } else {
        // Failed send — release the claim so a later run retries this recipient.
        await p.templateBroadcastDelivery.delete({ where: { id: claimId } }).catch(() => {});
        failed++;
        failedDetails.push({ name: t.name, phone: t.phone, error: result.error });
      }
    } catch (err) {
      await p.templateBroadcastDelivery.delete({ where: { id: claimId } }).catch(() => {});
      failed++;
      failedDetails.push({
        name: t.name,
        phone: t.phone,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── 5. Telegram completion alert (only when this run took action) ─────
  if (waOk > 0 || failed > 0) {
    await sendAdminAlert({
      title: `§40 auto-fire — ${TEMPLATE_NAME} APPROVED & SENT`,
      severity: "info",
      message:
        `Template ${TEMPLATE_NAME} approved at Meta. v${APP_VERSION} nudge fired this run.\n\n` +
        `Sent now: ${waOk} · Failed: ${failed}` +
        (sentIds.size > 0 ? ` · Previously sent: ${sentIds.size}` : "") +
        (skippedClaimed > 0 ? ` · Claimed by concurrent run: ${skippedClaimed}` : "") +
        (failedDetails.length > 0
          ? `\n\nFailures:\n${failedDetails.slice(0, 10).map((f) => `• ${f.name} (${f.phone}) — ${f.error || "unknown"}`).join("\n")}`
          : ""),
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    template: TEMPLATE_NAME,
    contentSid,
    approval: approval.status,
    fired: {
      remainder: remainder.length,
      whatsappOk: waOk,
      failed,
      skippedClaimed,
      previouslySent: sentIds.size,
    },
    failedDetails: failedDetails.slice(0, 50),
  });
}
