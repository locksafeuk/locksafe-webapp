/**
 * OneSignal Push Notification Service
 *
 * Server-side integration for sending push notifications via OneSignal.
 * Works with both iOS Safari (PWA) and Android Chrome PWAs.
 *
 * Setup:
 * 1. Create OneSignal account at https://onesignal.com
 * 2. Create a Web Push app
 * 3. Add NEXT_PUBLIC_ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY to .env
 *
 * @see https://documentation.onesignal.com/reference/create-notification
 */

import "server-only";

// OneSignal API configuration
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || "";
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1";

// User segments for targeting
// These need to be created in OneSignal dashboard > Audience > Segments
export const ONESIGNAL_SEGMENTS = {
  // Default segment
  ALL: "All",

  // User type segments (auto-tagged on subscription)
  CUSTOMERS: "customers",               // tag: user_type = "customer"
  LOCKSMITHS: "locksmiths",             // tag: user_type = "locksmith"

  // Locksmith status segments
  AVAILABLE_LOCKSMITHS: "available_locksmiths",     // tag: is_available = "true"
  VERIFIED_LOCKSMITHS: "verified_locksmiths",       // tag: is_verified = "true"
  STRIPE_VERIFIED: "stripe_verified",               // tag: stripe_verified = "true"

  // Engagement segments
  ACTIVE_JOBS: "active_jobs",           // tag: has_active_job = "true"
  NEW_USERS: "new_users",               // First session < 7 days

  // Marketing segments
  RETURNING_CUSTOMERS: "returning_customers",  // tag: job_count > 1
  HIGH_VALUE_LOCKSMITHS: "high_value_locksmiths", // tag: total_jobs > 50
} as const;

// Notification templates for common use cases
export const NOTIFICATION_TEMPLATES = {
  // Customer notifications
  LOCKSMITH_ASSIGNED: {
    headings: { en: "Locksmith Assigned" },
    contents: { en: "A locksmith has accepted your job {jobNumber} and is on the way!" },
  },
  LOCKSMITH_EN_ROUTE: {
    headings: { en: "Locksmith En Route" },
    contents: { en: "Your locksmith is on the way. ETA: {eta} minutes" },
  },
  LOCKSMITH_ARRIVED: {
    headings: { en: "Locksmith Arrived" },
    contents: { en: "Your locksmith has arrived at your location for job {jobNumber}." },
  },
  QUOTE_READY: {
    headings: { en: "Quote Ready" },
    contents: { en: "Your locksmith has sent you a quote for job {jobNumber}. Tap to review." },
  },
  WORK_COMPLETE: {
    headings: { en: "Work Complete" },
    contents: { en: "Your locksmith has finished work on job {jobNumber}. Please review and sign." },
  },
  SIGNATURE_REMINDER: {
    headings: { en: "Signature Required" },
    contents: { en: "Please sign off on job {jobNumber} to release payment." },
  },

  // Locksmith notifications
  NEW_JOB_AVAILABLE: {
    headings: { en: "New Job Available" },
    contents: { en: "New job {jobNumber} available in {postcode}: {problemType}. Tap to view details." },
  },
  JOB_ACCEPTED: {
    headings: { en: "Job Accepted" },
    contents: { en: "The customer has accepted your application for job {jobNumber}!" },
  },
  JOB_ASSIGNED: {
    headings: { en: "Job Assigned" },
    contents: { en: "Admin has assigned you job {jobNumber}! Please accept or decline." },
  },
  QUOTE_ACCEPTED: {
    headings: { en: "Quote Accepted" },
    contents: { en: "Your quote for job {jobNumber} has been accepted. You can begin work." },
  },
  QUOTE_DECLINED: {
    headings: { en: "Quote Declined" },
    contents: { en: "The customer has declined your quote for job {jobNumber}." },
  },
  CUSTOMER_SIGNED: {
    headings: { en: "Job Signed Off" },
    contents: { en: "The customer has signed off job {jobNumber}. Payment will be processed." },
  },
  PAYOUT_SENT: {
    headings: { en: "Payout Sent" },
    contents: { en: "Your payout of £{amount} has been sent to your account." },
  },
} as const;

export type NotificationTemplate = keyof typeof NOTIFICATION_TEMPLATES;

// Types
export interface OneSignalNotification {
  app_id: string;
  // Targeting - use ONE of these
  include_player_ids?: string[];
  include_external_user_ids?: string[];
  included_segments?: string[];
  // Content
  headings?: { en: string };
  contents: { en: string };
  // Optional
  url?: string;
  data?: Record<string, any>;
  ios_badge_type?: "None" | "SetTo" | "Increase";
  ios_badge_count?: number;
  android_channel_id?: string;
  chrome_web_badge?: string;
  chrome_web_icon?: string;
  // Scheduling
  send_after?: string; // ISO 8601 datetime
  delayed_option?: "timezone" | "last-active";
  delivery_time_of_day?: string; // "9:00AM"
  // TTL
  ttl?: number; // seconds
  priority?: number; // 1-10
  // Buttons
  buttons?: Array<{
    id: string;
    text: string;
    url?: string;
  }>;
}

export interface OneSignalResponse {
  id?: string;
  recipients?: number;
  errors?: string[];
}

export interface SendNotificationOptions {
  playerIds?: string[];
  externalUserIds?: string[];
  segments?: string[];
  title: string;
  message: string;
  url?: string;
  data?: Record<string, any>;
  buttons?: Array<{ id: string; text: string; url?: string }>;
  ttl?: number;
  priority?: number;
}

/**
 * Check if OneSignal is configured
 */
export function isOneSignalConfigured(): boolean {
  return !!(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY);
}

/**
 * Send a push notification via OneSignal
 */
export async function sendNotification(
  options: SendNotificationOptions
): Promise<OneSignalResponse> {
  if (!isOneSignalConfigured()) {
    console.warn("[OneSignal] Not configured. Skipping notification.");
    return { errors: ["OneSignal not configured"] };
  }

  const notification: OneSignalNotification = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: options.title },
    contents: { en: options.message },
  };

  // Add targeting
  if (options.playerIds?.length) {
    notification.include_player_ids = options.playerIds;
  } else if (options.externalUserIds?.length) {
    notification.include_external_user_ids = options.externalUserIds;
  } else if (options.segments?.length) {
    notification.included_segments = options.segments;
  } else {
    return { errors: ["No targeting specified"] };
  }

  // Add optional fields
  if (options.url) {
    notification.url = options.url;
  }
  if (options.data) {
    notification.data = options.data;
  }
  if (options.buttons) {
    notification.buttons = options.buttons;
  }
  if (options.ttl) {
    notification.ttl = options.ttl;
  }
  if (options.priority) {
    notification.priority = options.priority;
  }

  // Add branding
  notification.chrome_web_icon = "/icons/icon-192x192.png";
  notification.chrome_web_badge = "/icons/icon-72x72.png";

  try {
    const response = await fetch(`${ONESIGNAL_API_URL}/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notification),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[OneSignal] Error:", result);
      return { errors: result.errors || ["Unknown error"] };
    }

    console.log("[OneSignal] Notification sent:", result.id);
    return {
      id: result.id,
      recipients: result.recipients,
    };
  } catch (error: any) {
    console.error("[OneSignal] Network error:", error);
    return { errors: [error.message] };
  }
}

/**
 * Send notification using a predefined template
 */
export async function sendTemplatedNotification(
  template: NotificationTemplate,
  playerIds: string[],
  options: {
    url?: string;
    data?: Record<string, any>;
    variables?: Record<string, string>; // For template variable replacement
  } = {}
): Promise<OneSignalResponse> {
  const templateData = NOTIFICATION_TEMPLATES[template];
  let title: string = templateData.headings.en;
  let message: string = templateData.contents.en;

  // Replace variables in message
  if (options.variables) {
    for (const [key, value] of Object.entries(options.variables)) {
      message = message.replace(`{${key}}`, value);
      title = title.replace(`{${key}}`, value);
    }
  }

  return sendNotification({
    playerIds,
    title,
    message,
    url: options.url,
    data: options.data,
  });
}

/**
 * Send notification to a customer
 */
export async function notifyCustomer(
  oneSignalPlayerId: string,
  template: NotificationTemplate,
  options: {
    jobId?: string;
    variables?: Record<string, string>;
  } = {}
): Promise<OneSignalResponse> {
  const url = options.jobId ? `/customer/job/${options.jobId}` : "/customer/dashboard";

  return sendTemplatedNotification(template, [oneSignalPlayerId], {
    url,
    data: { jobId: options.jobId, type: template },
    variables: options.variables,
  });
}

/**
 * Send notification to a locksmith
 */
export async function notifyLocksmith(
  oneSignalPlayerId: string,
  template: NotificationTemplate,
  options: {
    jobId?: string;
    variables?: Record<string, string>;
  } = {}
): Promise<OneSignalResponse> {
  const url = options.jobId
    ? `/locksmith/job/${options.jobId}`
    : "/locksmith/dashboard";

  return sendTemplatedNotification(template, [oneSignalPlayerId], {
    url,
    data: { jobId: options.jobId, type: template },
    variables: options.variables,
  });
}

/**
 * Send notification to multiple locksmiths (e.g., for new job alerts)
 */
export async function notifyLocksmiths(
  oneSignalPlayerIds: string[],
  template: NotificationTemplate,
  options: {
    jobId?: string;
    variables?: Record<string, string>;
  } = {}
): Promise<OneSignalResponse> {
  if (oneSignalPlayerIds.length === 0) {
    return { errors: ["No player IDs provided"] };
  }

  const url = options.jobId
    ? `/locksmith/jobs?highlight=${options.jobId}`
    : "/locksmith/jobs";

  return sendTemplatedNotification(template, oneSignalPlayerIds, {
    url,
    data: { jobId: options.jobId, type: template },
    variables: options.variables,
  });
}

/**
 * Send a broadcast notification to a segment
 */
export async function broadcastToSegment(
  segment: string,
  title: string,
  message: string,
  options: {
    url?: string;
    data?: Record<string, any>;
  } = {}
): Promise<OneSignalResponse> {
  return sendNotification({
    segments: [segment],
    title,
    message,
    url: options.url,
    data: options.data,
  });
}

// ==========================================
// PLAYER MANAGEMENT
// ==========================================

/**
 * Get OneSignal player info
 */
export async function getPlayerInfo(playerId: string): Promise<any> {
  if (!isOneSignalConfigured()) {
    return null;
  }

  try {
    const response = await fetch(
      `${ONESIGNAL_API_URL}/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`,
      {
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error("[OneSignal] Failed to get player:", await response.text());
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("[OneSignal] Error getting player:", error);
    return null;
  }
}

/**
 * Update player tags (for segmentation)
 */
export async function updatePlayerTags(
  playerId: string,
  tags: Record<string, string | number | boolean>
): Promise<boolean> {
  if (!isOneSignalConfigured()) {
    return false;
  }

  try {
    const response = await fetch(
      `${ONESIGNAL_API_URL}/players/${playerId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          tags,
        }),
      }
    );

    if (!response.ok) {
      console.error("[OneSignal] Failed to update tags:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("[OneSignal] Error updating tags:", error);
    return false;
  }
}

/**
 * Delete a player (for unsubscribing)
 */
export async function deletePlayer(playerId: string): Promise<boolean> {
  if (!isOneSignalConfigured()) {
    return false;
  }

  try {
    const response = await fetch(
      `${ONESIGNAL_API_URL}/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error("[OneSignal] Error deleting player:", error);
    return false;
  }
}
