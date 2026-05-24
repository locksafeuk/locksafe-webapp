import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import { sendEmail, sendStripeOnboardingReminderEmail } from "@/lib/email";
import { createAccountLink, createConnectAccount } from "@/lib/stripe";
import { sendAdminAlert } from "@/lib/telegram";
import { deleteLocksmithCascade } from "@/lib/locksmith-deletion";
import { extractUkPostcode, isCoordinatePair } from "@/lib/location-display";

const STAGE1_TAG = "system-onboarding-stage-1";
const STAGE2_TAG = "system-onboarding-stage-2";
const PRE_DELETE_TAG = "system-onboarding-pre-delete";
const LEGACY_TAG = "system-onboarding-nudge";

const MAX_PER_RUN = 50;
const FIRST_REMINDER_HOURS = 24;
const SECOND_REMINDER_AFTER_DAYS = 3;
const PRE_DELETE_DAYS = 27;
const AUTO_DELETE_DAYS = 30;
const AUTO_DELETE_ENABLED = process.env.ONBOARDING_AUTO_DELETE_ENABLED !== "false";
const DRY_RUN = process.env.ONBOARDING_LIFECYCLE_DRY_RUN === "true";

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  stripeConnectId: string | null;
  stripeConnectOnboarded: boolean;
  createdAt: Date;
  updatedAt: Date;
  onboardingLastInteractionAt: Date | null;
  termsAcceptedAt: Date | null;
  insuranceDocumentUrl: string | null;
  baseAddress: string | null;
  baseLat: number | null;
  baseLng: number | null;
  coverageAreas: string[];
  stripeReminderLogs: Array<{
    adminEmail: string;
    sentAt: Date;
  }>;
};

function ageInDays(date: Date): number {
  return (Date.now() - date.getTime()) / 86_400_000;
}

function getLastLogByTag(logs: Candidate["stripeReminderLogs"], tag: string): Date | null {
  const hit = logs
    .filter((log) => log.adminEmail === tag)
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];
  return hit?.sentAt || null;
}

function hasPostcodeLocation(candidate: Candidate): boolean {
  const postcodeFromAddress = extractUkPostcode(candidate.baseAddress || "");
  const postcodeFromCoverage = candidate.coverageAreas.find((area) => Boolean(extractUkPostcode(area))) || null;
  return Boolean(postcodeFromAddress || postcodeFromCoverage);
}

function getMissingChecklistItems(candidate: Candidate): string[] {
  const missing: string[] = [];
  if (!candidate.stripeConnectOnboarded) missing.push("Complete Stripe payout onboarding");

  const hasCoords = candidate.baseLat != null && candidate.baseLng != null;
  const hasAddress = Boolean(candidate.baseAddress?.trim());
  const addressLooksLikeCoordinates = isCoordinatePair(candidate.baseAddress || "");
  if (!hasCoords || !hasAddress || addressLooksLikeCoordinates || !hasPostcodeLocation(candidate)) {
    missing.push("Set a valid postcode-based base location");
  }

  if (!candidate.insuranceDocumentUrl) missing.push("Upload insurance documents");
  if (!candidate.termsAcceptedAt) missing.push("Accept locksmith terms and complete onboarding details");
  return missing;
}

function hasInteractedAfterStage1(candidate: Candidate, stage1SentAt: Date): boolean {
  if (candidate.onboardingLastInteractionAt && candidate.onboardingLastInteractionAt > stage1SentAt) return true;
  return candidate.updatedAt > stage1SentAt;
}

async function ensureTrackedStripeOnboardingUrl(candidate: Candidate, baseUrl: string, returnUrl: string, refreshUrl: string): Promise<string> {
  let stripeId = candidate.stripeConnectId;
  if (!stripeId) {
    const account = await createConnectAccount(candidate.email, candidate.id, {
      name: candidate.name,
      phone: candidate.phone || undefined,
      url: baseUrl,
    });

    stripeId = account.id;
    await prisma.locksmith.update({
      where: { id: candidate.id },
      data: {
        stripeConnectId: stripeId,
        stripeConnectOnboarded: false,
        stripeConnectVerified: false,
      },
    });
  }

  const accountLink = await createAccountLink(stripeId, returnUrl, refreshUrl);
  return `${baseUrl}/api/onboarding/interaction?locksmithId=${encodeURIComponent(candidate.id)}&next=${encodeURIComponent(accountLink.url)}`;
}

async function sendStage2Email(candidate: Candidate, checklist: string[], trackedStripeUrl: string) {
  const items = checklist.map((item) => `<li style=\"margin-bottom:8px;\">${item}</li>`).join("");

  return sendEmail({
    to: candidate.email,
    subject: "Reminder: complete your LockSafe onboarding steps",
    html: `
      <html>
      <body style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;color:#0f172a;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
          <h2 style="margin-top:0;color:#0f172a;">Hi ${candidate.name}, your onboarding is still incomplete</h2>
          <p>Please complete the following to keep your locksmith account active:</p>
          <ul>${items}</ul>
          <p style="margin-top:16px;">If you have already interacted with your account, you can ignore this reminder.</p>
          <a href="${trackedStripeUrl}" style="display:inline-block;margin-top:16px;padding:12px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Continue onboarding</a>
        </div>
      </body>
      </html>
    `,
  });
}

async function writeLifecycleLog(locksmithId: string, tag: string) {
  if (DRY_RUN) return;
  await prisma.stripeReminderLog.create({
    data: {
      locksmithId,
      adminEmail: tag,
      sentAt: new Date(),
    },
  });
}

async function sendPreDeleteWarningEmail(candidate: Candidate, checklist: string[], deleteOnDate: Date, trackedStripeUrl: string) {
  const items = checklist.map((item) => `<li style=\"margin-bottom:8px;\">${item}</li>`).join("");

  return sendEmail({
    to: candidate.email,
    subject: "Final notice: incomplete onboarding accounts are removed after 30 days",
    html: `
      <html>
      <body style="font-family:Arial,sans-serif;background:#fff7ed;padding:20px;color:#7c2d12;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #fed7aa;border-radius:12px;padding:24px;">
          <h2 style="margin-top:0;color:#9a3412;">Final onboarding notice for ${candidate.name}</h2>
          <p>Your locksmith account is still incomplete. It is scheduled for automatic removal on <strong>${deleteOnDate.toLocaleDateString("en-GB")}</strong> unless onboarding is completed.</p>
          <p>Missing items:</p>
          <ul>${items}</ul>
          <a href="${trackedStripeUrl}" style="display:inline-block;margin-top:16px;padding:12px 18px;background:#c2410c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Complete onboarding now</a>
          <p style="margin-top:16px;font-size:13px;color:#9a3412;">If onboarding is completed before the deletion date, no deletion will occur.</p>
        </div>
      </body>
      </html>
    `,
  });
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://locksafe.uk";
  const returnUrl = `${baseUrl}/locksmith/earnings?stripe_connect=success`;
  const refreshUrl = `${baseUrl}/locksmith/earnings?stripe_connect=refresh`;

  const firstReminderCutoff = new Date(Date.now() - FIRST_REMINDER_HOURS * 3_600_000);

  const candidates = await prisma.locksmith.findMany({
    where: {
      onboardingCompleted: false,
      email: { not: "" },
      createdAt: { lte: firstReminderCutoff },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      stripeConnectId: true,
      stripeConnectOnboarded: true,
      createdAt: true,
      updatedAt: true,
      onboardingLastInteractionAt: true,
      termsAcceptedAt: true,
      insuranceDocumentUrl: true,
      baseAddress: true,
      baseLat: true,
      baseLng: true,
      coverageAreas: true,
      stripeReminderLogs: {
        where: {
          adminEmail: {
            in: [STAGE1_TAG, STAGE2_TAG, PRE_DELETE_TAG, LEGACY_TAG],
          },
        },
        select: {
          adminEmail: true,
          sentAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN * 4,
  });

  if (candidates.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No eligible locksmiths for onboarding lifecycle run",
      stage1Sent: 0,
      stage2Sent: 0,
      preDeleteWarned: 0,
      deleted: 0,
      skippedStage2ByInteraction: 0,
      failed: 0,
    });
  }

  let stage1Sent = 0;
  let stage2Sent = 0;
  let preDeleteWarned = 0;
  let deleted = 0;
  let skippedStage2ByInteraction = 0;
  let failed = 0;
  let deleteSkippedByConfig = 0;
  const failures: string[] = [];
  const stage1WindowCutoff = new Date(Date.now() - FIRST_REMINDER_HOURS * 3_600_000);

  for (const candidate of candidates) {
    if (stage1Sent + stage2Sent + preDeleteWarned + deleted >= MAX_PER_RUN) break;

    try {
      const checklist = getMissingChecklistItems(candidate);
      if (checklist.length === 0) continue;

      const ageDays = ageInDays(candidate.createdAt);
      const stage1SentAt = getLastLogByTag(candidate.stripeReminderLogs, STAGE1_TAG)
        || getLastLogByTag(candidate.stripeReminderLogs, LEGACY_TAG);
      const stage2SentAt = getLastLogByTag(candidate.stripeReminderLogs, STAGE2_TAG);
      const preDeleteSentAt = getLastLogByTag(candidate.stripeReminderLogs, PRE_DELETE_TAG);

      if (ageDays >= AUTO_DELETE_DAYS) {
        if (!preDeleteSentAt) {
          const trackedUrl = await ensureTrackedStripeOnboardingUrl(candidate, baseUrl, returnUrl, refreshUrl);
          const warnResult = DRY_RUN
            ? { success: true }
            : await sendPreDeleteWarningEmail(
              candidate,
              checklist,
              new Date(candidate.createdAt.getTime() + AUTO_DELETE_DAYS * 86_400_000),
              trackedUrl,
            );

          if (!warnResult.success) {
            failed++;
            failures.push(candidate.email);
            continue;
          }

          await writeLifecycleLog(candidate.id, PRE_DELETE_TAG);
          preDeleteWarned++;
          continue;
        }

        const hasLeadWarning = Date.now() - preDeleteSentAt.getTime() >= 86_400_000;
        if (!hasLeadWarning) continue;

        const latest = await prisma.locksmith.findUnique({
          where: { id: candidate.id },
          select: { onboardingCompleted: true },
        });

        if (!latest || latest.onboardingCompleted) continue;

        if (!AUTO_DELETE_ENABLED || DRY_RUN) {
          deleteSkippedByConfig++;
          continue;
        }

        await deleteLocksmithCascade(candidate.id);
        deleted++;
        continue;
      }

      if (ageDays >= PRE_DELETE_DAYS) {
        if (preDeleteSentAt) continue;

        const trackedUrl = await ensureTrackedStripeOnboardingUrl(candidate, baseUrl, returnUrl, refreshUrl);
        const warnResult = DRY_RUN
          ? { success: true }
          : await sendPreDeleteWarningEmail(
            candidate,
            checklist,
            new Date(candidate.createdAt.getTime() + AUTO_DELETE_DAYS * 86_400_000),
            trackedUrl,
          );

        if (!warnResult.success) {
          failed++;
          failures.push(candidate.email);
          continue;
        }

        await writeLifecycleLog(candidate.id, PRE_DELETE_TAG);
        preDeleteWarned++;
        continue;
      }

      if (!stage1SentAt && candidate.createdAt <= stage1WindowCutoff) {
        const trackedUrl = await ensureTrackedStripeOnboardingUrl(candidate, baseUrl, returnUrl, refreshUrl);
        const emailResult = DRY_RUN
          ? { success: true }
          : await sendStripeOnboardingReminderEmail(candidate.email, {
            locksmithName: candidate.name,
            stripeOnboardingUrl: trackedUrl,
          });

        if (!emailResult.success) {
          failed++;
          failures.push(candidate.email);
          continue;
        }

        await writeLifecycleLog(candidate.id, STAGE1_TAG);
        stage1Sent++;
        continue;
      }

      if (stage1SentAt && !stage2SentAt) {
        const secondReminderDueAt = new Date(stage1SentAt.getTime() + SECOND_REMINDER_AFTER_DAYS * 86_400_000);
        if (Date.now() < secondReminderDueAt.getTime()) continue;

        if (hasInteractedAfterStage1(candidate, stage1SentAt)) {
          skippedStage2ByInteraction++;
          continue;
        }

        const trackedUrl = await ensureTrackedStripeOnboardingUrl(candidate, baseUrl, returnUrl, refreshUrl);
        const stage2Result = DRY_RUN
          ? { success: true }
          : await sendStage2Email(candidate, checklist, trackedUrl);

        if (!stage2Result.success) {
          failed++;
          failures.push(candidate.email);
          continue;
        }

        await writeLifecycleLog(candidate.id, STAGE2_TAG);
        stage2Sent++;
      }
    } catch (e) {
      failed++;
      failures.push(candidate.email);
      console.error(`[Onboarding Nudge] Failed for ${candidate.email}:`, e);
    }
  }

  try {
    if (stage1Sent > 0 || stage2Sent > 0 || preDeleteWarned > 0 || deleted > 0 || failed > 0) {
      await sendAdminAlert({
        title: "📧 Onboarding lifecycle run",
        message:
          `Stage1 sent: ${stage1Sent}\n` +
          `Stage2 sent: ${stage2Sent}\n` +
          `Pre-delete warned: ${preDeleteWarned}\n` +
          `Deleted: ${deleted}\n` +
          `Stage2 skipped (interaction): ${skippedStage2ByInteraction}\n` +
          `Failed: ${failed}\n` +
          `Delete skipped by config: ${deleteSkippedByConfig}\n` +
          `Dry run: ${DRY_RUN ? "yes" : "no"}\n` +
          `Auto-delete enabled: ${AUTO_DELETE_ENABLED ? "yes" : "no"}\n` +
          (failures.length > 0
            ? `Failures: ${failures.slice(0, 10).join(", ")}`
            : ""),
        severity: "info",
      });
    }
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    success: true,
    eligible: candidates.length,
    stage1Sent,
    stage2Sent,
    preDeleteWarned,
    deleted,
    skippedStage2ByInteraction,
    deleteSkippedByConfig,
    dryRun: DRY_RUN,
    autoDeleteEnabled: AUTO_DELETE_ENABLED,
    failed,
    failures,
  });
}
