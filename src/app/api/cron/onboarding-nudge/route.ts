import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendStripeOnboardingReminderEmail } from "@/lib/email";
import { createAccountLink, createConnectAccount } from "@/lib/stripe";
import { sendAdminAlert } from "@/lib/telegram";

const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";

// Marker used in StripeReminderLog.adminEmail to identify automated nudges
// (vs admin-triggered manual reminders) so we throttle independently.
const AUTOMATED_TAG = "system-onboarding-nudge";

// Don't email the same locksmith more than once every N days
const THROTTLE_DAYS = 3;

// Safety cap per run — avoids accidental mass email storms
const MAX_PER_RUN = 50;

/**
 * GET /api/cron/onboarding-nudge
 *
 * Daily cron that finds locksmiths who signed up but never completed
 * onboarding (no Stripe Connect, no docs, no terms accepted, etc.) and
 * sends them a "finish your setup" email with a fresh Stripe link.
 *
 * Throttled to once per locksmith per THROTTLE_DAYS via StripeReminderLog.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const throttleCutoff = new Date(Date.now() - THROTTLE_DAYS * 86_400_000);
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://locksafe.uk";
  const returnUrl = `${baseUrl}/locksmith/earnings?stripe_connect=success`;
  const refreshUrl = `${baseUrl}/locksmith/earnings?stripe_connect=refresh`;

  // Eligibility: not finished onboarding, has email, hasn't been auto-nudged
  // within throttle window.
  const candidates = await prisma.locksmith.findMany({
    where: {
      onboardingCompleted: false,
      email: { not: "" },
      stripeReminderLogs: {
        none: {
          adminEmail: AUTOMATED_TAG,
          sentAt: { gte: throttleCutoff },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      stripeConnectId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
  });

  if (candidates.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No eligible locksmiths to nudge",
      sent: 0,
      failed: 0,
    });
  }

  let sent = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const ls of candidates) {
    try {
      // Ensure a Stripe Connect account exists so we can issue a link
      let stripeId = ls.stripeConnectId;
      if (!stripeId) {
        const account = await createConnectAccount(ls.email, ls.id, {
          name: ls.name,
          phone: ls.phone || undefined,
          url: baseUrl,
        });
        stripeId = account.id;
        await prisma.locksmith.update({
          where: { id: ls.id },
          data: {
            stripeConnectId: stripeId,
            stripeConnectOnboarded: false,
            stripeConnectVerified: false,
          },
        });
      }

      const accountLink = await createAccountLink(stripeId, returnUrl, refreshUrl);
      const emailResult = await sendStripeOnboardingReminderEmail(ls.email, {
        locksmithName: ls.name,
        stripeOnboardingUrl: accountLink.url,
      });

      if (!emailResult.success) {
        failed++;
        failures.push(ls.email);
        continue;
      }

      await prisma.stripeReminderLog.create({
        data: {
          locksmithId: ls.id,
          adminEmail: AUTOMATED_TAG,
          sentAt: new Date(),
        },
      });
      sent++;
    } catch (e) {
      failed++;
      failures.push(ls.email);
      console.error(`[Onboarding Nudge] Failed for ${ls.email}:`, e);
    }
  }

  // One concise admin notification per run (info, not error)
  try {
    if (sent > 0 || failed > 0) {
      await sendAdminAlert({
        title: "📧 Onboarding nudges sent",
        message:
          `Auto-nudged ${sent} incomplete locksmith(s); ${failed} failed.\n` +
          (failures.length > 0
            ? `Failures: ${failures.slice(0, 10).join(", ")}`
            : ""),
        severity: "info",
      });
    }
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    success: true,
    eligible: candidates.length,
    sent,
    failed,
    failures,
  });
}
