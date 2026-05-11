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

const APNS_KEY_ID = process.env.APNS_KEY_ID || "";
const APNS_TEAM_ID = process.env.APNS_TEAM_ID || "";
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || "uk.locksafe.app";
const APNS_PRIVATE_KEY = process.env.APNS_PRIVATE_KEY || "";
const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID || "";
const FCM_SERVICE_ACCOUNT_JSON = process.env.FCM_SERVICE_ACCOUNT_JSON || "";

export interface NativePushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
}

export interface NativePushResult {
  success: boolean;
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

  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      badge: payload.badge ?? 1,
      sound: "default",
    },
    ...(payload.data || {}),
  };

  try {
    const response = await fetch(
      `https://api.push.apple.com/3/device/${deviceToken}`,
      {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": APNS_BUNDLE_ID,
          "apns-push-type": "alert",
          "apns-priority": "10",
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
    return { success: false, error: `APNs error ${response.status}: ${errorBody}` };
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
        notification: {
          sound: "default",
          channel_id: "default",
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
    return { success: false, error: `FCM error ${response.status}: ${errorBody}` };
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

  let successCount = 0;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const ls = locksmiths[i];
    if (result.status === "fulfilled" && result.value.success) {
      successCount++;
      console.log(`[NativePush] Sent to ${ls.name} (${ls.nativeTokenPlatform})`);
    } else {
      const err = result.status === "fulfilled" ? result.value.error : result.reason;
      console.error(`[NativePush] Failed to send to ${ls.name}:`, err);
    }
  }

  return successCount;
}
