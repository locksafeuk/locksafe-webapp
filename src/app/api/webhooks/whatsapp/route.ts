/**
 * WhatsApp Business Webhook Handler
 *
 * Handles incoming messages and status updates from WhatsApp Business API
 *
 * POST /api/webhooks/whatsapp - Receive messages (HMAC-SHA256 verified)
 * GET /api/webhooks/whatsapp - Webhook verification (hub.verify_token)
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  verifyWebhook,
  verifyWebhookSignature,
  processWebhook,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp-business";

// Force the Node.js runtime so node:crypto is available for HMAC verification.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET - Webhook verification (required by Meta)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const result = verifyWebhook({
    mode: mode || undefined,
    token: token || undefined,
    challenge: challenge || undefined,
  });

  if (result.valid && result.challenge) {
    console.log("[WhatsApp Webhook] Verified successfully");
    return new NextResponse(result.challenge, { status: 200 });
  }

  console.warn("[WhatsApp Webhook] Verification failed");
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * POST - Handle incoming messages
 *
 * Verifies the X-Hub-Signature-256 HMAC against META_APP_SECRET before
 * processing. If META_APP_SECRET is not yet configured we log a warning
 * and continue (one-time grace during initial Cloud API rollout); once
 * the secret is set, unsigned/invalid requests are rejected with 403.
 */
export async function POST(request: NextRequest) {
  try {
    // Read the raw body once so we can verify the signature against the
    // exact bytes Meta signed, then parse JSON ourselves.
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-hub-signature-256");

    const sig = verifyWebhookSignature(rawBody, signatureHeader);
    if (!sig.configured) {
      console.warn(
        "[WhatsApp Webhook] META_APP_SECRET not configured — accepting unsigned payload. Set the secret in Vercel to enable HMAC verification.",
      );
    } else if (!sig.valid) {
      console.warn("[WhatsApp Webhook] Invalid signature — rejecting request");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    let payload: WhatsAppWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
    } catch {
      console.warn("[WhatsApp Webhook] Malformed JSON payload");
      return NextResponse.json({ status: "error" }, { status: 200 });
    }

    // Process asynchronously to respond quickly
    processWebhook(payload).catch((error) => {
      console.error("[WhatsApp Webhook] Processing error:", error);
    });

    // Always return 200 quickly to acknowledge receipt
    return NextResponse.json({ status: "received" }, { status: 200 });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error:", error);
    // Still return 200 to prevent retries for bad payloads
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
