/**
 * Web Push (PWA) Notification Sender
 *
 * Sends push notifications to PWA (browser-installed) locksmiths using the
 * Web Push protocol (VAPID). This is the secondary channel; the primary,
 * more reliable channel is native APNs/FCM (see native-push.ts).
 *
 * Subscriptions are captured by /api/notifications/subscribe and stored as a
 * JSON string in Locksmith.webPushSubscription.
 *
 * Environment variables required:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY - VAPID public key (also used client-side)
 *   VAPID_PRIVATE_KEY            - VAPID private key (server only)
 *   VAPID_SUBJECT                - optional "mailto:" contact (defaults below)
 *
 * Generate keys with: npx web-push generate-vapid-keys
 *
 * NOTE: requires the `web-push` package — run `npm install web-push` and
 * `npm install -D @types/web-push`.
 */

import "server-only";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@locksafe.uk";

let vapidConfigured = false;

function ensureConfigured(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

export function isWebPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface WebPushResult {
  success: boolean;
  stale?: boolean; // true when the push service reports the subscription is gone (404/410)
  error?: string;
}

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function sendOne(subscriptionJson: string, payload: WebPushPayload): Promise<WebPushResult> {
  if (!ensureConfigured()) {
    return { success: false, error: "Web push not configured (missing VAPID keys)" };
  }

  let sub: StoredSubscription;
  try {
    sub = JSON.parse(subscriptionJson) as StoredSubscription;
  } catch {
    // Unparseable subscription is effectively dead — treat as stale so it's cleared.
    return { success: false, stale: true, error: "Malformed subscription JSON" };
  }

  // The service worker's `push` handler reads this JSON to show the notification.
  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
  });

  try {
    // 30-min TTL + high urgency: a stale job alert is worse than none.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await webpush.sendNotification(sub as any, notificationPayload, { TTL: 1800, urgency: "high" });
    return { success: true };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    const statusCode = e?.statusCode;
    const isStale = statusCode === 404 || statusCode === 410;
    return {
      success: false,
      stale: isStale,
      error: `WebPush error ${statusCode ?? ""}: ${e?.body || e?.message || String(err)}`,
    };
  }
}

/**
 * Send a web push to multiple PWA locksmiths in parallel.
 * Stale subscriptions (404/410) are automatically cleared from the DB.
 * Returns the count of successful sends.
 */
export async function sendWebPushToMany(
  locksmiths: Array<{ id: string; name: string; webPushSubscription: string }>,
  payload: WebPushPayload,
): Promise<number> {
  if (locksmiths.length === 0) return 0;
  if (!isWebPushConfigured()) {
    console.warn("[WebPush] Skipped — VAPID keys not configured");
    return 0;
  }

  const results = await Promise.allSettled(
    locksmiths.map((ls) => sendOne(ls.webPushSubscription, payload)),
  );

  let prisma: typeof import("@/lib/db").default | null = null;
  let successCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const ls = locksmiths[i];
    if (result.status === "fulfilled" && result.value.success) {
      successCount++;
      console.log(`[WebPush] Sent to ${ls.name}`);
    } else {
      const err = result.status === "fulfilled" ? result.value.error : result.reason;
      const isStale = result.status === "fulfilled" && result.value.stale;
      console.error(`[WebPush] Failed to send to ${ls.name} (stale=${isStale}):`, err);

      if (isStale) {
        try {
          if (!prisma) prisma = (await import("@/lib/db")).default;
          await prisma.locksmith.update({
            where: { id: ls.id },
            data: {
              webPushSubscription: null,
              webPushPlatform: null,
              webPushRegisteredAt: null,
            },
          });
          console.log(`[WebPush] Cleared stale subscription for ${ls.name} (${ls.id})`);
        } catch (dbErr) {
          console.error(`[WebPush] Failed to clear stale subscription for ${ls.name}:`, dbErr);
        }
      }
    }
  }

  return successCount;
}
