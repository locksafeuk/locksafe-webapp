/**
 * Twilio SMS Webhook — inbound two-way customer SMS.
 *
 * The fix for the "send-only" gap: a customer who texts back "paid" or "running
 * late" lands HERE instead of vanishing. Records the message into the admin
 * inbox, then (when CUSTOMER_SMS_AUTOREPLY=true) routes it to Lockie — locksmith
 * Lockie for a known locksmith number, customer Lockie otherwise — and texts the
 * reply back from the same two-way number. While the flag is off, it still
 * records the inbound message and pings a human, so nothing is lost.
 *
 * Configure in Twilio: Messaging Service / number → "A message comes in" →
 *   https://<domain>/api/webhooks/twilio-sms  (HTTP POST)
 */

import { type NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { withVendorAudit } from "@/lib/vendor-audit";
import {
  recordIncomingWhatsAppMessage,
  recordOutgoingWhatsAppMessage,
  updateWhatsAppMessageStatus,
  smsHandoffState,
} from "@/lib/whatsapp-inbox";
import {
  identifyInboundPhone,
  handleLocksmithAIChat,
  handleLeadWhatsApp,
} from "@/lib/locksmith-whatsapp-adapter";
import { handleCustomerLockie } from "@/lib/customer-lockie";
import { sendSMS } from "@/lib/sms";
import { sendAdminAlert } from "@/lib/telegram";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getRequestIdentifier } from "@/lib/auth-rate-limit";
import { logSuspiciousActivity } from "@/lib/fraud-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX = Number.parseInt(process.env.SMS_WEBHOOK_RATE_LIMIT_MAX || "180", 10);
const RATE_LIMIT_WINDOW_SECONDS = Number.parseInt(
  process.env.SMS_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS || "60",
  10,
);

function twimlResponse(status = 200) {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

function verifyTwilioSignature(
  params: Record<string, string>,
  signatureHeader: string | null,
  pathname: string,
): { configured: boolean; valid: boolean } {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return { configured: false, valid: false };
  if (!signatureHeader) return { configured: true, valid: false };

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

const AUTOREPLY_ENABLED = () => process.env.CUSTOMER_SMS_AUTOREPLY === "true";

// SMS→WhatsApp hand-off: after a couple of texts, invite the customer to
// continue on WhatsApp (cheaper for us, richer for them). Their number is the
// same, so the conversation + context carry straight across.
const WHATSAPP_NUMBER = (process.env.TWILIO_WHATSAPP_NUMBER || "+447446588587").replace(/\D/g, "");
const WHATSAPP_HANDOFF_LINE =
  "For faster, more detailed support, you're welcome to continue with us on WhatsApp — " +
  "your details will carry across, so there's no need to repeat anything: " +
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi, I'd like to continue my LockSafe enquiry here.")}`;

/** STOP/HELP keywords — Twilio Messaging Service handles opt-out, but we also
 *  short-circuit so Lockie never replies over a compliance keyword. */
const COMPLIANCE_RE = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|start|unstop|help|info)\s*$/i;

async function routeToLockie(phone: string, text: string): Promise<string | null> {
  const identity = await identifyInboundPhone(phone);
  if (identity.kind === "locksmith") {
    return handleLocksmithAIChat(identity.id, identity.name, phone, text);
  }
  if (identity.kind === "lead") {
    return handleLeadWhatsApp(identity, text, phone);
  }
  return handleCustomerLockie(phone, text);
}

async function twilioSmsWebhookHandler(request: NextRequest) {
  try {
    const ip = getRequestIdentifier(request);
    const rateLimitResult = checkRateLimit(`twilio_sms_webhook:${ip}`, {
      maxRequests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (!rateLimitResult.success) {
      await logSuspiciousActivity({
        category: "webhook_abuse",
        event: "twilio_sms_webhook_rate_limited",
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
    const sig = verifyTwilioSignature(params, signature, "/api/webhooks/twilio-sms");
    if (!sig.configured) {
      console.warn("[Twilio SMS Webhook] TWILIO_AUTH_TOKEN not set — cannot verify signature");
      return twimlResponse(503);
    }
    if (!sig.valid) {
      await logSuspiciousActivity({
        category: "webhook_abuse",
        event: "twilio_sms_webhook_invalid_signature",
        severity: "warn",
        ip,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const messageSid = params.MessageSid || params.SmsSid || "";
    const messageStatus = params.MessageStatus || params.SmsStatus || "";
    const body = (params.Body || "").trim();
    const from = params.From || "";

    // Delivery status callback (no body)
    if (messageStatus && !body) {
      if (messageSid) {
        await updateWhatsAppMessageStatus({ providerMessageId: messageSid, status: messageStatus });
      }
      return twimlResponse();
    }

    if (!from || !body) return twimlResponse();

    // Always record the inbound message so it can never vanish.
    await recordIncomingWhatsAppMessage({
      phone: from,
      messageType: "sms",
      channel: "sms",
      content: body,
      providerMessageId: messageSid || null,
      rawPayload: params,
    }).catch((e) => console.error("[Twilio SMS Webhook] record inbound failed:", e));

    // Compliance keywords: never auto-reply; let the Messaging Service handle
    // opt-out and flag a human if needed.
    if (COMPLIANCE_RE.test(body)) return twimlResponse();

    if (!AUTOREPLY_ENABLED()) {
      // Flag-off mode: surface to a human instead of auto-replying.
      await sendAdminAlert({
        title: "📩 New customer SMS (auto-reply off)",
        message: `From ${from}: "${body.slice(0, 300)}"\nReply in the inbox.`,
        severity: "info",
        topic: "agents",
        dedupeKey: `sms-inbound:${from}`,
        cooldownMsOverride: 10 * 60 * 1000,
      }).catch(() => {});
      return twimlResponse();
    }

    // Auto-reply via Lockie.
    try {
      let reply = await routeToLockie(from, body);
      if (reply) {
        // After a couple of texts, append the WhatsApp invite once — but only
        // when the WhatsApp side is set to pick up with Lockie, so we never
        // hand a customer off into the old booking menu.
        try {
          if (process.env.CUSTOMER_WHATSAPP_AGENTIC === "true") {
            const { inboundSms, alreadyOffered } = await smsHandoffState(from);
            if (!alreadyOffered && inboundSms >= 2) {
              reply += `\n\n${WHATSAPP_HANDOFF_LINE}`;
            }
          }
        } catch {
          /* non-fatal — send the reply without the invite */
        }
        const result = await sendSMS(from, reply, {
          channel: "transactional",
          logContext: "sms-lockie-reply",
        });
        await recordOutgoingWhatsAppMessage({
          phone: from,
          messageType: "sms",
          channel: "sms",
          content: reply,
          providerMessageId: result.messageId ?? null,
        }).catch(() => {});
      }
    } catch (error) {
      console.error("[Twilio SMS Webhook] Lockie reply error:", error);
    }

    return twimlResponse();
  } catch (error) {
    console.error("[Twilio SMS Webhook] Fatal error:", error);
    return twimlResponse(200);
  }
}


// Data Ownership Layer
export const POST = withVendorAudit("twilio", twilioSmsWebhookHandler);
