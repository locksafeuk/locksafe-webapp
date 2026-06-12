/**
 * Native Push Notification Sender
 *
 * Sends push notifications directly to APNs (iOS) and FCM v1 (Android)
 * using the raw device tokens registered by the mobile app.
 *
 * Environment variables required:
 *
 * For iOS (APNs):
 *   APNS_KEY_ID          - 10-character key ID from Apple Developer portal
 *   APNS_TEAM_ID         - 10-character Team ID from Apple Developer portal
 *   APNS_BUNDLE_ID       - App bundle ID, e.g. uk.locksafe.app
 *   APNS_PRIVATE_KEY     - Contents of the .p8 file (include header/footer, newlines as \n)
 *
 * For Android (FCM v1):
 *   FCM_PROJECT_ID       - Firebase project ID
 *   FCM_SERVICE_ACCOUNT_JSON - Full service account JSON (stringify the JSON)
 *
 * @see https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
 * @see https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send
 */

import "server-only";
import * as jose from "jose";
import { fetch as undiciFetch, Agent } from "undici";

const APNS_KEY_ID = process.env.APNS_KEY_ID || "";
const APNS_TEAM_ID = process.env.APNS_TEAM_ID || "";
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || "uk.locksafe.app";
const APNS_PRIVATE_KEY = process.env.APNS_PRIVATE_KEY || "";
const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID || "";
const FCM_SERVICE_ACCOUNT_JSON = process.env.FCM_SERVICE_ACCOUNT_JSON || "";
const IOS_ALERT_SOUND = process.env.IOS_ALERT_SOUND || "locksafe_alert.wav";
const ANDROID_ALERT_SOUND = process.env.ANDROID_ALERT_SOUND || "locksafe_alert";
const ANDROID_CHANNEL_ID =
  process.env.ANDROID_CHANNEL_ID || "locksafe_jobs_critical";

export interface NativePushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
}

export interface NativePushResult {
  success: boolean;
  stale?: boolean; // true when APNs/FCM reports the token is no longer valid
  error?: string;
}

// ─── APNs (iOS) ──────────────────────────────────────────────────────────────

let cachedApnsJwt: { token: string; expiresAt: number } | null = null;

async function getApnsJwt(): Promise<string | null> {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  // Reuse cached JWT if it's still valid (APNs JWTs are valid for 60 min)
  if (cachedApnsJwt && cachedApnsJwt.expiresAt > now + 60) {
    return cachedApnsJwt.token;
  }

  try {
    const privateKey = await jose.importPKCS8(
      APNS_PRIVATE_KEY.replace(/\\n/g, "\n"),
      "ES256"
    );

    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: APNS_KEY_ID })
      .setIssuedAt()
      .setIssuer(APNS_TEAM_ID)
      .sign(privateKey);

    cachedApnsJwt = { token, expiresAt: now + 3000 }; // ~50 min
    return token;
  } catch (error) {
    console.error("[NativePush][APNs] Failed to generate JWT:", error);
    return null;
  }
}

async function sendApns(
  deviceToken: string,
  payload: NativePushPayload
): Promise<NativePushResult> {
  const jwt = await getApnsJwt();
  if (!jwt) {
    return { success: false, error: "APNs not configured (missing APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY)" };
  }

  // Job alerts use the JOB_ALERT category so iOS shows "View Job" and "Dismiss"
  // action buttons directly on the lock screen — this keeps the notification
  // visible until the locksmith actively interacts with it.
  const isJobAlert = payload.data?.type
    ? ["NEW_JOB_AVAILABLE", "NEW_JOB_ASSIGNED", "schedule_start", "schedule_end"].includes(
        String(payload.data.type)
      )
    : false;

  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      badge: payload.badge ?? 1,
      sound: {
        name: IOS_ALERT_SOUND,
        volume: 1.0,      // max volume (0.0–1.0)
        critical: 0,      // 0 = regular alert sound (critical=1 needs Apple entitlement)
      },
      "interruption-level": "time-sensitive", // bypasses Focus mode, stays on screen
      "relevance-score": 1,
      // Category links to the "View Job" / "Dismiss" actions registered on the client
      ...(isJobAlert ? { category: "JOB_ALERT" } : {}),
    },
    // Forward all data fields so the app can deep-link on tap
    ...(payload.data || {}),
  };

  // Job alerts expire after 30 min — a job alert arriving hours late is useless.
  // Other notifications (schedule, payments) get 6 hours.
  const expirationOffset = isJobAlert ? 1800 : 21600;
  const apnsExpiration = Math.floor(Date.now() / 1000) + expirationOffset;

  try {
    const response = await undiciFetch(
      `https://api.push.apple.com/3/device/${deviceToken}`,
      {
        dispatcher: new Agent({ allowH2: true }),
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": APNS_BUNDLE_ID,
          "apns-push-type": "alert",
          "apns-priority": "10",           // 10 = deliver immediately
          "apns-expiration": String(apnsExpiration),
          "content-type": "application/json",
        },
        body: JSON.stringify(apnsPayload),
      }
    );

    if (response.ok) {
      return { success: true };
    }

    const errorBody = await response.text();
    console.error("[NativePush][APNs] Send failed:", response.status, errorBody);

    // 410 = device token is no longer active; 400 BadDeviceToken = token is malformed/invalid
    const isStale =
      response.status === 410 ||
      (response.status === 400 && errorBody.includes("BadDeviceToken"));

    return { success: false, stale: isStale, error: `APNs error ${response.status}: ${errorBody}` };
  } catch (error) {
    console.error("[NativePush][APNs] Request failed:", error);
    return { success: false, error: String(error) };
  }
}

// ─── FCM v1 (Android) ────────────────────────────────────────────────────────

let cachedFcmToken: { token: string; expiresAt: number } | null = null;

async function getFcmAccessToken(): Promise<string | null> {
  if (!FCM_SERVICE_ACCOUNT_JSON) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (cachedFcmToken && cachedFcmToken.expiresAt > now + 60) {
    return cachedFcmToken.token;
  }

  try {
    const serviceAccount = JSON.parse(FCM_SERVICE_ACCOUNT_JSON);
    const privateKey = await jose.importPKCS8(
      serviceAccount.private_key.replace(/\\n/g, "\n"),
      "RS256"
    );

    const assertion = await new jose.SignJWT({
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt()
      .setIssuer(serviceAccount.client_email)
      .setAudience("https://oauth2.googleapis.com/token")
      .setExpirationTime("1h")
      .sign(privateKey);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("[NativePush][FCM] Token exchange failed:", await tokenResponse.text());
      return null;
    }

    const tokenData = await tokenResponse.json();
    const expiresIn = tokenData.expires_in || 3600;
    cachedFcmToken = {
      token: tokenData.access_token,
      expiresAt: now + expiresIn,
    };

    return tokenData.access_token;
  } catch (error) {
    console.error("[NativePush][FCM] Failed to get access token:", error);
    return null;
  }
}

async function sendFcm(
  deviceToken: string,
  payload: NativePushPayload
): Promise<NativePushResult> {
  if (!FCM_PROJECT_ID) {
    return { success: false, error: "FCM not configured (missing FCM_PROJECT_ID)" };
  }

  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    return { success: false, error: "FCM not configured (missing FCM_SERVICE_ACCOUNT_JSON or invalid credentials)" };
  }

  const message = {
    message: {
      token: deviceToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      android: {
        priority: "high",
        // Job alerts: 30 min TTL — stale job alerts are worse than no alert.
        // Other alerts (payments, schedule): 6 hours.
        ttl: (payload.data?.type === "NEW_JOB_AVAILABLE" || payload.data?.type === "NEW_JOB_ASSIGNED")
          ? "1800s"
          : "21600s",
        direct_boot_ok: true,
        notification: {
          channel_id: ANDROID_CHANNEL_ID,     // locksafe_jobs_critical (MAX importance)
          sound: ANDROID_ALERT_SOUND,          // locksafe_alert (no .wav extension for Android)
          notification_priority: "PRIORITY_MAX",
          visibility: "PUBLIC",               // show content on lock screen
          // sticky: keep in notification shade until the locksmith taps it
          sticky: true,
          // Let the channel handle sound/vibration — don't override with defaults
          default_sound: false,
          default_vibrate_timings: false,
          default_light_settings: false,
          // Match the vibration pattern set on the channel (0, 700, 250, 700, 250, 700 ms)
          vibrate_timings: ["0s", "0.7s", "0.25s", "0.7s", "0.25s", "0.7s"],
          light_settings: {
            color: { red: 0.976, green: 0.451, blue: 0.086, alpha: 1 }, // #f97316
            light_on_duration: "0.5s",
            light_off_duration: "0.5s",
          },
        },
      },
      data: Object.fromEntries(
        Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
      ),
    },
  };

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    if (response.ok) {
      return { success: true };
    }

    const errorBody = await response.text();
    console.error("[NativePush][FCM] Send failed:", response.status, errorBody);

    // FCM returns 404 or a specific error code when the registration token is invalid/expired
    const isStale =
      response.status === 404 ||
      errorBody.includes("UNREGISTERED") ||
      errorBody.includes("registration-token-not-registered");

    return { success: false, stale: isStale, error: `FCM error ${response.status}: ${errorBody}` };
  } catch (error) {
    console.error("[NativePush][FCM] Request failed:", error);
    return { success: false, error: String(error) };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function isNativePushConfigured(platform: string | null): boolean {
  if (platform === "ios") return !!(APNS_KEY_ID && APNS_TEAM_ID && APNS_PRIVATE_KEY);
  if (platform === "android") return !!(FCM_PROJECT_ID && FCM_SERVICE_ACCOUNT_JSON);
  return false;
}

/**
 * Send a native push notification to a single device.
 * Dispatches to APNs for iOS tokens and FCM for Android tokens.
 */
export async function sendNativePush(
  deviceToken: string,
  tokenType: string,
  platform: string,
  payload: NativePushPayload
): Promise<NativePushResult> {
  if (platform === "ios" || tokenType === "apns") {
    return sendApns(deviceToken, payload);
  }

  if (platform === "android" || tokenType === "fcm" || tokenType === "fcmv1") {
    return sendFcm(deviceToken, payload);
  }

  return { success: false, error: `Unknown platform/tokenType: ${platform}/${tokenType}` };
}

/**
 * Send a native push to multiple devices in parallel.
 * Stale tokens (APNs 410, FCM UNREGISTERED) are automatically cleared from the DB.
 * Returns the count of successful sends.
 */
export async function sendNativePushToMany(
  locksmiths: Array<{
    id: string;
    name: string;
    nativeDeviceToken: string;
    nativeTokenType: string;
    nativeTokenPlatform: string;
  }>,
  payload: NativePushPayload
): Promise<number> {
  if (locksmiths.length === 0) return 0;

  const results = await Promise.allSettled(
    locksmiths.map((ls) =>
      sendNativePush(
        ls.nativeDeviceToken,
        ls.nativeTokenType,
        ls.nativeTokenPlatform,
        payload
      )
    )
  );

  // Lazily import prisma to avoid circular deps and keep this file usable outside Next.js
  let prisma: typeof import("@/lib/db").default | null = null;

  let successCount = 0;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const ls = locksmiths[i];
    if (result.status === "fulfilled" && result.value.success) {
      successCount++;
      console.log(`[NativePush] Sent to ${ls.name} (${ls.nativeTokenPlatform})`);
    } else {
      const err = result.status === "fulfilled" ? result.value.error : result.reason;
      const isStale = result.status === "fulfilled" && result.value.stale;
      console.error(`[NativePush] Failed to send to ${ls.name} (stale=${isStale}):`, err);

      // Clear stale/invalid tokens from the DB so future dispatches skip this device
      if (isStale) {
        try {
          if (!prisma) prisma = (await import("@/lib/db")).default;
          await prisma.locksmith.update({
            where: { id: ls.id },
            data: {
              nativeDeviceToken: null,
              nativeTokenType: null,
              nativeTokenPlatform: null,
            },
          });
          console.log(`[NativePush] Cleared stale token for ${ls.name} (${ls.id})`);
        } catch (dbErr) {
          console.error(`[NativePush] Failed to clear stale token for ${ls.name}:`, dbErr);
        }
      }
    }
  }

  return successCount;
}
