/**
 * WhatsApp Business Webhook Handler
 *
 * Handles incoming messages and status updates from WhatsApp Business API
 *
 * POST /api/webhooks/whatsapp - Receive messages
 * GET /api/webhooks/whatsapp - Webhook verification
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhook,
  processWebhook,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp-business";

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
 */
export async function POST(request: NextRequest) {
  try {
    const payload: WhatsAppWebhookPayload = await request.json();

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
