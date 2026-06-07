/**
 * POST /api/admin/locksmiths/send-base-location-sms
 *
 * Send an SMS reminder to locksmiths who haven't set their base location.
 * Uses the same sendSMS() pipeline as the rest of the platform (Zadarma
 * primary, Twilio fallback).
 *
 * Defaults to DRY RUN — body must include `{ dryRun: false }` to actually
 * send. Dry run returns the recipient list + the exact message preview so
 * the admin can review before firing.
 *
 * Auth: admin JWT cookie.
 *
 * Body:
 *   {
 *     dryRun?: boolean,           // default true
 *     locksmithIds?: string[],    // optional — restrict to specific IDs.
 *                                 // If omitted, targets ALL isActive locksmiths
 *                                 // missing baseLat/baseLng.
 *     messageOverride?: string,   // optional — replace default text
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma as _prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sendSMS } from "@/lib/sms";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

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

/**
 * Default SMS body. Sent via Twilio (primary SMS provider), which allows
 * web links — the login link survives delivery. If the message ever routes
 * through Zadarma, its sanitizer strips URLs automatically at send time.
 *
 * {name} → first name per recipient.
 */
const DEFAULT_MESSAGE_TEMPLATE =
  "Hi {name}, LockSafe: your base location isn't set on your profile yet, so we can't send you nearby jobs. Set your postcode here: https://www.locksafe.uk/locksmith/settings Thanks!";

function renderMessage(template: string, locksmithName: string): string {
  return template.replace(/\{name\}/g, locksmithName.split(" ")[0] || locksmithName);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { dryRun?: boolean; locksmithIds?: string[]; messageOverride?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  // SAFE DEFAULT: dryRun = true unless explicitly set to false.
  const dryRun = body.dryRun !== false;
  const template = body.messageOverride || DEFAULT_MESSAGE_TEMPLATE;

  const where: Record<string, unknown> = {
    isActive: true,
    OR: [{ baseLat: null }, { baseLng: null }],
  };
  if (Array.isArray(body.locksmithIds) && body.locksmithIds.length > 0) {
    where.id = { in: body.locksmithIds };
  }

  const locksmiths = await prisma.locksmith.findMany({
    where,
    select: {
      id: true,
      name: true,
      companyName: true,
      phone: true,
      baseAddress: true,
      onboardingCompleted: true,
      totalJobs: true,
    },
    orderBy: [{ onboardingCompleted: "desc" }, { totalJobs: "desc" }],
  });

  // Filter: phone must be present + look like a UK number.
  const eligible = locksmiths.filter((l: { phone: string | null }) => {
    if (!l.phone) return false;
    const cleaned = l.phone.replace(/\s+/g, "");
    return /^(\+44|0)\d{9,10}$/.test(cleaned);
  });
  const skippedNoValidPhone = locksmiths.length - eligible.length;

  // Build preview / send entries.
  const entries = eligible.map((l: {
    id: string; name: string; companyName: string | null; phone: string;
    baseAddress: string | null; onboardingCompleted: boolean; totalJobs: number;
  }) => ({
    locksmithId: l.id,
    name: l.name,
    companyName: l.companyName,
    phone: l.phone,
    baseAddress: l.baseAddress,
    onboardingCompleted: l.onboardingCompleted,
    totalJobs: l.totalJobs,
    messagePreview: renderMessage(template, l.name),
  }));

  if (dryRun) {
    return NextResponse.json({
      mode: "dry_run",
      message:
        "DRY RUN — no SMS sent. Inspect the entries below. POST again with { dryRun: false } to actually send.",
      eligibleCount: entries.length,
      skippedNoValidPhone,
      template,
      entries,
    });
  }

  // REAL SEND PATH. Fire one SMS per locksmith, log each result, and
  // record into BaseLocationReminderLog (same model the email path uses)
  // so dashboard "last reminded at" surfaces both channels.
  const results = await Promise.all(
    entries.map(async (e: typeof entries[0]) => {
      try {
        const smsResult = await sendSMS(e.phone, e.messagePreview, {
          logContext: `base-location-reminder:${e.locksmithId}`,
        });
        if (smsResult.success) {
          await prisma.baseLocationReminderLog.create({
            data: {
              locksmithId: e.locksmithId,
              adminEmail: admin.email,
              sentAt: new Date(),
            },
          });
        }
        return {
          locksmithId: e.locksmithId,
          name: e.name,
          phone: e.phone,
          sent: smsResult.success,
          error: smsResult.success ? null : smsResult.error,
        };
      } catch (err) {
        return {
          locksmithId: e.locksmithId,
          name: e.name,
          phone: e.phone,
          sent: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  const sentCount = results.filter((r) => r.sent).length;
  const failedCount = results.length - sentCount;

  return NextResponse.json({
    mode: "live_send",
    message: `SMS reminder sent to ${sentCount}/${results.length} locksmiths.`,
    sentCount,
    failedCount,
    skippedNoValidPhone,
    template,
    results,
  });
}
