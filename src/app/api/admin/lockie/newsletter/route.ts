/**
 * POST /api/admin/lockie/newsletter
 *
 * Lockie Newsletter — broadcast a custom message to a targeted audience
 * (locksmiths or customers), WhatsApp first with SMS fallback.
 *
 * Pattern: 2026-06-24. Piky's idea: turn one-off broadcasts into a regular
 * "WhatsApp newsletter" from Lockie so locksmiths re-engage with platform
 * updates, new features, and personal stats. First MVP version: custom
 * message + audience selector. Phase 2 will add scheduling + auto-generated
 * content from week activity.
 *
 * Sister endpoint of /api/admin/broadcast/app-update which is hardcoded
 * for app-version nudges. THIS one is generic — any message, any audience.
 *
 * Defaults to DRY RUN — pass `{ dryRun: false }` to actually fire.
 * Quiet-hours guard 09:00–20:00 UK time (overridable with `force: true`).
 *
 * Auth: admin JWT cookie.
 *
 * Body:
 *   {
 *     dryRun?:   boolean   // default true — preview only
 *     force?:    boolean   // override quiet-hours guard
 *     audience:  AudienceKey
 *     message:   string    // 1-1500 chars
 *     channel?:  "auto" | "whatsapp_only" | "sms_only"  // default "auto"
 *   }
 *
 * Response (dryRun):
 *   {
 *     dryRun: true, audience, total, skipped,
 *     preview: string,            // exact message that would be sent
 *     recipients: string[],       // "Name (phone)"
 *   }
 *
 * Response (live):
 *   {
 *     dryRun: false, audience, total, skipped,
 *     sent: { whatsapp: number; sms: number; failed: number }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { sendTextMessage } from "@/lib/whatsapp-business";
import { sendSMS } from "@/lib/sms";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_MESSAGE_LEN = 10;
const MAX_MESSAGE_LEN = 1500;

const AUDIENCE_KEYS = [
  "all_locksmiths",          // active=true AND phone
  "silent_locksmiths",       // active=true AND online=true AND nativeDeviceToken=null
  "online_locksmiths",       // active=true AND isAvailable=true
  "app_installed",           // active=true AND nativeDeviceToken!=null
  "app_missing",             // active=true AND nativeDeviceToken=null
  "all_customers",           // all customers with phone
  "active_customers_30d",    // customers with a job in last 30d
] as const;

type AudienceKey = typeof AUDIENCE_KEYS[number];

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

interface Recipient {
  id: string;
  name: string;
  phone: string | null;
  kind: "locksmith" | "customer";
}

async function resolveAudience(audience: AudienceKey): Promise<Recipient[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  switch (audience) {
    case "all_locksmiths": {
      const rows = await p.locksmith.findMany({
        where: { isActive: true },
        select: { id: true, name: true, phone: true },
      });
      return rows.map((r: { id: string; name: string; phone: string | null }) => ({
        id: r.id, name: r.name, phone: r.phone, kind: "locksmith" as const,
      }));
    }
    case "silent_locksmiths": {
      // Prisma+MongoDB `nativeDeviceToken: null` filter doesn't match docs
      // where the field is MISSING. Fetch all isActive+isAvailable then
      // filter in JS to get the true "no token" set.
      const rows = await p.locksmith.findMany({
        where: { isActive: true, isAvailable: true },
        select: { id: true, name: true, phone: true, nativeDeviceToken: true },
      });
      return rows
        .filter((r: { nativeDeviceToken: string | null }) => !r.nativeDeviceToken)
        .map((r: { id: string; name: string; phone: string | null }) => ({
          id: r.id, name: r.name, phone: r.phone, kind: "locksmith" as const,
        }));
    }
    case "online_locksmiths": {
      const rows = await p.locksmith.findMany({
        where: { isActive: true, isAvailable: true },
        select: { id: true, name: true, phone: true },
      });
      return rows.map((r: { id: string; name: string; phone: string | null }) => ({
        id: r.id, name: r.name, phone: r.phone, kind: "locksmith" as const,
      }));
    }
    case "app_installed": {
      const rows = await p.locksmith.findMany({
        where: { isActive: true },
        select: { id: true, name: true, phone: true, nativeDeviceToken: true },
      });
      return rows
        .filter((r: { nativeDeviceToken: string | null }) => Boolean(r.nativeDeviceToken))
        .map((r: { id: string; name: string; phone: string | null }) => ({
          id: r.id, name: r.name, phone: r.phone, kind: "locksmith" as const,
        }));
    }
    case "app_missing": {
      // Same Prisma+MongoDB null-bug workaround as silent_locksmiths.
      // Fetch isActive, post-filter in JS for missing-or-null token.
      const rows = await p.locksmith.findMany({
        where: { isActive: true },
        select: { id: true, name: true, phone: true, nativeDeviceToken: true },
      });
      return rows
        .filter((r: { nativeDeviceToken: string | null }) => !r.nativeDeviceToken)
        .map((r: { id: string; name: string; phone: string | null }) => ({
          id: r.id, name: r.name, phone: r.phone, kind: "locksmith" as const,
        }));
    }
    case "all_customers": {
      const rows = await p.customer.findMany({
        select: { id: true, name: true, phone: true },
      });
      return rows.map((r: { id: string; name: string | null; phone: string | null }) => ({
        id: r.id, name: r.name ?? "Customer", phone: r.phone, kind: "customer" as const,
      }));
    }
    case "active_customers_30d": {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await p.customer.findMany({
        where: { jobs: { some: { createdAt: { gte: since } } } },
        select: { id: true, name: true, phone: true },
      });
      return rows.map((r: { id: string; name: string | null; phone: string | null }) => ({
        id: r.id, name: r.name ?? "Customer", phone: r.phone, kind: "customer" as const,
      }));
    }
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun: boolean = body.dryRun !== false;
  const audience = body.audience as AudienceKey | undefined;
  const message: string = typeof body.message === "string" ? body.message.trim() : "";
  const requestedChannel: "auto" | "whatsapp_only" | "sms_only" =
    body.channel === "whatsapp_only" || body.channel === "sms_only"
      ? body.channel
      : "auto";

  // §39 cold-audience guard (2026-06-24): WhatsApp Business rejects free-form
  // text outside the 24h customer-initiated window with error 63016. The
  // audiences below are by definition cold (locksmiths who haven't messaged
  // us recently), so attempting WhatsApp is pure waste — silently counted
  // as "sent" by our synchronous code but bounced later by Meta. Until we
  // have Meta-approved WhatsApp templates, force SMS-only for cold outreach.
  const COLD_AUDIENCES = new Set([
    "all_locksmiths",
    "silent_locksmiths",
    "online_locksmiths",
    "app_missing",
    "all_customers",
  ]);
  const channelMode: "auto" | "whatsapp_only" | "sms_only" =
    requestedChannel === "auto" && audience && COLD_AUDIENCES.has(audience)
      ? "sms_only"
      : requestedChannel;
  const channelOverrideApplied = channelMode !== requestedChannel;

  // Input validation
  if (!audience || !AUDIENCE_KEYS.includes(audience)) {
    return NextResponse.json(
      {
        error: "Invalid audience",
        allowed: AUDIENCE_KEYS,
      },
      { status: 400 },
    );
  }
  if (message.length < MIN_MESSAGE_LEN || message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      {
        error: `Message must be ${MIN_MESSAGE_LEN}–${MAX_MESSAGE_LEN} chars`,
        actual: message.length,
      },
      { status: 400 },
    );
  }

  // Quiet-hours guard — only enforced for live sends, override with force:true
  const SEND_START_HOUR = 9;
  const SEND_END_HOUR = 20;
  const ukHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  const withinSendingHours = ukHour >= SEND_START_HOUR && ukHour < SEND_END_HOUR;
  if (!dryRun && !withinSendingHours && body.force !== true) {
    return NextResponse.json(
      {
        blocked: true,
        reason:
          `It's ~${ukHour}:00 UK — outside the ${SEND_START_HOUR}:00–${SEND_END_HOUR}:00 ` +
          `quiet-hours window. Re-run with force:true to override, or wait until ${SEND_START_HOUR}:00.`,
        ukHour,
      },
      { status: 200 },
    );
  }

  const recipients = await resolveAudience(audience);
  const withPhone = recipients.filter((r) => !!r.phone);
  const skipped = recipients.length - withPhone.length;

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      audience,
      channelMode,
      channelOverrideApplied,
      channelOverrideReason: channelOverrideApplied
        ? "§39 cold-audience guard — forced SMS-only because WhatsApp free-form is rejected (63016) outside the 24h window. Submit a Meta-approved template to use WhatsApp here."
        : undefined,
      total: withPhone.length,
      skipped,
      preview: message,
      recipients: withPhone.map((r) => `${r.name} (${r.phone}) — ${r.kind}`),
    });
  }

  // Live send loop — WhatsApp first if mode allows, SMS fallback.
  let waOk = 0;
  let smsOk = 0;
  let failed = 0;

  for (const r of withPhone) {
    const phone = normalizePhoneNumber(r.phone!);
    if (!phone) {
      failed++;
      continue;
    }

    let sent = false;
    if (channelMode === "auto" || channelMode === "whatsapp_only") {
      try {
        const wa = await sendTextMessage(phone, message);
        if (wa.success) {
          waOk++;
          sent = true;
        }
      } catch {
        // fall through to SMS
      }
    }

    if (!sent && (channelMode === "auto" || channelMode === "sms_only")) {
      try {
        const sms = await sendSMS(phone, message, {
          channel: "transactional",
          logContext: `lockie-newsletter:${audience}:${r.id}`,
        });
        if (sms.success) {
          smsOk++;
          sent = true;
        }
      } catch {
        // counted as failed below
      }
    }

    if (!sent) failed++;
  }

  return NextResponse.json({
    dryRun: false,
    audience,
    channelMode,
    channelOverrideApplied,
    total: withPhone.length,
    skipped,
    sent: { whatsapp: waOk, sms: smsOk, failed },
  });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    endpoint: "POST /api/admin/lockie/newsletter",
    audiences: AUDIENCE_KEYS,
    messageLimits: { min: MIN_MESSAGE_LEN, max: MAX_MESSAGE_LEN },
    quietHours: { startUk: 9, endUk: 20 },
  });
}
