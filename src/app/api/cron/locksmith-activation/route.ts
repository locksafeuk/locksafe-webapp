/**
 * /api/cron/locksmith-activation — Autonomous locksmith activation agent.
 *
 * The problem this solves: most onboarded locksmiths are NOT dispatch-ready
 * (no base postcode, no call-out fee, Stripe incomplete, offline…), so jobs go
 * unassigned even where supply "exists". This cron finds blocked locksmiths and
 * nudges them — closest-to-live first — to finish the exact steps that unlock
 * job dispatch, then stops the moment they go live.
 *
 * Channels (per the chosen strategy): WhatsApp-first → SMS → email fallback.
 * WhatsApp business-initiated messages require an approved template — here the
 * existing Twilio Content template "profile_incomplete_v1" (resolved via
 * TWILIO_CONTENT_SID_PROFILE_INCOMPLETE_V1). It invites them to chat; the bot
 * then tells them exactly what's missing (see locksmith-bot "setup"/"profile").
 * SMS/email carry the full free-form breakdown.
 *
 * SAFETY: OFF by default. Set LOCKSMITH_ACTIVATION_ENABLED=true to turn on.
 * Per-run cap, cooldown between touches, honors opt-out, escalates stalls to
 * Telegram, and sends a "you're live" confirmation when a locksmith activates.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import { sendSMS } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { sendTemplateMessage } from "@/lib/whatsapp-business";
import { sendAdminAlert } from "@/lib/telegram";
import { computeCompleteness, COMPLETENESS_SELECT } from "@/lib/locksmith-completeness";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Gating + tunables ────────────────────────────────────────────────────────
const ENABLED = (process.env.LOCKSMITH_ACTIVATION_ENABLED ?? "false").toLowerCase() === "true";
const clampInt = (v: string | undefined, def: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number(v ?? String(def)) || def));
const MAX_PER_RUN = clampInt(process.env.LOCKSMITH_ACTIVATION_MAX_PER_RUN, 30, 1, 200);
const COOLDOWN_DAYS = clampInt(process.env.LOCKSMITH_ACTIVATION_COOLDOWN_DAYS, 3, 1, 30);
const ESCALATE_AFTER = clampInt(process.env.LOCKSMITH_ACTIVATION_ESCALATE_AFTER, 3, 1, 10);
// Resolves to your existing Twilio Content template via
// TWILIO_CONTENT_SID_PROFILE_INCOMPLETE_V1 (already created + approved).
const WA_TEMPLATE = process.env.LOCKSMITH_ACTIVATION_WA_TEMPLATE || "profile_incomplete_v1";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";

function isUKMobile(phone: string | null): boolean {
  if (!phone) return false;
  const c = phone.replace(/[^\d+]/g, "");
  return /^07\d{9}$/.test(c) || /^\+?447\d{9}$/.test(c) || /^00447\d{9}$/.test(c);
}

// ── Human labels + action links for each blocking gap ────────────────────────
const SETTINGS = `${SITE}/locksmith/settings`;
const EARNINGS = `${SITE}/locksmith/earnings`;
const GAP: Record<string, { label: string; link: string }> = {
  terms: { label: "Accept the terms & conditions", link: SETTINGS },
  base_location: { label: "Set your base postcode (so we can match you to nearby jobs)", link: SETTINGS },
  callout_fee: { label: "Set your call-out fee", link: SETTINGS },
  stripe: { label: "Connect payouts (Stripe)", link: EARNINGS },
  not_available: { label: "Switch yourself to Available", link: SETTINGS },
  not_active: { label: "Reactivate your account", link: SETTINGS },
  insurance_expired: { label: "Renew your insurance", link: SETTINGS },
};

type Row = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  isAvailable: boolean;
  insuranceStatus: string;
  lastActivationNudgeAt: Date | null;
  activationNudgeCount: number;
  activationOptedOut: boolean;
  activationCompletedAt: Date | null;
} & Record<string, unknown>;

function blockingGaps(l: Row): string[] {
  const c = computeCompleteness(l as never);
  const gaps = c.missing.filter((m) => m.blocking).map((m) => m.key);
  if (!l.isActive) gaps.push("not_active");
  if (!l.isAvailable) gaps.push("not_available");
  if (l.insuranceStatus === "expired") gaps.push("insurance_expired");
  return gaps;
}
function isDispatchable(l: Row): boolean {
  return blockingGaps(l).length === 0;
}

function buildDetailedMessage(name: string | null, gaps: string[]): string {
  const firstName = (name ?? "there").split(/\s+/)[0];
  const lines = gaps.map((g, i) => `${i + 1}. ${GAP[g]?.label ?? g}`).join("\n");
  const link = GAP[gaps[0]]?.link ?? SETTINGS;
  const n = gaps.length;
  return (
    `Hi ${firstName}, it's LockSafe UK. You're nearly live — ${n} step${n > 1 ? "s" : ""} left ` +
    `before we can send you paid jobs:\n${lines}\n\nFinish here: ${link}\n\nReply STOP to opt out.`
  );
}
function buildLiveConfirmation(name: string | null): string {
  const firstName = (name ?? "there").split(/\s+/)[0];
  return (
    `✅ You're live, ${firstName}! Your LockSafe profile is complete and you can now receive paid jobs. ` +
    `Make sure you're set to Available, and keep an eye out — jobs in your area will come straight to you.`
  );
}

/** Try WhatsApp template → SMS → email. Returns the channel used, or null. */
async function sendNudge(l: Row, detailed: string, gaps: string[]): Promise<string | null> {
  const firstName = (l.name ?? "there").split(/\s+/)[0];
  // 1. WhatsApp (approved Twilio Content template; the bot delivers the specific
  //    missing-steps breakdown when they reply). sendTemplateMessage returns
  //    success:false if the provider/Content SID isn't set up, so we fall
  //    through to SMS cleanly — no need to pre-check provider config here.
  if (isUKMobile(l.phone)) {
    try {
      // profile_incomplete_v1 has THREE variables: {{1}} first name,
      // {{2}} number of steps left, {{3}} the next step to do. Sending the
      // wrong number of variables is Twilio Error 63024 (invalid template
      // parameters), which is exactly what the messaging watchdog caught.
      const waVars = [firstName, String(gaps.length), GAP[gaps[0]]?.label ?? "finishing your setup"];
      const r = await sendTemplateMessage(l.phone!, WA_TEMPLATE, waVars);
      if (r.success) return "whatsapp";
    } catch { /* fall through */ }
  }
  // 2. SMS (full detail)
  if (isUKMobile(l.phone)) {
    try {
      const r = await sendSMS(l.phone!, detailed, { logContext: `activation:${l.id}` });
      if (r.success) return "sms";
    } catch { /* fall through */ }
  }
  // 3. Email (full detail)
  if (l.email) {
    try {
      await sendEmail({
        to: l.email,
        subject: "You're nearly live on LockSafe — a couple of quick steps",
        html: `<p>${detailed.replace(/\n/g, "<br/>")}</p>`,
      });
      return "email";
    } catch { /* fall through */ }
  }
  return null;
}

async function sendConfirmation(l: Row): Promise<boolean> {
  const msg = buildLiveConfirmation(l.name);
  if (isUKMobile(l.phone)) {
    try { const r = await sendSMS(l.phone!, msg, { logContext: `activation-live:${l.id}` }); if (r.success) return true; } catch { /* */ }
  }
  if (l.email) {
    try { await sendEmail({ to: l.email, subject: "✅ You're live on LockSafe", html: `<p>${msg}</p>` }); return true; } catch { /* */ }
  }
  return false;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ENABLED) {
    return NextResponse.json({ status: "disabled", message: "LOCKSMITH_ACTIVATION_ENABLED is not true" });
  }

  const locksmiths = (await (prisma as unknown as {
    locksmith: { findMany: (a: unknown) => Promise<Row[]> };
  }).locksmith.findMany({
    select: {
      id: true, name: true, phone: true, email: true,
      isActive: true, isAvailable: true,
      lastActivationNudgeAt: true, activationNudgeCount: true,
      activationOptedOut: true, activationCompletedAt: true,
      ...COMPLETENESS_SELECT, // includes insuranceStatus
    },
  })) as Row[];

  const now = Date.now();
  const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  // ── Phase A: confirm anyone who became dispatch-ready since we nudged them ──
  let confirmed = 0;
  for (const l of locksmiths) {
    if (l.lastActivationNudgeAt && !l.activationCompletedAt && isDispatchable(l)) {
      const ok = await sendConfirmation(l);
      await (prisma as unknown as { locksmith: { update: (a: unknown) => Promise<unknown> } })
        .locksmith.update({ where: { id: l.id }, data: { activationCompletedAt: new Date() } });
      if (ok) confirmed++;
    }
  }

  // ── Phase B: nudge blocked locksmiths, closest-to-live first ────────────────
  const candidates = locksmiths
    .filter((l) => !l.activationOptedOut)
    .map((l) => ({ l, gaps: blockingGaps(l) }))
    .filter(({ gaps }) => gaps.length > 0)
    .filter(({ l }) => !l.lastActivationNudgeAt || now - new Date(l.lastActivationNudgeAt).getTime() > cooldownMs)
    .sort((a, b) => a.gaps.length - b.gaps.length); // fewest gaps = closest to live

  const batch = candidates.slice(0, MAX_PER_RUN);

  const byChannel: Record<string, number> = { whatsapp: 0, sms: 0, email: 0 };
  let nudged = 0;
  let unreachable = 0;
  const escalations: string[] = [];

  for (const { l, gaps } of batch) {
    const detailed = buildDetailedMessage(l.name, gaps);
    const channel = await sendNudge(l, detailed, gaps);
    if (!channel) { unreachable++; continue; }

    byChannel[channel] = (byChannel[channel] ?? 0) + 1;
    nudged++;
    const newCount = (l.activationNudgeCount ?? 0) + 1;
    await (prisma as unknown as { locksmith: { update: (a: unknown) => Promise<unknown> } })
      .locksmith.update({
        where: { id: l.id },
        data: { lastActivationNudgeAt: new Date(), activationNudgeCount: newCount },
      });

    if (newCount >= ESCALATE_AFTER) {
      escalations.push(`${l.name ?? l.id} (${newCount} touches, still missing: ${gaps.join(", ")})`);
    }
  }

  const dispatchReadyNow = locksmiths.filter(isDispatchable).length;

  // ── Digest + escalation ─────────────────────────────────────────────────────
  if (nudged > 0 || confirmed > 0 || escalations.length > 0) {
    await sendAdminAlert({
      title: "🔧 Locksmith Activation",
      message:
        `Nudged ${nudged} (WA ${byChannel.whatsapp}/SMS ${byChannel.sms}/email ${byChannel.email})` +
        `${unreachable ? ` · unreachable ${unreachable}` : ""}\n` +
        `Newly live confirmations: ${confirmed}\n` +
        `Dispatch-ready now: ${dispatchReadyNow}/${locksmiths.length}` +
        (escalations.length ? `\n\n⚠️ Stalled (need a human):\n• ${escalations.join("\n• ")}` : ""),
      severity: escalations.length ? "warning" : "info",
    });
  }

  return NextResponse.json({
    status: "ran",
    totalLocksmiths: locksmiths.length,
    dispatchReadyNow,
    blocked: locksmiths.length - dispatchReadyNow,
    nudged,
    byChannel,
    unreachable,
    confirmed,
    escalations: escalations.length,
    candidatesRemaining: Math.max(0, candidates.length - batch.length),
  });
}
