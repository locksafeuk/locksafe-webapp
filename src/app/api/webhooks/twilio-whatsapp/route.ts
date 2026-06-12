/**
 * Twilio WhatsApp Webhook Handler
 *
 * Receives inbound WhatsApp messages and delivery status callbacks from
 * Twilio (form-encoded, X-Twilio-Signature verified) and routes them into
 * the same pipeline as the Meta webhook: admin WhatsApp inbox + bot flows.
 *
 * POST /api/webhooks/twilio-whatsapp        - inbound messages + status callbacks
 *
 * Configure in Twilio Console:
 *   Messaging > Senders > WhatsApp senders > (sender) >
 *   "When a message comes in" = https://<domain>/api/webhooks/twilio-whatsapp (HTTP POST)
 *   Status callback URL       = https://<domain>/api/webhooks/twilio-whatsapp
 */

import { type NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { withVendorAudit } from "@/lib/vendor-audit";
import {
  handleIncomingMessage,
  type WhatsAppIncomingMessage,
} from "@/lib/whatsapp-business";
import { updateWhatsAppMessageStatus } from "@/lib/whatsapp-inbox";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getRequestIdentifier } from "@/lib/auth-rate-limit";
import { logSuspiciousActivity } from "@/lib/fraud-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX = Number.parseInt(
  process.env.WHATSAPP_WEBHOOK_RATE_LIMIT_MAX || "180",
  10,
);
const RATE_LIMIT_WINDOW_SECONDS = Number.parseInt(
  process.env.WHATSAPP_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS || "60",
  10,
);

/** Empty TwiML so Twilio doesn't auto-reply or log a webhook error. */
function twimlResponse(status = 200) {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Validate X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted(key+value))).
 * The URL must be the exact public URL Twilio called — behind a proxy we
 * reconstruct it from TWILIO_WEBHOOK_BASE_URL / NEXT_PUBLIC_BASE_URL.
 */
function verifyTwilioSignature(
  params: Record<string, string>,
  signatureHeader: string | null,
  pathname: string,
): { configured: boolean; valid: boolean } {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return { configured: false, valid: false };
  }
  if (!signatureHeader) {
    return { configured: true, valid: false };
  }

  const baseUrl = (
    process.env.TWILIO_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ""
  ).replace(/\/$/, "");
  const url = `${baseUrl}${pathname}`;

  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join("");

  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);
  const valid =
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);

  return { configured: true, valid };
}

function stripWhatsAppPrefix(value: string): string {
  return value.replace(/^whatsapp:/i, "");
}

async function twilioWhatsappWebhookHandler(request: NextRequest) {
  try {
    const ip = getRequestIdentifier(request);
    const rateLimitResult = checkRateLimit(`twilio_whatsapp_webhook:${ip}`, {
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!rateLimitResult.success) {
      await logSuspiciousActivity({
        category: "webhook_abuse",
        event: "twilio_whatsapp_webhook_rate_limited",
        severity: "warn",
        ip,
      });
      return NextResponse.json(
        { error: "Too many webhook requests" },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) },
      );
    }

    const formData = await request.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") params[key] = value;
    }

    const signature = request.headers.get("x-twilio-signature");
    const sig = verifyTwilioSignature(params, signature, "/api/webhooks/twilio-whatsapp");

    if (!sig.configured) {
      console.warn(
        "[Twilio WhatsApp Webhook] TWILIO_AUTH_TOKEN not set — cannot verify signature",
      );
      return twimlResponse(503);
    }

    if (!sig.valid) {
      console.warn("[Twilio WhatsApp Webhook] Invalid signature — rejecting request");
      await logSuspiciousActivity({
        category: "webhook_abuse",
        event: "twilio_whatsapp_webhook_invalid_signature",
        severity: "warn",
        ip,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const messageSid = params.MessageSid || params.SmsSid || "";
    const messageStatus = params.MessageStatus || params.SmsStatus || "";
    const body = params.Body || "";
    const from = stripWhatsAppPrefix(params.From || "");

    // Status callback (no body, has a delivery status)
    if (messageStatus && !body) {
      if (messageSid) {
        await updateWhatsAppMessageStatus({
          providerMessageId: messageSid,
          status: messageStatus,
        });
      }
      return twimlResponse();
    }

    // Inbound message
    if (from && (body || params.ButtonPayload || params.ButtonText)) {
      const incoming: WhatsAppIncomingMessage = params.ButtonPayload
        ? {
            from,
            id: messageSid,
            timestamp: `${Math.floor(Date.now() / 1000)}`,
            type: "button",
            button: {
              text: params.ButtonText || params.ButtonPayload,
              payload: params.ButtonPayload,
            },
          }
        : {
            from,
            id: messageSid,
            timestamp: `${Math.floor(Date.now() / 1000)}`,
            type: "text",
            text: { body },
          };

      const senderName = params.ProfileName || "Customer";

      // IMPORTANT: await — on serverless, fire-and-forget work freezes when
      // the response is sent, delaying replies by up to a minute. Processing
      // is sub-second; Twilio's webhook timeout is 15s.
      try {
        await handleIncomingMessage(incoming, senderName);
      } catch (error) {
        console.error("[Twilio WhatsApp Webhook] Processing error:", error);
      }
    }

    return twimlResponse();
  } catch (error) {
    console.error("[Twilio WhatsApp Webhook] Error:", error);
    // Return 200 to prevent Twilio retry storms on malformed payloads
    return twimlResponse();
  }
}


// Data Ownership Layer
export const POST = withVendorAudit("twilio", twilioWhatsappWebhookHandler);
