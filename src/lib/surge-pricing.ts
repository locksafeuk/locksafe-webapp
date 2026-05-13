/**
 * Surge / Dynamic Pricing Engine
 *
 * Adjusts the assessment fee (base: £29) based on:
 * - Time of day (peak evening / night / weekend uplift)
 * - Recent demand (jobs created in the last 30 minutes in the same postcode area)
 *
 * The customer always sees the final price before paying — no hidden charges.
 */

import prisma from "@/lib/db";

const BASE_FEE = 29.0; // £29 standard assessment fee

/** Minimum and maximum billable fees */
const MIN_FEE = 29.0;
const MAX_FEE = 99.0;

/** Uplift multipliers applied on top of each other */
const UPLIFT = {
  /** 18:00–22:59 weekday evening */
  EVENING: 1.2, // +20%
  /** 23:00–06:59 any day — late night */
  LATE_NIGHT: 1.5, // +50%
  /** Saturday or Sunday any time */
  WEEKEND: 1.3, // +30%
  /** Bank holiday (Christmas Day, New Year's Day, Good Friday, etc.) */
  BANK_HOLIDAY: 1.5, // +50%
  /** High local demand — 3+ jobs in last 30 min in same postcode area */
  HIGH_DEMAND: 1.15, // +15%
  /** Very high local demand — 6+ jobs in last 30 min in same postcode area */
  VERY_HIGH_DEMAND: 1.3, // +30%
};

/** UK bank holidays (year-agnostic, checked by month-day) */
const BANK_HOLIDAY_DATES = new Set([
  "01-01", // New Year's Day
  "12-25", // Christmas Day
  "12-26", // Boxing Day
]);

export interface SurgePricingResult {
  fee: number;
  multiplier: number;
  reasons: string[];
  isSurge: boolean;
}

/**
 * Calculate dynamic assessment fee for a job.
 *
 * @param postcode - The customer's postcode (used for demand lookup)
 * @param now      - Inject current time (defaults to new Date()) — useful for testing
 */
export async function calculateSurgeFee(
  postcode: string,
  now: Date = new Date()
): Promise<SurgePricingResult> {
  let multiplier = 1.0;
  const reasons: string[] = [];

  // -- Time of day --
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;
  const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isBankHoliday = BANK_HOLIDAY_DATES.has(monthDay);
  const isLateNight = hour < 7 || hour >= 23;
  const isEvening = !isLateNight && hour >= 18;

  if (isBankHoliday) {
    multiplier *= UPLIFT.BANK_HOLIDAY;
    reasons.push("Bank holiday");
  } else if (isWeekend) {
    multiplier *= UPLIFT.WEEKEND;
    reasons.push("Weekend");
  }

  if (isLateNight) {
    multiplier *= UPLIFT.LATE_NIGHT;
    reasons.push("Late night (11 pm–7 am)");
  } else if (isEvening) {
    multiplier *= UPLIFT.EVENING;
    reasons.push("Evening (6–11 pm)");
  }

  // -- Local demand --
  const postcodeArea = postcode.replace(/\s/g, "").slice(0, 4).toUpperCase(); // e.g. "SW1A"
  const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);

  let recentJobCount = 0;
  try {
    recentJobCount = await prisma.job.count({
      where: {
        postcode: { startsWith: postcodeArea },
        createdAt: { gte: thirtyMinsAgo },
      },
    });
  } catch {
    // Fail silently — don't block job creation on DB errors
    console.warn("[SurgePricing] Could not fetch recent job count");
  }

  if (recentJobCount >= 6) {
    multiplier *= UPLIFT.VERY_HIGH_DEMAND;
    reasons.push("Very high demand in your area");
  } else if (recentJobCount >= 3) {
    multiplier *= UPLIFT.HIGH_DEMAND;
    reasons.push("High demand in your area");
  }

  const rawFee = BASE_FEE * multiplier;
  // Round to nearest £1
  const fee = Math.min(MAX_FEE, Math.max(MIN_FEE, Math.round(rawFee)));

  return {
    fee,
    multiplier: Math.round(multiplier * 100) / 100,
    reasons,
    isSurge: fee > BASE_FEE,
  };
}

/**
 * Describe surge in plain English for the customer.
 * e.g. "Evening call-out rate applies (+20%)"
 */
export function describeSurge(result: SurgePricingResult): string | null {
  if (!result.isSurge) return null;
  const pct = Math.round((result.multiplier - 1) * 100);
  return `${result.reasons.join(" · ")} — ${pct}% call-out uplift applies`;
}
