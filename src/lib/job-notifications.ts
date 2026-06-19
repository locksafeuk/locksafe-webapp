import prisma from "@/lib/db";
import { sendAutoDispatchEmail, sendNewJobInAreaEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { calculateDistanceMiles } from "@/lib/utils";
import { sendNativePushToMany } from "@/lib/native-push";
import { sendWebPushToMany } from "@/lib/web-push";

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
        nativeDeviceToken: true, // For native APNs/FCM push (mobile app)
        nativeTokenType: true,
        nativeTokenPlatform: true,
        webPushSubscription: true, // For PWA web push (browser-installed app)
        emailNotifications: true, // Respect per-locksmith email opt-out (email loop only)
      },
    });

    // Locksmiths who turned OFF email notifications. Applied in the EMAIL loop
    // only — push/SMS preferences are handled on their own channels. Previously
    // the email loop ignored this and emailed everyone in range.
    const emailOptOutIds = new Set(
      locksmiths.filter((l) => l.emailNotifications === false).map((l) => l.id),
    );

    const nearbyLocksmiths: Array<{
      id: string;
      name: string;
      email: string;
      distance: number;
      nativeDeviceToken: string | null;
      nativeTokenType: string | null;
      nativeTokenPlatform: string | null;
      webPushSubscription: string | null;
    }> = [];

    // Pre-compute distance for every candidate so we can do the in-radius pass
    // and (if empty) fall back to progressively wider radii without re-querying.
    const scored = locksmiths
      .filter((l) => l.baseLat != null && l.baseLng != null)
      .map((l) => ({
        l,
        distance: calculateDistanceMiles(
          l.baseLat as number,
          l.baseLng as number,
          job.latitude as number,
          job.longitude as number,
        ),
      }));

    // Normal pass — respect each locksmith's own coverageRadius (default 10mi)
    for (const { l, distance } of scored) {
      const coverageRadius = l.coverageRadius || 10;
      if (distance <= coverageRadius) {
        nearbyLocksmiths.push({
          id: l.id,
          name: l.name,
          email: l.email,
          distance: Math.round(distance * 10) / 10,
          nativeDeviceToken: l.nativeDeviceToken,
          nativeTokenType: l.nativeTokenType,
          nativeTokenPlatform: l.nativeTokenPlatform,
          webPushSubscription: l.webPushSubscription,
        });
        console.log(
          `[Job Notifications] Locksmith ${l.name} (${l.id}) is ${distance.toFixed(1)} miles away - within ${coverageRadius} mile radius`,
        );
      }
    }

    // ── Fallback widening: no one in their advertised radius → notify the
    // closest few anyway. Better to wake a locksmith 25mi away who may still
    // accept than to leave a customer stranded with zero outreach.
    let widenedRadiusUsed: number | null = null;
    if (nearbyLocksmiths.length === 0 && scored.length > 0) {
      const FALLBACK_RADII = [15, 30, 50, 100];
      const sorted = [...scored].sort((a, b) => a.distance - b.distance);
      for (const radius of FALLBACK_RADII) {
        const within = sorted.filter((s) => s.distance <= radius).slice(0, 5);
        if (within.length > 0) {
          widenedRadiusUsed = radius;
          for (const { l, distance } of within) {
            nearbyLocksmiths.push({
              id: l.id,
              name: l.name,
              email: l.email,
              distance: Math.round(distance * 10) / 10,
              nativeDeviceToken: l.nativeDeviceToken,
              nativeTokenType: l.nativeTokenType,
              nativeTokenPlatform: l.nativeTokenPlatform,
              webPushSubscription: l.webPushSubscription,
            });
          }
          console.log(
            `[Job Notifications] No locksmiths in their own radius for ${job.jobNumber}; widened to ${radius}mi and found ${within.length}`,
          );
          break;
        }
      }
    }

    // Still nobody → escalate. Tell admin so a human can hand-dispatch.
    if (nearbyLocksmiths.length === 0) {
      console.log(
        `[Job Notifications] No locksmiths within any radius for job ${job.jobNumber} — escalating to admin`,
      );
      try {
        const { sendAdminAlert } = await import("@/lib/telegram");
        await sendAdminAlert({
          title: "🚨 No locksmith coverage for new job",
          message:
            `Job ${job.jobNumber} at ${job.postcode} (${job.address ?? "no address"}) ` +
            `has zero locksmiths within 100mi.\n\n` +
            `Fleet size: ${locksmiths.length} available. ` +
            `Hand-dispatch via admin panel or escalate to recruitment.`,
          severity: "error",
        });
      } catch (e) {
        console.warn("[Job Notifications] Admin escalation failed:", e);
      }
      return { notifiedCount: 0, locksmithIds: [] };
    }

    // If we had to widen, also let admin know (warning, not error) so they
    // can track coverage gaps.
    if (widenedRadiusUsed !== null) {
      try {
        const { sendAdminAlert } = await import("@/lib/telegram");
        await sendAdminAlert({
          title: "⚠️ Job dispatched outside normal radius",
          message:
            `Job ${job.jobNumber} at ${job.postcode}: no locksmith in their ` +
            `own coverage radius. Notified ${nearbyLocksmiths.length} ` +
            `locksmith(s) within ${widenedRadiusUsed}mi as fallback.`,
          severity: "warning",
        });
      } catch {
        /* non-fatal */
      }
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
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

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

    // Send email notifications to nearby locksmiths (async, don't await)
    for (const locksmith of nearbyLocksmiths) {
      if (emailOptOutIds.has(locksmith.id)) continue; // respect email opt-out
      sendNewJobInAreaEmail(locksmith.email, {
        locksmithName: locksmith.name,
        jobNumber: job.jobNumber,
        jobId: job.id,
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

    // Send native APNs/FCM push notifications to mobile app users
    const nativeTargets = nearbyLocksmiths.filter(
      (ls): ls is typeof ls & { nativeDeviceToken: string; nativeTokenType: string; nativeTokenPlatform: string } =>
        !!ls.nativeDeviceToken && !!ls.nativeTokenType && !!ls.nativeTokenPlatform,
    );

    if (nativeTargets.length > 0) {
      const problemLabel = problemLabels[job.problemType] || job.problemType;
      sendNativePushToMany(nativeTargets, {
        title: "New Job Available",
        body: `${problemLabel} near ${job.postcode}`,
        data: {
          type: "NEW_JOB_AVAILABLE",
          jobId: job.id,
          jobNumber: job.jobNumber,
          postcode: job.postcode,
        },
      })
        .then((count) => {
          console.log(
            `[Job Notifications] Native push sent to ${count}/${nativeTargets.length} locksmiths`,
          );
        })
        .catch((err) => {
          console.error("[Job Notifications] Native push error:", err);
        });
    }

    // Send PWA web-push notifications (secondary channel for browser-installed users)
    const webTargets = nearbyLocksmiths.filter(
      (ls): ls is typeof ls & { webPushSubscription: string } => !!ls.webPushSubscription,
    );

    if (webTargets.length > 0) {
      const problemLabel = problemLabels[job.problemType] || job.problemType;
      sendWebPushToMany(webTargets, {
        title: "New Job Available",
        body: `${problemLabel} near ${job.postcode}`,
        data: {
          type: "NEW_JOB_AVAILABLE",
          jobId: job.id,
          jobNumber: job.jobNumber,
          postcode: job.postcode,
          url: "/locksmith/jobs",
        },
      })
        .then((count) => {
          console.log(
            `[Job Notifications] Web push sent to ${count}/${webTargets.length} locksmiths`,
          );
        })
        .catch((err) => {
          console.error("[Job Notifications] Web push error:", err);
        });
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
      jobId: data.jobId,
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
