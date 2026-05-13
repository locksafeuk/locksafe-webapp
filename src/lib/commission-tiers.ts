/**
 * Commission Tier Management
 *
 * Evaluates 3 triggers to determine whether a locksmith should be on
 * the PREMIUM tier (higher commission) vs STANDARD (base rates):
 *
 * Trigger 1: HIGH_EARNER    – £300+ earnings in the last 30 days
 * Trigger 2: REGULAR_AREA   – 3+ jobs from the same outward postcode in 30 days
 * Trigger 3: AREA_SATURATION – 3+ active+onboarded locksmiths covering the same base area
 *
 * ANY ONE trigger → PREMIUM tier (not all required).
 * commissionOverride=true skips auto-update for that locksmith.
 */

import prisma from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";

// Haversine formula (miles)
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

/** Outward code = "SW1A" from "SW1A 2AA" */
function outwardCode(postcode: string): string {
  return postcode.trim().toUpperCase().split(" ")[0];
}

export interface TierEvaluation {
  tier: "STANDARD" | "PREMIUM";
  reasons: string[];
}

/**
 * Evaluate tier triggers for a single locksmith.
 */
export async function evaluateTierTriggers(
  locksmithId: string,
): Promise<TierEvaluation> {
  const reasons: string[] = [];

  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    select: {
      totalEarnings: true,
      baseLat: true,
      baseLng: true,
      coverageRadius: true,
      jobs: {
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          status: {
            in: [
              "COMPLETED",
              "SIGNED",
              "PENDING_CUSTOMER_CONFIRMATION",
            ],
          },
        },
        select: { postcode: true },
      },
    },
  });

  if (!locksmith) return { tier: "STANDARD", reasons: [] };

  // --- Trigger 1: HIGH_EARNER ---
  if (locksmith.totalEarnings >= 300) {
    reasons.push("high_earner");
  }

  // --- Trigger 2: REGULAR_AREA (3+ jobs from same outward code in 30 days) ---
  const outwardCounts: Record<string, number> = {};
  for (const job of locksmith.jobs) {
    const oc = outwardCode(job.postcode);
    outwardCounts[oc] = (outwardCounts[oc] ?? 0) + 1;
  }
  if (Object.values(outwardCounts).some((count) => count >= 3)) {
    reasons.push("regular_area");
  }

  // --- Trigger 3: AREA_SATURATION (3+ locksmiths covering same base area) ---
  if (locksmith.baseLat != null && locksmith.baseLng != null) {
    const radiusMiles = locksmith.coverageRadius ?? 10;
    const allLocksmiths = await prisma.locksmith.findMany({
      where: {
        isActive: true,
        onboardingCompleted: true,
        id: { not: locksmithId },
        baseLat: { not: null },
        baseLng: { not: null },
      },
      select: { baseLat: true, baseLng: true },
    });

    let overlapping = 0;
    for (const other of allLocksmiths) {
      if (other.baseLat == null || other.baseLng == null) continue;
      const dist = haversineDistance(
        locksmith.baseLat,
        locksmith.baseLng,
        other.baseLat,
        other.baseLng,
      );
      if (dist <= radiusMiles) overlapping++;
    }
    if (overlapping >= 2) {
      // 2 others + self = 3 total covering same area
      reasons.push("area_saturation");
    }
  }

  const tier = reasons.length > 0 ? "PREMIUM" : "STANDARD";
  return { tier, reasons };
}

/**
 * Evaluate and update a single locksmith's tier if it has changed.
 * Skips locksmiths with commissionOverride=true.
 */
export async function syncLocksmithTier(locksmithId: string): Promise<void> {
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    select: {
      id: true,
      name: true,
      commissionTier: true,
      commissionOverride: true,
    },
  });

  if (!locksmith || locksmith.commissionOverride) return;

  const { tier, reasons } = await evaluateTierTriggers(locksmithId);

  if (tier === locksmith.commissionTier) return; // No change needed

  // PREMIUM: 40% work quote, 20% assessment (starting point for auction)
  // STANDARD: 25% work quote, 15% assessment (base rates)
  const newRates =
    tier === "PREMIUM"
      ? { commissionRate: 0.3, commissionAssessmentRate: 0.2 }
      : { commissionRate: 0.25, commissionAssessmentRate: 0.15 };

  await prisma.locksmith.update({
    where: { id: locksmithId },
    data: {
      commissionTier: tier,
      commissionTierReasons: reasons,
      commissionTierUpdatedAt: new Date(),
      ...newRates,
    },
  });

  await sendAdminAlert({
    title: `Commission Tier Changed: ${locksmith.name}`,
    message: `Locksmith ${locksmith.name} moved from ${locksmith.commissionTier} → ${tier}.\nReasons: ${reasons.join(", ") || "none"}\nNew rates: assessment ${newRates.commissionAssessmentRate * 100}%, work ${newRates.commissionRate * 100}%`,
    severity: tier === "PREMIUM" ? "info" : "info",
  }).catch(() => {});
}

/**
 * Sync all active, onboarded locksmiths.
 * Called by the daily cron job.
 */
export async function syncAllLocksmithTiers(): Promise<{
  checked: number;
  updated: number;
}> {
  const locksmiths = await prisma.locksmith.findMany({
    where: { isActive: true, onboardingCompleted: true, commissionOverride: false },
    select: { id: true },
  });

  let updated = 0;
  for (const { id } of locksmiths) {
    const before = await prisma.locksmith.findUnique({
      where: { id },
      select: { commissionTier: true },
    });
    await syncLocksmithTier(id);
    const after = await prisma.locksmith.findUnique({
      where: { id },
      select: { commissionTier: true },
    });
    if (before?.commissionTier !== after?.commissionTier) updated++;
  }

  return { checked: locksmiths.length, updated };
}
