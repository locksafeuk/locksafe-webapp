/**
 * Descending-Clock Job Auction
 *
 * When a job lands in a postcode area with 3+ active+onboarded locksmiths,
 * instead of immediate dispatch we run a timed auction:
 *
 *   Step 0 → 40% commission offered  (small private cohort)
 *   Step 1 → 30% commission offered  (next private cohort)
 *   Step 2 → 25% commission offered  (remaining eligible locksmiths)
 *   EXPIRED → admin Telegram alert for manual assignment
 *
 * The first locksmith to tap "Accept" wins and the job is assigned at that rate.
 * Notifications are sent via Telegram inline buttons.
 */

import prisma from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";
import { sendNativePushToMany } from "@/lib/native-push";
import { sendWebPushToMany } from "@/lib/web-push";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUCTION_STEP_MINUTES = 2;

/** Commission rate for each auction step */
const STEP_RATES = [0.40, 0.30, 0.25] as const;

/**
 * Build non-overlapping locksmith cohorts for auction waves:
 * - Wave 1 (40%): 1-2 locksmiths
 * - Wave 2 (30%): 1-2 different locksmiths
 * - Wave 3 (25%): all remaining locksmiths
 */
export function buildAuctionCohorts(locksmithIds: string[]): [string[], string[], string[]] {
  const uniqueIds = [...new Set(locksmithIds)];
  const total = uniqueIds.length;

  // Keep at least one locksmith for the final wave.
  const firstWaveSize = Math.min(2, Math.max(1, total - 2));
  const firstWave = uniqueIds.slice(0, firstWaveSize);

  const remainingAfterFirst = uniqueIds.slice(firstWave.length);
  const secondWaveSize = Math.min(2, Math.max(1, remainingAfterFirst.length - 1));
  const secondWave = remainingAfterFirst.slice(0, secondWaveSize);

  const finalWave = remainingAfterFirst.slice(secondWave.length);
  return [firstWave, secondWave, finalWave];
}

export function getWaveRecipients(currentStep: number, locksmithIds: string[]): string[] {
  const [wave1, wave2, wave3] = buildAuctionCohorts(locksmithIds);
  if (currentStep === 0) return wave1;
  if (currentStep === 1) return wave2;
  if (currentStep === 2) return wave3;
  return [];
}

/** Haversine distance in miles */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Send a Telegram message to a specific chat with optional inline buttons.
 */
async function sendTelegramToChat(
  chatId: string,
  text: string,
  buttons?: Array<{ text: string; callback_data: string }>,
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (buttons?.length) {
    body.reply_markup = {
      inline_keyboard: buttons.map((btn) => [btn]),
    };
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine whether a new job should trigger an auction.
 * Returns the eligible locksmith IDs if an auction should run, otherwise null.
 */
export async function shouldTriggerAuction(
  postcode: string,
  jobLat?: number | null,
  jobLng?: number | null,
): Promise<string[] | null> {
  // Need coordinates to do radius check
  if (!jobLat || !jobLng) return null;

  const locksmiths = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      onboardingCompleted: true,
      isVerified: true,
      baseLat: { not: null },
      baseLng: { not: null },
    },
    select: {
      id: true,
      baseLat: true,
      baseLng: true,
      coverageRadius: true,
    },
  });

  const eligible = locksmiths
    .map((ls) => {
      if (ls.baseLat == null || ls.baseLng == null) return null;
      const dist = haversineDistance(jobLat, jobLng, ls.baseLat, ls.baseLng);
      const radius = ls.coverageRadius ?? 10;
      return { id: ls.id, dist, radius };
    })
    .filter((ls): ls is { id: string; dist: number; radius: number } => ls !== null)
    .filter((ls) => ls.dist <= ls.radius)
    .sort((a, b) => a.dist - b.dist);

  if (eligible.length >= 3) {
    return eligible.map((ls) => ls.id);
  }
  return null;
}

/**
 * Create a new JobAuction row and send the first wave of notifications.
 */
export async function createAuction(
  jobId: string,
  locksmithIds: string[],
): Promise<void> {
  const nextDropAt = new Date(Date.now() + AUCTION_STEP_MINUTES * 60 * 1000);

  await prisma.jobAuction.create({
    data: {
      jobId,
      state: "RUNNING",
      currentStep: 0,
      currentRate: STEP_RATES[0],
      nextDropAt,
      notifiedLocksmithIds: locksmithIds,
    },
  });

  // Mark the job with the notified locksmith IDs
  await prisma.job.update({
    where: { id: jobId },
    data: { notifiedLocksmithIds: locksmithIds, notifiedAt: new Date() },
  });

  const waveOneRecipients = getWaveRecipients(0, locksmithIds);
  await sendAuctionNotifications(jobId, 0, STEP_RATES[0], waveOneRecipients);
}

/**
 * Send Telegram inline-button notifications to locksmiths
 * for the current auction step.
 */
export async function sendAuctionNotifications(
  jobId: string,
  step: number,
  rate: number,
  locksmithIds: string[],
): Promise<void> {
  if (locksmithIds.length === 0) return;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      jobNumber: true,
      postcode: true,
      address: true,
      problemType: true,
      propertyType: true,
    },
  });
  if (!job) return;

  const keepPercent = Math.round((1 - rate) * 100);
  const commissionPercent = Math.round(rate * 100);
  const isFirstStep = step === 0;
  const dropMinutes = AUCTION_STEP_MINUTES;
  const waveLabel = step === 0 ? "Wave 1/3" : step === 1 ? "Wave 2/3" : "Wave 3/3";

  const text =
    `🔑 <b>New Job Auction – ${commissionPercent}% Commission</b>\n` +
    `📣 <b>${waveLabel}</b>\n\n` +
    `📋 <b>Job #${job.jobNumber}</b>\n` +
    `📍 ${job.address}, ${job.postcode}\n` +
    `🔑 ${job.problemType} · ${job.propertyType}\n\n` +
    `💰 Commission: <b>${commissionPercent}%</b> — you keep <b>${keepPercent}%</b>\n` +
    (isFirstStep
      ? `⏱️ Rate drops in ${dropMinutes} min if no one accepts.\n`
      : `⏱️ Rate already dropped — act now before the next drop.\n`) +
    `\nTap below to accept this job:`;

  const locksmiths = await prisma.locksmith.findMany({
    where: { id: { in: locksmithIds } },
    select: {
      id: true,
      name: true,
      telegramChatId: true,
      nativeDeviceToken: true,
      nativeTokenType: true,
      nativeTokenPlatform: true,
      webPushSubscription: true,
      pushNotifications: true,
    },
  });

  // ── Native push (primary channel — mobile app) ──────────────────────────
  const pushRecipients = locksmiths.filter(
    (ls) =>
      ls.nativeDeviceToken &&
      ls.nativeTokenType &&
      ls.nativeTokenPlatform &&
      ls.pushNotifications !== false,
  ) as Array<{
    id: string;
    name: string;
    nativeDeviceToken: string;
    nativeTokenType: string;
    nativeTokenPlatform: string;
  }>;

  const pushPayload = {
    title: `🔑 New Job — Keep ${100 - commissionPercent}%`,
    body: `${job.problemType} · ${job.propertyType} — ${job.postcode} (${waveLabel})`,
    badge: 1,
    data: {
      type: "job_auction",
      jobId,
      jobNumber: job.jobNumber,
      step: String(step),
      rate: String(rate),
      commissionPercent: String(commissionPercent),
      keepPercent: String(100 - commissionPercent),
      postcode: job.postcode,
    },
  };

  if (pushRecipients.length > 0) {
    await sendNativePushToMany(pushRecipients, pushPayload).catch((err) =>
      console.error("[JobAuction] Native push failed:", err),
    );
  }

  // ── Web push (PWA — secondary channel) ──────────────────────────────────
  const webRecipients = locksmiths.filter(
    (ls) => ls.webPushSubscription && ls.pushNotifications !== false,
  ) as Array<{ id: string; name: string; webPushSubscription: string }>;

  if (webRecipients.length > 0) {
    await sendWebPushToMany(webRecipients, {
      title: pushPayload.title,
      body: pushPayload.body,
      data: { ...pushPayload.data, url: "/locksmith/jobs" },
    }).catch((err) => console.error("[JobAuction] Web push failed:", err));
  }

  // ── Telegram inline buttons (supplementary — locksmiths with both channels) ─
  const button = {
    text: `✅ Accept at ${commissionPercent}% commission`,
    callback_data: `accept_auction:${jobId}`,
  };

  const telegramPromises = locksmiths
    .filter((ls) => ls.telegramChatId)
    .map((ls) =>
      sendTelegramToChat(ls.telegramChatId!, text, [button]),
    );

  await Promise.all(telegramPromises);
}

/**
 * A locksmith accepts the auction.
 * Validates state and returns success/failure.
 */
export async function acceptAuction(
  jobId: string,
  locksmithId: string,
): Promise<{ success: boolean; message: string; rate?: number }> {
  const auction = await prisma.jobAuction.findUnique({
    where: { jobId },
  });

  if (!auction) return { success: false, message: "Auction not found" };
  if (auction.state !== "RUNNING")
    return {
      success: false,
      message: `Auction already ${auction.state.toLowerCase()}`,
    };
  if (!auction.notifiedLocksmithIds.includes(locksmithId))
    return {
      success: false,
      message: "You were not invited to this auction",
    };

  const currentWaveRecipients = getWaveRecipients(
    auction.currentStep,
    auction.notifiedLocksmithIds,
  );
  if (!currentWaveRecipients.includes(locksmithId)) {
    return {
      success: false,
      message:
        "This offer is currently open to another locksmith cohort. You were not invited for this wave.",
    };
  }

  // Accept the auction and assign the job — both in a transaction
  await prisma.$transaction([
    prisma.jobAuction.update({
      where: { jobId },
      data: {
        state: "ACCEPTED",
        acceptedByLocksmithId: locksmithId,
        acceptedRate: auction.currentRate,
        acceptedAt: new Date(),
      },
    }),
    prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        commissionRate: auction.currentRate > 0.25 ? auction.currentRate : undefined,
      },
    }),
  ]);

  // Assign the locksmith AND move the job into the ACCEPTED state. Previously
  // this only set { locksmithId }, leaving the job PENDING — so it kept showing
  // in other locksmiths' feeds, still accepted new applications, showed the
  // customer the wrong status, and recorded no fee. Mirror the accept-application
  // path: ACCEPTED + acceptedAt + committed fee + assessmentPaid. Guard the write
  // on status:PENDING so a job already taken via the normal path isn't clobbered.
  const assigned = await prisma.job.updateMany({
    where: { id: jobId, status: "PENDING", locksmithId: null },
    data: {
      status: "ACCEPTED",
      locksmithId,
      acceptedAt: new Date(),
      assessmentPaid: true,
    },
  });

  if (assigned.count === 0) {
    return {
      success: false,
      message: "Job is no longer available (already assigned or not pending).",
      rate: auction.currentRate,
    };
  }

  return { success: true, message: "Auction accepted", rate: auction.currentRate };
}

/**
 * Advance auction by one step (called by cron every 1 min).
 * If past the last step, marks EXPIRED and alerts admin.
 */
export async function advanceAuction(jobId: string): Promise<void> {
  const auction = await prisma.jobAuction.findUnique({
    where: { jobId },
  });
  if (!auction || auction.state !== "RUNNING") return;

  const nextStep = auction.currentStep + 1;

  if (nextStep >= STEP_RATES.length) {
    // No more steps — expire and alert admin
    await prisma.jobAuction.update({
      where: { jobId },
      data: { state: "EXPIRED" },
    });

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { jobNumber: true, postcode: true, address: true },
    });

    await sendAdminAlert({
      title: "Job Auction Expired — Manual Assignment Needed",
      message:
        `Job #${job?.jobNumber ?? jobId} (${job?.address ?? ""}, ${job?.postcode ?? ""}) reached 25% commission and no locksmith accepted.\n\n` +
        `Action required: assign manually from /admin/commission-tiers`,
      severity: "warning",
    }).catch(() => {});
    return;
  }

  const newRate = STEP_RATES[nextStep];
  const nextDropAt = new Date(Date.now() + AUCTION_STEP_MINUTES * 60 * 1000);
  const nextWaveRecipients = getWaveRecipients(nextStep, auction.notifiedLocksmithIds);

  if (nextWaveRecipients.length === 0) {
    // No further cohort to notify — expire AND alert admin so the job isn't
    // silently stranded (the final-step branch above alerts; this one used to
    // return without any notification, leaving a stuck job nobody knew about).
    await prisma.jobAuction.update({
      where: { jobId },
      data: { state: "EXPIRED" },
    });

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { jobNumber: true, postcode: true, address: true },
    });

    await sendAdminAlert({
      title: "Job Auction Expired — No Locksmiths Left to Notify",
      message:
        `Job #${job?.jobNumber ?? jobId} (${job?.address ?? ""}, ${job?.postcode ?? ""}) exhausted its locksmith cohort with no acceptance.\n\n` +
        `Action required: assign manually from /admin/commission-tiers`,
      severity: "warning",
    }).catch(() => {});
    return;
  }

  await prisma.jobAuction.update({
    where: { jobId },
    data: {
      currentStep: nextStep,
      currentRate: newRate,
      nextDropAt,
    },
  });

  await sendAuctionNotifications(
    jobId,
    nextStep,
    newRate,
    nextWaveRecipients,
  );
}

/**
 * Admin manually assigns a job from an expired auction at 25% commission.
 */
export async function adminAssignAuction(
  jobId: string,
  locksmithId: string,
): Promise<{ success: boolean; message: string }> {
  const auction = await prisma.jobAuction.findUnique({ where: { jobId } });
  if (!auction)
    return { success: false, message: "Auction not found" };
  if (!["EXPIRED", "RUNNING"].includes(auction.state))
    return { success: false, message: `Auction already ${auction.state.toLowerCase()}` };

  await prisma.$transaction([
    prisma.jobAuction.update({
      where: { jobId },
      data: {
        state: "ADMIN_ASSIGNED",
        acceptedByLocksmithId: locksmithId,
        acceptedRate: 0.25,
        acceptedAt: new Date(),
      },
    }),
    prisma.job.update({
      where: { id: jobId },
      data: { locksmithId },
    }),
  ]);

  return { success: true, message: "Admin assigned at 25% commission" };
}
