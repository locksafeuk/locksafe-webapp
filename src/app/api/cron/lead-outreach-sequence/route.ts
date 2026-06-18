import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendAdminAlert } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { getActiveSmsProvider, isSmsProviderConfigured, sendSMS } from "@/lib/sms";
import { normalizePhoneNumber } from "@/lib/phone";
import { sendTemplateMessage } from "@/lib/whatsapp-business";

type Track = "independent" | "manager";
type Style = "direct" | "benefit";

// ─────────────────────────────────────────────────────────────────────────────
// SMS outreach (gated) — the email sequence only reaches leads with an email,
// and ~99% of scraped `new` leads are phone-only. This phase contacts the
// phone-reachable backlog via SMS. It is OFF by default; set
// SMS_OUTREACH_ENABLED=true to turn it on. Per-run cap bounds spend; opt-out
// text is included; only UK mobiles with no email are targeted.
// ─────────────────────────────────────────────────────────────────────────────
const SMS_OUTREACH_ENABLED =
  (process.env.SMS_OUTREACH_ENABLED ?? "false").toLowerCase() === "true";
const SMS_OUTREACH_MAX_PER_RUN = Math.max(
  1,
  Math.min(500, Number(process.env.SMS_OUTREACH_MAX_PER_RUN ?? "40") || 40),
);

/** Returns true for UK mobile numbers (07xxx / +447xxx / 00447xxx). */
function isUKMobile(phone: string): boolean {
  const clean = phone.replace(/[\s\-().]/g, "");
  return (
    /^07\d{9}$/.test(clean) ||
    /^\+447\d{9}$/.test(clean) ||
    /^00447\d{9}$/.test(clean)
  );
}

/** Junk/aggregator number blocks we must never message — scraped sequential
 *  ranges (e.g. the 07451 26xxxx block, which showed up as ~13 consecutive
 *  "leads"). Wastes spend and triggers spam complaints that hurt the sender. */
function isJunkPhone(phone: string): boolean {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "44" + d.slice(1);
  return d.startsWith("447451");
}

function buildLeadSms(name: string, city: string): string {
  const firstName = name.split(/\s+/)[0];
  const signupUrl = "https://locksafe.uk/join";
  // GSM-7 only (the old em dash flipped this to UCS-2 = 4 segments = 4x cost).
  // Budget: <=160 chars = 1 segment including name + city.
  return (
    `Hi ${firstName}, Alex from LockSafe UK. Locksmith jobs in ${city}, ` +
    `no monthly fees, set your own rates. Join: ${signupUrl} Reply STOP to opt out`
  );
}

type SmsOutreachSummary = {
  enabled: boolean;
  attempted: number;
  sent: number;
  failed: number;
  message?: string;
};

/**
 * Contact phone-only `new` leads via SMS. Targets UK-mobile leads with no email
 * (the segment the email sequence cannot reach), capped per run. Marks each as
 * `contacted` / `contactedBy: "sms-seq"` so it is not re-messaged.
 */
async function runSmsOutreach(): Promise<SmsOutreachSummary> {
  if (!SMS_OUTREACH_ENABLED) {
    return { enabled: false, attempted: 0, sent: 0, failed: 0, message: "SMS_OUTREACH_ENABLED is not true" };
  }

  const provider = getActiveSmsProvider();
  if (!isSmsProviderConfigured(provider)) {
    return { enabled: true, attempted: 0, sent: 0, failed: 0, message: `SMS provider (${provider}) not configured` };
  }

  // Pull phone-only new leads; over-fetch a little then strict-validate the
  // mobile format before sending.
  const candidates = (await (prisma as unknown as {
    locksmithLead: { findMany: (a: unknown) => Promise<Array<{ id: string; name: string; city: string; phone: string | null }>> };
  }).locksmithLead.findMany({
    // Filter UK mobiles in JS (below), not via Prisma startsWith — a "+447"
    // prefix becomes an invalid Mongo regex (leading + is a quantifier).
    where: {
      status: "new",
      email: null,
      phone: { not: null },
    },
    select: { id: true, name: true, city: true, phone: true },
    orderBy: { createdAt: "desc" },
    take: SMS_OUTREACH_MAX_PER_RUN * 2,
  }));

  const leads = candidates
    .filter((l) => l.phone && isUKMobile(l.phone) && !isJunkPhone(l.phone))
    .slice(0, SMS_OUTREACH_MAX_PER_RUN);

  let sent = 0;
  let failed = 0;
  for (const lead of leads) {
    try {
      const result = await sendSMS(lead.phone!, buildLeadSms(lead.name, lead.city), {
        // Two-way: recruitment must be REPLYABLE. An interested locksmith who
        // texts back lands in the SMS webhook → Lockie's lead flow → conversion.
        // (The old one-way "LockSafe UK" sender silently dropped every reply.)
        channel: "transactional",
        logContext: `lead-outreach-sms-seq:${lead.id}`,
      });
      if (!result.success) {
        failed++;
        // Don't leave it as "new" — that re-queues the same undeliverable
        // number every run (perpetual failures + recurring health alerts).
        await (prisma as unknown as { locksmithLead: { update: (a: unknown) => Promise<unknown> } })
          .locksmithLead.update({ where: { id: lead.id }, data: { status: "contacted", contactedAt: new Date(), contactedBy: "sms-seq-failed" } })
          .catch(() => {});
        continue;
      }
      await (prisma as unknown as {
        locksmithLead: { update: (a: unknown) => Promise<unknown> };
      }).locksmithLead.update({
        where: { id: lead.id },
        data: { status: "contacted", contactedAt: new Date(), contactedBy: "sms-seq" },
      });
      sent++;
      await new Promise((r) => setTimeout(r, 300));
    } catch {
      failed++;
    }
  }

  return { enabled: true, attempted: leads.length, sent, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp outreach (gated) — third channel, layered after SMS.
//
// WhatsApp business-initiated (cold) messages MUST use a Meta-APPROVED template;
// free-form text is not allowed. So this passes a template name + variables to
// the WhatsApp Business API. It is OFF by default — to turn it on you need:
//   1. A template approved in Meta WhatsApp Manager (body with {{1}}=first name,
//      {{2}}=town; put the join link in the template body/button).
//   2. WHATSAPP_OUTREACH_ENABLED=true and WHATSAPP_RECRUIT_TEMPLATE=<template_name>.
//
// It targets the SAME phone-only `new` pool as SMS, and runs AFTER the SMS phase
// — so if SMS is also enabled, those leads are already "contacted" and WhatsApp
// only picks up what SMS didn't reach (no double-messaging the same lead).
// ─────────────────────────────────────────────────────────────────────────────
const WHATSAPP_OUTREACH_ENABLED =
  (process.env.WHATSAPP_OUTREACH_ENABLED ?? "false").toLowerCase() === "true";
const WHATSAPP_OUTREACH_MAX_PER_RUN = Math.max(
  1,
  Math.min(500, Number(process.env.WHATSAPP_OUTREACH_MAX_PER_RUN ?? "40") || 40),
);
const WHATSAPP_RECRUIT_TEMPLATE =
  process.env.WHATSAPP_RECRUIT_TEMPLATE || "locksmith_recruit_invite";

function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

type WhatsAppOutreachSummary = {
  enabled: boolean;
  attempted: number;
  sent: number;
  failed: number;
  template?: string;
  message?: string;
};

/**
 * Contact phone-reachable `new` leads via an approved WhatsApp template.
 * Marks each as `contacted` / `contactedBy: "whatsapp-seq"`.
 */
async function runWhatsAppOutreach(): Promise<WhatsAppOutreachSummary> {
  if (!WHATSAPP_OUTREACH_ENABLED) {
    return { enabled: false, attempted: 0, sent: 0, failed: 0, message: "WHATSAPP_OUTREACH_ENABLED is not true" };
  }
  if (!whatsappConfigured()) {
    return { enabled: true, attempted: 0, sent: 0, failed: 0, message: "WhatsApp Business API not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)" };
  }

  const candidates = (await (prisma as unknown as {
    locksmithLead: { findMany: (a: unknown) => Promise<Array<{ id: string; name: string; city: string; phone: string | null }>> };
  }).locksmithLead.findMany({
    // Filter UK mobiles in JS (below), not via Prisma startsWith — a "+447"
    // prefix becomes an invalid Mongo regex (leading + is a quantifier).
    where: {
      status: { in: ["new", "replied"] },
      email: null,
      phone: { not: null },
    },
    select: { id: true, name: true, city: true, phone: true },
    orderBy: { createdAt: "desc" },
    take: WHATSAPP_OUTREACH_MAX_PER_RUN * 4,
  }));

  const mobileLeads = candidates.filter((l) => l.phone && isUKMobile(l.phone));

  // GATE: only WhatsApp numbers we KNOW are on WhatsApp — i.e. they have already
  // messaged our WhatsApp number (a whatsapp-channel conversation exists). There
  // is no cheap reliable "is this number on WhatsApp" pre-check, and cold
  // marketing templates to scraped numbers that AREN'T on WhatsApp (a) fail with
  // 63024 and (b) erode the Meta sender quality rating. Cold first-touch is SMS.
  const phoneToDigits = (p: string) => normalizePhoneNumber(p).replace(/^\+/, "");
  const digitsToLead = new Map<string, typeof mobileLeads[number]>();
  for (const l of mobileLeads) digitsToLead.set(phoneToDigits(l.phone!), l);
  const convos = (await (prisma as unknown as {
    whatsAppConversation: { findMany: (a: unknown) => Promise<Array<{ phone: string }>> };
  }).whatsAppConversation.findMany({
    where: { channel: "whatsapp", phone: { in: [...digitsToLead.keys()] } },
    select: { phone: true },
  }));
  const onWhatsApp = new Set(convos.map((c) => c.phone));
  const leads = [...digitsToLead.entries()]
    .filter(([digits]) => onWhatsApp.has(digits))
    .map(([, l]) => l)
    .slice(0, WHATSAPP_OUTREACH_MAX_PER_RUN);

  if (leads.length === 0) {
    return { enabled: true, attempted: 0, sent: 0, failed: 0, template: WHATSAPP_RECRUIT_TEMPLATE, message: "No leads with a known WhatsApp presence — cold numbers handled by SMS." };
  }

  let sent = 0;
  let failed = 0;
  for (const lead of leads) {
    try {
      const firstName = lead.name.split(/\s+/)[0];
      // Template variables: {{1}} = first name, {{2}} = town.
      const result = await sendTemplateMessage(lead.phone!, WHATSAPP_RECRUIT_TEMPLATE, [firstName, lead.city]);
      if (!result.success) {
        failed++;
        // Cold scraped numbers that aren't on WhatsApp fail with 63024. Mark
        // them so we don't retry (and re-page) the same numbers every run.
        await (prisma as unknown as { locksmithLead: { update: (a: unknown) => Promise<unknown> } })
          .locksmithLead.update({ where: { id: lead.id }, data: { status: "contacted", contactedAt: new Date(), contactedBy: "whatsapp-seq-failed" } })
          .catch(() => {});
        continue;
      }
      await (prisma as unknown as {
        locksmithLead: { update: (a: unknown) => Promise<unknown> };
      }).locksmithLead.update({
        where: { id: lead.id },
        data: { status: "contacted", contactedAt: new Date(), contactedBy: "whatsapp-seq" },
      });
      sent++;
      await new Promise((r) => setTimeout(r, 300));
    } catch {
      failed++;
    }
  }

  return { enabled: true, attempted: leads.length, sent, failed, template: WHATSAPP_RECRUIT_TEMPLATE };
}

type SequenceResult = {
  touch: number;
  track: Track;
  style: Style;
  variant: number;
  sent: number;
  failed: number;
  attempted: number;
  message?: string;
};

const UK_SEND_WINDOW_START_HOUR = 7;
const UK_SEND_WINDOW_END_HOUR = 11;

function pickStyle(date: Date): Style {
  return date.getUTCDate() % 2 === 0 ? "benefit" : "direct";
}

function pickVariant(date: Date): 1 | 2 | 3 {
  const n = (date.getUTCDate() % 3) + 1;
  return n as 1 | 2 | 3;
}

function getUkHour(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  return Number.isFinite(hour) ? hour : 0;
}

function isWithinUkSendWindow(date: Date): boolean {
  const hour = getUkHour(date);
  return hour >= UK_SEND_WINDOW_START_HOUR && hour < UK_SEND_WINDOW_END_HOUR;
}

async function runTouch(baseUrl: string, authHeader: string, payload: {
  touch: 1 | 2 | 3;
  track: Track;
  style: Style;
  variant: 1 | 2 | 3;
}): Promise<SequenceResult> {
  const response = await fetch(`${baseUrl}/api/admin/leads/send-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: authHeader,
      "x-vercel-cron": "1",
    },
    body: JSON.stringify({
      mode: "sequence",
      touch: payload.touch,
      track: payload.track,
      subjectStyle: payload.style,
      variant: payload.variant,
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      touch: payload.touch,
      track: payload.track,
      style: payload.style,
      variant: payload.variant,
      sent: 0,
      failed: 0,
      attempted: 0,
      message: data?.error || `HTTP ${response.status}`,
    };
  }

  return {
    touch: payload.touch,
    track: payload.track,
    style: payload.style,
    variant: payload.variant,
    sent: Number(data.sent || 0),
    failed: Number(data.failed || 0),
    attempted: Number(data.sequence?.attempted || 0),
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is required" }, { status: 500 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.locksafe.uk").replace(/\/$/, "");
  const now = new Date();

  if (!isWithinUkSendWindow(now)) {
    const ukHour = getUkHour(now);
    return NextResponse.json({
      success: true,
      runAt: now.toISOString(),
      skipped: true,
      message: `Outside UK outreach send window (07:00-11:00). Current UK hour: ${ukHour}:00`,
      summary: {
        attempted: 0,
        sent: 0,
        failed: 0,
      },
      results: [],
    });
  }

  const style = pickStyle(now);
  const variant = pickVariant(now);
  const authHeader = `Bearer ${cronSecret}`;

  const jobs: Array<{ touch: 1 | 2 | 3; track: Track; style: Style; variant: 1 | 2 | 3 }> = [
    { touch: 1, track: "independent", style, variant },
    { touch: 1, track: "manager", style, variant },
    { touch: 2, track: "independent", style, variant },
    { touch: 2, track: "manager", style, variant },
    { touch: 3, track: "independent", style, variant },
    { touch: 3, track: "manager", style, variant },
  ];

  const results: SequenceResult[] = [];
  for (const job of jobs) {
    const result = await runTouch(baseUrl, authHeader, job);
    results.push(result);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  // SMS phase — reaches the phone-only backlog the email touches cannot.
  const sms = await runSmsOutreach();
  // WhatsApp phase — third channel, picks up phone-only leads SMS didn't reach.
  const whatsapp = await runWhatsAppOutreach();

  const emailAttempted = results.reduce((sum, r) => sum + r.attempted, 0);
  const emailSent = results.reduce((sum, r) => sum + r.sent, 0);
  const emailFailed = results.reduce((sum, r) => sum + r.failed, 0);

  const summary = {
    attempted: emailAttempted + sms.attempted + whatsapp.attempted,
    sent: emailSent + sms.sent + whatsapp.sent,
    failed: emailFailed + sms.failed + whatsapp.failed,
    email: { attempted: emailAttempted, sent: emailSent, failed: emailFailed },
    sms,
    whatsapp,
  };

  if (summary.sent > 0) {
    try {
      const perTouchLines = results
        .filter((r) => r.sent > 0)
        .map(
          (r) =>
            `• Touch ${r.touch} · ${r.track} · ${r.style} v${r.variant} → sent ${r.sent}${r.failed ? ` (failed ${r.failed})` : ""}`,
        )
        .join("\n");

      const smsLine = sms.enabled
        ? `\n• SMS (phone-only) → sent ${sms.sent}${sms.failed ? ` (failed ${sms.failed})` : ""}`
        : "";
      const whatsappLine = whatsapp.enabled
        ? `\n• WhatsApp (phone-only) → sent ${whatsapp.sent}${whatsapp.failed ? ` (failed ${whatsapp.failed})` : ""}`
        : "";

      const body =
        `Sent: ${summary.sent} · Failed: ${summary.failed} · Attempted: ${summary.attempted}\n` +
        `Run: ${now.toISOString()}` +
        (perTouchLines ? `\n\n${perTouchLines}` : "") +
        smsLine +
        whatsappLine;

      await sendAdminAlert({
        title: "Outreach digest",
        message: body,
        severity: "warning",
      });
    } catch (telegramErr) {
      console.error("[Lead Outreach Cron] Telegram digest failed:", telegramErr);
    }
  }

  return NextResponse.json({
    success: true,
    runAt: now.toISOString(),
    style,
    variant,
    summary,
    results,
  });
}
