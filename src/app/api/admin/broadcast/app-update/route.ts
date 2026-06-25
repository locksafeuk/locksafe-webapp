/**
 * POST /api/admin/broadcast/app-update
 *
 * Sends an app-update broadcast to all active locksmiths via WhatsApp
 * (sendTextMessage), with SMS fallback for any that fail.
 *
 * Lockie sends this message on your behalf — locksmiths receive it from
 * the platform's WhatsApp number so they can reply if they need help.
 *
 * Defaults to DRY RUN — pass `{ dryRun: false }` to actually fire.
 *
 * Auth: admin JWT cookie.
 *
 * Body:
 *   {
 *     dryRun?:  boolean   // default true — preview only
 *     version?: string    // default "1.0.4"
 *   }
 *
 * Response:
 *   {
 *     dryRun: boolean
 *     total: number
 *     sent: { whatsapp: number; sms: number; failed: number }
 *     skipped: number        // no phone number on record
 *     recipients?: string[]  // phone list (dry run only)
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { sendWhatsAppFreeformGuarded } from "@/lib/whatsapp-business";
import { prisma } from "@/lib/prisma";
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

const STORE_LINKS = [
  `📱 Android → https://play.google.com/store/apps/details?id=uk.locksafe.app`,
  `🍎 iPhone → https://apps.apple.com/app/locksafe-locksmith-partner/id6762475008`,
];

/** For locksmiths who ALREADY have the app — nudge to update. */
function buildUpdateMessage(version: string): string {
  return [
    `🔑 *LockSafe App Update — v${version}*`,
    ``,
    `Hi! A new version of the LockSafe app is now available. Please update to stay on the latest version.`,
    ``,
    `*What's new:*`,
    `• Improved location tracking stability`,
    `• Push notification reliability fixes`,
    `• Performance improvements under the hood`,
    ``,
    `*Update now:*`,
    ...STORE_LINKS,
    ``,
    `Just tap your link, then hit *Update* in the store.`,
    ``,
    `Questions? Reply here or email support@locksafe.uk`,
    `— The LockSafe Team`,
  ].join("\n");
}

/** For locksmiths who DON'T have the app yet — nudge to install. */
function buildInstallMessage(): string {
  return [
    `🔑 *Get the LockSafe app*`,
    ``,
    `Hi! You're not set up with the LockSafe app yet — it's how you get instant job alerts the moment a job comes up in your area.`,
    ``,
    `*Install now:*`,
    ...STORE_LINKS,
    ``,
    `Tap your link, install, then sign in with your LockSafe details.`,
    ``,
    `Questions? Reply here or email support@locksafe.uk`,
    `— The LockSafe Team`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun: boolean = body.dryRun !== false; // default true
  const version: string = body.version ?? "1.0.4";

  // Quiet-hours guard: don't blast locksmiths' phones at unsociable times.
  // Live sends are only allowed 09:00–20:00 UK time, unless force:true is passed.
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
        reason: `It's ~${ukHour}:00 UK — outside the ${SEND_START_HOUR}:00–${SEND_END_HOUR}:00 sending window. Broadcasts to locksmiths are held back at unsociable hours so we don't buzz their phones late. Re-run with force:true to override, or send it in the morning.`,
        ukHour,
      },
      { status: 200 },
    );
  }

  // Optional audience filter: "all" (default), "install" (no app only),
  // "update" (has app only).
  const audience: "all" | "install" | "update" =
    body.audience === "install" || body.audience === "update" ? body.audience : "all";

  // Fetch all active locksmiths, including their app-install signal.
  const locksmiths = await (prisma as any).locksmith.findMany({
    where: { isActive: true },
    select: { id: true, name: true, phone: true, nativeDeviceToken: true, webPushSubscription: true },
  }) as Array<{
    id: string;
    name: string;
    phone: string | null;
    nativeDeviceToken: string | null;
    webPushSubscription: string | null;
  }>;

  const withPhone = locksmiths.filter((l) => !!l.phone);
  const skipped = locksmiths.length - withPhone.length;

  const hasApp = (l: { nativeDeviceToken: string | null; webPushSubscription: string | null }) =>
    Boolean(l.nativeDeviceToken || l.webPushSubscription);

  // Each locksmith gets the message that fits them: update if they have the app,
  // install if they don't.
  const targets = withPhone
    .map((l) => ({ ...l, segment: hasApp(l) ? ("update" as const) : ("install" as const) }))
    .filter((l) => audience === "all" || l.segment === audience);

  const updateMessage = buildUpdateMessage(version);
  const installMessage = buildInstallMessage();
  const msgFor = (segment: "update" | "install") =>
    segment === "update" ? updateMessage : installMessage;

  const counts = {
    install: targets.filter((t) => t.segment === "install").length,
    update: targets.filter((t) => t.segment === "update").length,
  };

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      audience,
      total: targets.length,
      skipped,
      segments: counts,
      previews: { install: installMessage, update: updateMessage },
      recipients: targets.map((l) => `${l.name} (${l.phone}) → ${l.segment}`),
    });
  }

  // Live send — free-form WhatsApp, tailored per segment, but ONLY to
  // recipients whose 24h WhatsApp window is OPEN. Free-form WhatsApp outside
  // that window is rejected by Twilio/Meta with 63016 (the bug this fixes).
  // For an info broadcast we SKIP closed-window recipients (no SMS) and count
  // them separately — they're not failures.
  let waOk = 0;
  let failed = 0;
  let windowSkipped = 0;

  for (const locksmith of targets) {
    const phone = normalizePhoneNumber(locksmith.phone!);
    if (!phone) { failed++; continue; }
    const message = msgFor(locksmith.segment);

    try {
      const guard = await sendWhatsAppFreeformGuarded(phone, message, {
        onClosed: "skip",
        smsFallbackContext: `app-${locksmith.segment}-broadcast:${locksmith.id}`,
      });
      if (guard.channel === "whatsapp" && guard.sent) {
        waOk++;
      } else if (guard.channel === "skipped") {
        // Closed window (or transient WhatsApp failure) → skip, not a failure.
        windowSkipped++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    dryRun: false,
    version,
    audience,
    total: targets.length,
    skipped,
    // `windowSkipped` = recipients skipped because their 24h WhatsApp window
    // was closed (would have 63016'd as free-form).
    windowSkipped,
    segments: counts,
    sent: { whatsapp: waOk, failed },
  });
}
