/**
 * LockSafe UK - Locksmith Matcher
 *
 * Finds nearby locksmiths based on postcode/coordinates and handles
 * real-time notification dispatch for the emergency workflow.
 */

import prisma from "@/lib/db";
import { calculateDistanceMiles } from "@/lib/utils";
import { sendSMS } from "@/lib/sms";
import { sendNewJobInAreaEmail } from "@/lib/email";
import {
  notifyLocksmiths as pushNotifyLocksmiths,
  isOneSignalConfigured,
} from "@/lib/onesignal";

// ============================================
// TYPES
// ============================================

export interface NearbyLocksmith {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
  phone: string;
  distance: number; // miles
  rating: number;
  totalJobs: number;
  defaultAssessmentFee: number | null;
  coverageRadius: number;
  stripeConnectVerified: boolean;
  oneSignalPlayerId: string | null;
  insuranceStatus: string;
  isVerified: boolean;
}

export interface MatcherOptions {
  maxDistance?: number; // Override max distance in miles
  limit?: number; // Max number of locksmiths to return
  requireStripeConnect?: boolean; // Only return locksmiths with verified Stripe
  requireVerified?: boolean; // Only return verified locksmiths
  sortBy?: "distance" | "rating" | "totalJobs";
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

// ============================================
// POSTCODE GEOCODING
// ============================================

/**
 * Convert a UK postcode to latitude/longitude using postcodes.io
 */
export async function geocodePostcode(
  postcode: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const cleanPostcode = postcode.replace(/\s/g, "").toUpperCase();
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${cleanPostcode}`
    );
    const data = await response.json();

    if (data.status === 200 && data.result) {
      return {
        latitude: data.result.latitude,
        longitude: data.result.longitude,
      };
    }

    console.warn(`[Locksmith Matcher] Postcode lookup failed for ${postcode}:`, data);
    return null;
  } catch (error) {
    console.error(`[Locksmith Matcher] Geocoding error for ${postcode}:`, error);
    return null;
  }
}

// ============================================
// FIND NEARBY LOCKSMITHS
// ============================================

/**
 * Find locksmiths near a given location
 * Uses radius-based filtering with haversine distance calculation
 */
export async function findNearbyLocksmiths(
  latitude: number,
  longitude: number,
  options: MatcherOptions = {}
): Promise<NearbyLocksmith[]> {
  const {
    maxDistance,
    limit = 20,
    requireStripeConnect = false,
    requireVerified = false,
    sortBy = "distance",
  } = options;

  // Query all active, available locksmiths with location
  const whereClause: Record<string, unknown> = {
    isActive: true,
    isAvailable: true,
    baseLat: { not: null },
    baseLng: { not: null },
  };

  if (requireStripeConnect) {
    whereClause.stripeConnectVerified = true;
  }

  if (requireVerified) {
    whereClause.isVerified = true;
  }

  const locksmiths = await prisma.locksmith.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      phone: true,
      baseLat: true,
      baseLng: true,
      coverageRadius: true,
      rating: true,
      totalJobs: true,
      defaultAssessmentFee: true,
      stripeConnectVerified: true,
      stripeConnectId: true,
      oneSignalPlayerId: true,
      smsNotifications: true,
      emailNotifications: true,
      pushNotifications: true,
      insuranceStatus: true,
      isVerified: true,
    },
  });

  const nearby: NearbyLocksmith[] = [];

  for (const locksmith of locksmiths) {
    if (!locksmith.baseLat || !locksmith.baseLng) continue;

    // Skip locksmiths with expired insurance
    if (locksmith.insuranceStatus === "expired") continue;

    const distance = calculateDistanceMiles(
      locksmith.baseLat,
      locksmith.baseLng,
      latitude,
      longitude
    );

    const coverageRadius = locksmith.coverageRadius || 10;
    const effectiveMaxDistance = maxDistance || coverageRadius;

    if (distance <= effectiveMaxDistance) {
      nearby.push({
        id: locksmith.id,
        name: locksmith.name,
        companyName: locksmith.companyName,
        email: locksmith.email,
        phone: locksmith.phone,
        distance: Math.round(distance * 10) / 10,
        rating: locksmith.rating,
        totalJobs: locksmith.totalJobs,
        defaultAssessmentFee: locksmith.defaultAssessmentFee,
        coverageRadius,
        stripeConnectVerified: locksmith.stripeConnectVerified,
        oneSignalPlayerId: locksmith.oneSignalPlayerId,
        insuranceStatus: locksmith.insuranceStatus,
        isVerified: locksmith.isVerified,
      });
    }
  }

  // Sort results
  switch (sortBy) {
    case "rating":
      nearby.sort((a, b) => b.rating - a.rating || a.distance - b.distance);
      break;
    case "totalJobs":
      nearby.sort((a, b) => b.totalJobs - a.totalJobs || a.distance - b.distance);
      break;
    case "distance":
    default:
      nearby.sort((a, b) => a.distance - b.distance);
      break;
  }

  return nearby.slice(0, limit);
}

/**
 * Find nearby locksmiths by postcode
 * Convenience wrapper that geocodes the postcode first
 */
export async function findNearbyLocksmithsByPostcode(
  postcode: string,
  options: MatcherOptions = {}
): Promise<{ locksmiths: NearbyLocksmith[]; coordinates: { latitude: number; longitude: number } | null }> {
  const coords = await geocodePostcode(postcode);

  if (!coords) {
    console.warn(`[Locksmith Matcher] Could not geocode postcode: ${postcode}`);
    return { locksmiths: [], coordinates: null };
  }

  const locksmiths = await findNearbyLocksmiths(
    coords.latitude,
    coords.longitude,
    options
  );

  return { locksmiths, coordinates: coords };
}

// ============================================
// NOTIFY LOCKSMITHS
// ============================================

/**
 * Send emergency job notifications to nearby locksmiths via all channels
 * Returns list of notified locksmith IDs
 */
export async function notifyLocksmitheEmergency(params: {
  locksmiths: NearbyLocksmith[];
  job: {
    id: string;
    jobNumber: string;
    problemType: string;
    propertyType?: string;
    postcode: string;
    address: string;
    customerName: string;
    isEmergency?: boolean;
  };
}): Promise<{ notifiedCount: number; locksmithIds: string[] }> {
  const { locksmiths, job } = params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";
  const problemLabel = problemLabels[job.problemType] || job.problemType;
  const locksmithIds: string[] = [];

  for (const locksmith of locksmiths) {
    try {
      locksmithIds.push(locksmith.id);

      // SMS notification
      const urgencyPrefix = job.isEmergency ? "🚨 EMERGENCY: " : "";
      const smsMessage = `${urgencyPrefix}LockSafe: New job ${job.jobNumber} near you!\n\n${problemLabel} at ${job.postcode}\nDistance: ${locksmith.distance} miles\nCustomer: ${job.customerName}\n\nApply now: ${siteUrl}/locksmith/jobs/${job.id}`;

      sendSMS(locksmith.phone, smsMessage, {
        logContext: `Emergency job ${job.jobNumber} to ${locksmith.name}`,
      }).catch((err) =>
        console.error(
          `[Locksmith Matcher] SMS error for ${locksmith.name}:`,
          err
        )
      );

      // Email notification
      sendNewJobInAreaEmail(locksmith.email, {
        locksmithName: locksmith.name,
        jobNumber: job.jobNumber,
        problemType: job.problemType,
        postcode: job.postcode,
        address: job.address,
        distanceMiles: locksmith.distance,
        propertyType: job.propertyType,
        createdAt: new Date().toISOString(),
      }).catch((err) =>
        console.error(
          `[Locksmith Matcher] Email error for ${locksmith.name}:`,
          err
        )
      );

      console.log(
        `[Locksmith Matcher] Notified ${locksmith.name} (${locksmith.distance} mi) for job ${job.jobNumber}`
      );
    } catch (error) {
      console.error(
        `[Locksmith Matcher] Error notifying ${locksmith.name}:`,
        error
      );
    }
  }

  // Push notifications (batch)
  if (isOneSignalConfigured()) {
    const playerIds = locksmiths
      .filter((ls) => ls.oneSignalPlayerId)
      .map((ls) => ls.oneSignalPlayerId as string);

    if (playerIds.length > 0) {
      pushNotifyLocksmiths(playerIds, "NEW_JOB_AVAILABLE", {
        jobId: job.id,
        variables: {
          postcode: job.postcode,
          problemType: problemLabel,
        },
      }).catch((err) =>
        console.error("[Locksmith Matcher] Push notification error:", err)
      );
    }
  }

  // Broadcast via SSE
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    await fetch(`${baseUrl}/api/notifications/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "NEW_EMERGENCY_JOB",
        jobId: job.id,
        jobNumber: job.jobNumber,
        problemType: problemLabel,
        postcode: job.postcode,
        locksmithIds,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {
    // Best effort
  }

  return {
    notifiedCount: locksmithIds.length,
    locksmithIds,
  };
}
