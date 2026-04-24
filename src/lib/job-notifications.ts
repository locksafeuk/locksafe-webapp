import prisma from "@/lib/db";
import { sendAutoDispatchEmail, sendNewJobInAreaEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { calculateDistanceMiles } from "@/lib/utils";
import {
  notifyLocksmith,
  notifyLocksmiths,
  notifyCustomer,
  isOneSignalConfigured,
} from "@/lib/onesignal";

interface JobForNotification {
  id: string;
  jobNumber: string;
  problemType: string;
  propertyType?: string;
  postcode: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  createdAt?: string;
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

/**
 * Find all locksmiths within coverage range of a job and send them notifications
 */
export async function notifyNearbyLocksmiths(job: JobForNotification): Promise<{
  notifiedCount: number;
  locksmithIds: string[];
}> {
  // If job doesn't have coordinates, we can't do radius filtering
  if (!job.latitude || !job.longitude) {
    console.log(
      `[Job Notifications] Job ${job.jobNumber} has no coordinates, skipping notifications`,
    );
    return { notifiedCount: 0, locksmithIds: [] };
  }

  try {
    // Get all active AND available locksmiths with location set
    // isAvailable must be true for locksmith to receive notifications
    const locksmiths = await prisma.locksmith.findMany({
      where: {
        isActive: true,
        isAvailable: true, // Only notify locksmiths who are available
        baseLat: { not: null },
        baseLng: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        baseLat: true,
        baseLng: true,
        coverageRadius: true,
        stripeConnectVerified: true,
        oneSignalPlayerId: true, // For push notifications
      },
    });

    const nearbyLocksmiths: Array<{
      id: string;
      name: string;
      email: string;
      distance: number;
      oneSignalPlayerId: string | null;
    }> = [];

    for (const locksmith of locksmiths) {
      if (!locksmith.baseLat || !locksmith.baseLng) continue;

      const distance = calculateDistanceMiles(
        locksmith.baseLat,
        locksmith.baseLng,
        job.latitude,
        job.longitude,
      );

      const coverageRadius = locksmith.coverageRadius || 10;

      if (distance <= coverageRadius) {
        nearbyLocksmiths.push({
          id: locksmith.id,
          name: locksmith.name,
          email: locksmith.email,
          distance: Math.round(distance * 10) / 10,
          oneSignalPlayerId: locksmith.oneSignalPlayerId,
        });
        console.log(
          `[Job Notifications] Locksmith ${locksmith.name} (${locksmith.id}) is ${distance.toFixed(1)} miles away - within ${coverageRadius} mile radius`,
        );
      }
    }

    if (nearbyLocksmiths.length === 0) {
      console.log(
        `[Job Notifications] No locksmiths within range for job ${job.jobNumber}`,
      );
      return { notifiedCount: 0, locksmithIds: [] };
    }

    console.log(
      `[Job Notifications] Found ${nearbyLocksmiths.length} locksmiths within range for job ${job.jobNumber}`,
    );

    const locksmithIds = nearbyLocksmiths.map((ls) => ls.id);

    // Broadcast notification to all nearby locksmiths via SSE
    // This will be picked up by SSE streams in the frontend
    try {
      const notificationPayload = {
        type: "NEW_JOB_IN_AREA",
        jobId: job.id,
        jobNumber: job.jobNumber,
        problemType: problemLabels[job.problemType] || job.problemType,
        postcode: job.postcode,
        address: job.address,
        locksmithIds: locksmithIds,
        timestamp: new Date().toISOString(),
      };

      // Try to broadcast via the notification endpoint
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

      await fetch(`${baseUrl}/api/notifications/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPayload),
      }).catch((err) => {
        // Don't fail if broadcast fails - it's best effort
        console.log(
          "[Job Notifications] Broadcast request failed:",
          err.message,
        );
      });
    } catch (broadcastError) {
      console.log(
        "[Job Notifications] Could not broadcast notification:",
        broadcastError,
      );
    }

    // Send email notifications to all nearby locksmiths (async, don't await)
    for (const locksmith of nearbyLocksmiths) {
      sendNewJobInAreaEmail(locksmith.email, {
        locksmithName: locksmith.name,
        jobNumber: job.jobNumber,
        problemType: job.problemType,
        postcode: job.postcode,
        address: job.address,
        distanceMiles: locksmith.distance,
        propertyType: job.propertyType,
        createdAt: job.createdAt || new Date().toISOString(),
      })
        .then((result) => {
          if (result.success) {
            console.log(
              `[Job Notifications] Email sent to ${locksmith.email} for job ${job.jobNumber}`,
            );
          } else {
            console.log(
              `[Job Notifications] Email failed to ${locksmith.email}:`,
              result.error,
            );
          }
        })
        .catch((err) => {
          console.error(
            `[Job Notifications] Email error for ${locksmith.email}:`,
            err,
          );
        });
    }

    console.log(
      `[Job Notifications] Sending emails to ${nearbyLocksmiths.length} locksmiths`,
    );

    // Send OneSignal push notifications to locksmiths with subscriptions
    if (isOneSignalConfigured()) {
      const playerIds = nearbyLocksmiths
        .filter((ls) => ls.oneSignalPlayerId)
        .map((ls) => ls.oneSignalPlayerId as string);

      if (playerIds.length > 0) {
        notifyLocksmiths(playerIds, "NEW_JOB_AVAILABLE", {
          jobId: job.id,
          variables: {
            jobNumber: job.jobNumber,
            postcode: job.postcode,
            problemType: problemLabels[job.problemType] || job.problemType,
          },
        })
          .then((result) => {
            if (result.id) {
              console.log(
                `[Job Notifications] Push sent to ${playerIds.length} locksmiths (OneSignal ID: ${result.id})`,
              );
            } else if (result.errors) {
              console.log(
                `[Job Notifications] Push errors:`,
                result.errors,
              );
            }
          })
          .catch((err) => {
            console.error("[Job Notifications] Push notification error:", err);
          });
      }
    }

    return {
      notifiedCount: nearbyLocksmiths.length,
      locksmithIds: locksmithIds,
    };
  } catch (error) {
    console.error("[Job Notifications] Error notifying locksmiths:", error);
    return { notifiedCount: 0, locksmithIds: [] };
  }
}

/**
 * Get locksmiths who are within range of a job location
 */
export async function getLocksmitheInRange(
  latitude: number,
  longitude: number,
  includeUnavailable = false,
): Promise<Array<{ id: string; name: string; distance: number }>> {
  const locksmiths = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      ...(includeUnavailable ? {} : { isAvailable: true }), // Only available locksmiths unless specified
      baseLat: { not: null },
      baseLng: { not: null },
    },
    select: {
      id: true,
      name: true,
      baseLat: true,
      baseLng: true,
      coverageRadius: true,
    },
  });

  const inRange: Array<{ id: string; name: string; distance: number }> = [];

  for (const locksmith of locksmiths) {
    if (!locksmith.baseLat || !locksmith.baseLng) continue;

    const distance = calculateDistanceMiles(
      locksmith.baseLat,
      locksmith.baseLng,
      latitude,
      longitude,
    );

    const coverageRadius = locksmith.coverageRadius || 10;

    if (distance <= coverageRadius) {
      inRange.push({
        id: locksmith.id,
        name: locksmith.name,
        distance: Math.round(distance * 10) / 10,
      });
    }
  }

  // Sort by distance
  inRange.sort((a, b) => a.distance - b.distance);

  return inRange;
}

/**
 * Send SMS notification to a locksmith about a new job (for auto-dispatch)
 */
export async function sendJobNotificationSMS(data: {
  locksmithPhone: string;
  locksmithName: string;
  jobNumber: string;
  jobId: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  customerName: string;
  isAutoDispatch?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";
  const problemLabel = problemLabels[data.problemType] || data.problemType;

  const message = data.isAutoDispatch
    ? `LockSafe AUTO-DISPATCH: Job ${data.jobNumber} assigned to you!\n\n${problemLabel} at ${data.postcode}\nCustomer: ${data.customerName}\n\nView & Accept: ${siteUrl}/locksmith/job/${data.jobId}`
    : `LockSafe: New job ${data.jobNumber} in your area!\n\n${problemLabel} at ${data.postcode}\nCustomer: ${data.customerName}\n\nApply now: ${siteUrl}/locksmith/jobs`;

  try {
    const result = await sendSMS(data.locksmithPhone, message);
    return { success: result.success, error: result.error };
  } catch (error) {
    console.error("[Job Notifications] SMS send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send email notification to a locksmith about a new job (for auto-dispatch)
 */
export async function sendJobNotificationEmail(data: {
  locksmithEmail: string;
  locksmithName: string;
  jobNumber: string;
  jobId: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  customerName: string;
  assessmentFee: number;
  isAutoDispatch?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (data.isAutoDispatch) {
      // Use auto-dispatch email template
      const result = await sendAutoDispatchEmail(data.locksmithEmail, {
        locksmithName: data.locksmithName,
        jobNumber: data.jobNumber,
        jobId: data.jobId,
        problemType: data.problemType,
        propertyType: data.propertyType,
        postcode: data.postcode,
        address: data.address,
        customerName: data.customerName,
        assessmentFee: data.assessmentFee,
      });
      return result;
    }

    // Use standard new job email
    const result = await sendNewJobInAreaEmail(data.locksmithEmail, {
      locksmithName: data.locksmithName,
      jobNumber: data.jobNumber,
      problemType: data.problemType,
      postcode: data.postcode,
      address: data.address,
      distanceMiles: 0, // Not calculated for direct notifications
      propertyType: data.propertyType,
      createdAt: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    console.error("[Job Notifications] Email send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ==========================================
// ONESIGNAL PUSH NOTIFICATION HELPERS
// ==========================================

/**
 * Send push notification to a customer about their job
 */
export async function sendCustomerPushNotification(
  customerId: string,
  template:
    | "LOCKSMITH_ASSIGNED"
    | "LOCKSMITH_EN_ROUTE"
    | "LOCKSMITH_ARRIVED"
    | "QUOTE_READY"
    | "WORK_COMPLETE"
    | "SIGNATURE_REMINDER",
  options: {
    jobId?: string;
    variables?: Record<string, string>;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  if (!isOneSignalConfigured()) {
    return { success: false, error: "OneSignal not configured" };
  }

  try {
    // Get customer's OneSignal player ID
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { oneSignalPlayerId: true },
    });

    if (!customer?.oneSignalPlayerId) {
      return { success: false, error: "Customer has no push subscription" };
    }

    const result = await notifyCustomer(customer.oneSignalPlayerId, template, options);

    if (result.errors?.length) {
      return { success: false, error: result.errors.join(", ") };
    }

    return { success: true };
  } catch (error) {
    console.error("[Job Notifications] Customer push error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send push notification to a locksmith about their job
 */
export async function sendLocksmithPushNotification(
  locksmithId: string,
  template:
    | "NEW_JOB_AVAILABLE"
    | "JOB_ACCEPTED"
    | "JOB_ASSIGNED"
    | "QUOTE_ACCEPTED"
    | "QUOTE_DECLINED"
    | "CUSTOMER_SIGNED"
    | "PAYOUT_SENT",
  options: {
    jobId?: string;
    variables?: Record<string, string>;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  if (!isOneSignalConfigured()) {
    return { success: false, error: "OneSignal not configured" };
  }

  try {
    // Get locksmith's OneSignal player ID
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: { oneSignalPlayerId: true },
    });

    if (!locksmith?.oneSignalPlayerId) {
      return { success: false, error: "Locksmith has no push subscription" };
    }

    const result = await notifyLocksmith(locksmith.oneSignalPlayerId, template, options);

    if (result.errors?.length) {
      return { success: false, error: result.errors.join(", ") };
    }

    return { success: true };
  } catch (error) {
    console.error("[Job Notifications] Locksmith push error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
