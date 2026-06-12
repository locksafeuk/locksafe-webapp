/**
 * Meta Ads Webhook Endpoint
 *
 * Receives real-time notifications from Meta when:
 * - Ad review status changes (approved/rejected)
 * - Campaign/ad set/ad status changes
 * - Budget exhaustion
 * - Delivery issues
 *
 * Setup in Meta Business Manager:
 * 1. Go to Events Manager -> Webhooks
 * 2. Add your webhook URL: https://your-domain.com/api/webhooks/meta
 * 3. Subscribe to ad_account events
 * 4. Copy the verify token and set META_WEBHOOK_VERIFY_TOKEN in .env
 */

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { withVendorAudit } from "@/lib/vendor-audit";
import { prisma } from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getRequestIdentifier } from "@/lib/auth-rate-limit";
import { logSuspiciousActivity } from "@/lib/fraud-logger";

// Verify token for Meta webhook verification
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "locksafe_meta_webhook_verify_token";
const META_WEBHOOK_MAX_REQUESTS = Number.parseInt(
  process.env.META_WEBHOOK_RATE_LIMIT_MAX || "120",
  10,
);
const META_WEBHOOK_WINDOW_SECONDS = Number.parseInt(
  process.env.META_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS || "60",
  10,
);

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("[Meta Webhook] META_APP_SECRET is not configured");
    return false;
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    console.warn("[Meta Webhook] Missing or invalid x-hub-signature-256 header");
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

// Types for Meta webhook events
interface MetaWebhookEntry {
  id: string;
  time: number;
  changes: MetaChange[];
}

interface MetaChange {
  field: string;
  value: MetaChangeValue;
}

interface MetaChangeValue {
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  account_id?: string;
  old_status?: string;
  new_status?: string;
  effective_status?: string;
  review_status?: string;
  review_feedback?: string;
  event_type?: string;
  delivery_status?: string;
  spend_cap?: number;
  daily_budget?: number;
}

/**
 * GET - Webhook verification (required by Meta)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[Meta Webhook] Verification request received:", { mode, token: token?.substring(0, 10) + "..." });

  // Verify the mode and token
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Meta Webhook] Verification successful!");
    return new NextResponse(challenge, { status: 200 });
  }

  console.log("[Meta Webhook] Verification failed - token mismatch");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST - Receive webhook events
 */
async function metaWebhookHandler(request: NextRequest) {
  try {
    const ip = getRequestIdentifier(request);
    const rateLimitResult = checkRateLimit(`meta_webhook:${ip}`, {
      maxRequests: META_WEBHOOK_MAX_REQUESTS,
      windowSeconds: META_WEBHOOK_WINDOW_SECONDS,
    });

    if (!rateLimitResult.success) {
      await logSuspiciousActivity({
        category: "webhook_abuse",
        event: "meta_webhook_rate_limited",
        severity: "warn",
        ip,
      });
      return NextResponse.json(
        { error: "Too many webhook requests" },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) },
      );
    }

    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-hub-signature-256");

    if (!verifyMetaSignature(rawBody, signatureHeader)) {
      await logSuspiciousActivity({
        category: "webhook_abuse",
        event: "meta_webhook_invalid_signature",
        severity: "warn",
        ip,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    console.log("[Meta Webhook] Event received:", JSON.stringify(body, null, 2));

    // Process the webhook event
    const { object, entry } = body;

    if (object !== "ad_account") {
      console.log("[Meta Webhook] Ignoring non-ad_account event:", object);
      return NextResponse.json({ received: true });
    }

    // Process each entry
    for (const entryItem of entry as MetaWebhookEntry[]) {
      for (const change of entryItem.changes) {
        await processChange(change);
      }
    }

    return NextResponse.json({
      received: true,
      processed: entry?.length || 0,
    });
  } catch (error) {
    console.error("[Meta Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * Process a single change event
 */
async function processChange(change: MetaChange) {
  const { field, value } = change;

  console.log(`[Meta Webhook] Processing change: ${field}`, value);

  try {
    switch (field) {
      case "ad_review":
      case "ad_status":
        await handleAdStatusChange(value);
        break;

      case "adset_status":
        await handleAdSetStatusChange(value);
        break;

      case "campaign_status":
        await handleCampaignStatusChange(value);
        break;

      case "spend_cap_reached":
        await handleSpendCapReached(value);
        break;

      case "delivery_status":
        await handleDeliveryStatusChange(value);
        break;

      default:
        console.log(`[Meta Webhook] Unhandled field type: ${field}`);
    }
  } catch (err) {
    console.error(`[Meta Webhook] Error processing ${field}:`, err);
  }
}

/**
 * Handle ad status/review changes
 */
async function handleAdStatusChange(value: MetaChangeValue) {
  if (!value.ad_id) return;

  console.log(`[Meta Webhook] Ad status change for ${value.ad_id}:`, value);

  // Find the ad in our database
  const ad = await prisma.ad.findFirst({
    where: { metaAdId: value.ad_id },
  });

  if (!ad) {
    console.log(`[Meta Webhook] Ad not found in database: ${value.ad_id}`);
    return;
  }

  // Map Meta status to our status
  let newStatus = ad.status;
  if (value.new_status || value.effective_status) {
    const metaStatus = value.new_status || value.effective_status || "";
    newStatus = mapMetaStatus(metaStatus);
  }

  // Update the ad
  await prisma.ad.update({
    where: { id: ad.id },
    data: {
      status: newStatus,
      metaReviewStatus: value.review_status || value.effective_status,
      metaReviewFeedback: value.review_feedback,
      lastSyncAt: new Date(),
    },
  });

  console.log(`[Meta Webhook] Updated ad ${ad.id} status to ${newStatus}`);

  // If rejected, log the reason and create a notification
  if (newStatus === "REJECTED" && value.review_feedback) {
    console.log(`[Meta Webhook] Ad ${ad.id} rejected: ${value.review_feedback}`);

    sendAdminAlert({
      title: `🚫 Meta Ad Rejected`,
      message: `Ad rejected by Meta review.\nReason: ${value.review_feedback}\nAd DB ID: ${ad.id}`,
      severity: "warning",
    }).catch(() => {});
  }
}

/**
 * Handle ad set status changes
 */
async function handleAdSetStatusChange(value: MetaChangeValue) {
  if (!value.adset_id) return;

  console.log(`[Meta Webhook] Ad set status change for ${value.adset_id}:`, value);

  const adSet = await prisma.adSet.findFirst({
    where: { metaAdSetId: value.adset_id },
  });

  if (!adSet) {
    console.log(`[Meta Webhook] Ad set not found in database: ${value.adset_id}`);
    return;
  }

  const newStatus = mapMetaStatus(value.new_status || value.effective_status || "");

  await prisma.adSet.update({
    where: { id: adSet.id },
    data: {
      status: newStatus,
    },
  });

  console.log(`[Meta Webhook] Updated ad set ${adSet.id} status to ${newStatus}`);
}

/**
 * Handle campaign status changes
 */
async function handleCampaignStatusChange(value: MetaChangeValue) {
  if (!value.campaign_id) return;

  console.log(`[Meta Webhook] Campaign status change for ${value.campaign_id}:`, value);

  const campaign = await prisma.adCampaign.findFirst({
    where: { metaCampaignId: value.campaign_id },
  });

  if (!campaign) {
    console.log(`[Meta Webhook] Campaign not found in database: ${value.campaign_id}`);
    return;
  }

  const newStatus = mapMetaStatus(value.new_status || value.effective_status || "");

  await prisma.adCampaign.update({
    where: { id: campaign.id },
    data: {
      status: newStatus,
      lastSyncAt: new Date(),
    },
  });

  console.log(`[Meta Webhook] Updated campaign ${campaign.id} status to ${newStatus}`);
}

/**
 * Handle spend cap reached event
 */
async function handleSpendCapReached(value: MetaChangeValue) {
  const campaignId = value.campaign_id;
  if (!campaignId) return;

  console.log(`[Meta Webhook] Spend cap reached for campaign ${campaignId}`);

  const campaign = await prisma.adCampaign.findFirst({
    where: { metaCampaignId: campaignId },
  });

  if (campaign) {
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "COMPLETED",
        lastSyncAt: new Date(),
      },
    });

    sendAdminAlert({
      title: `💰 Meta Campaign Spend Cap Reached`,
      message: `Campaign ${campaign.id} has reached its spend cap and has been marked COMPLETED.`,
      severity: "info",
    }).catch(() => {});
  }
}

/**
 * Handle delivery status changes (issues, errors)
 */
async function handleDeliveryStatusChange(value: MetaChangeValue) {
  console.log(`[Meta Webhook] Delivery status change:`, value);

  if (value.delivery_status === "DELIVERY_ISSUES") {
    console.log(`[Meta Webhook] Delivery issues detected for ad/campaign`);
    sendAdminAlert({
      title: `⚠️ Meta Delivery Issues Detected`,
      message: `Meta reported delivery issues.\nDetails: ${JSON.stringify(value).slice(0, 400)}`,
      severity: "warning",
    }).catch(() => {});
  }
}

/**
 * Map Meta status to our AdStatus enum
 */
function mapMetaStatus(metaStatus: string): "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "COMPLETED" | "ARCHIVED" {
  const mapping: Record<string, "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "COMPLETED" | "ARCHIVED"> = {
    "ACTIVE": "ACTIVE",
    "PAUSED": "PAUSED",
    "DELETED": "ARCHIVED",
    "ARCHIVED": "ARCHIVED",
    "PENDING_REVIEW": "PENDING_REVIEW",
    "DISAPPROVED": "REJECTED",
    "PREAPPROVED": "PENDING_REVIEW",
    "PENDING_BILLING_INFO": "PAUSED",
    "CAMPAIGN_PAUSED": "PAUSED",
    "ADSET_PAUSED": "PAUSED",
    "IN_PROCESS": "PENDING_REVIEW",
    "WITH_ISSUES": "PAUSED",
  };

  return mapping[metaStatus] || "PAUSED";
}

// Data Ownership Layer: every Meta webhook is captured into VendorEvent.
export const POST = withVendorAudit("meta", metaWebhookHandler);
