export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyRetellSignature } from "@/lib/retell-auth";
import { processRetellEvent } from "@/lib/retell-handler";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getRequestIdentifier } from "@/lib/auth-rate-limit";
import { logSuspiciousActivity } from "@/lib/fraud-logger";
import { withVendorAudit } from "@/lib/vendor-audit";

const RETELL_WEBHOOK_MAX_REQUESTS = Number.parseInt(
  process.env.RETELL_WEBHOOK_RATE_LIMIT_MAX || "240",
  10,
);
const RETELL_WEBHOOK_WINDOW_SECONDS = Number.parseInt(
  process.env.RETELL_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS || "60",
  10,
);

async function retellWebhookHandler(request: NextRequest) {
  try {
    const ip = getRequestIdentifier(request);
    const rateLimitResult = checkRateLimit(`retell_webhook:${ip}`, {
      maxRequests: RETELL_WEBHOOK_MAX_REQUESTS,
      windowSeconds: RETELL_WEBHOOK_WINDOW_SECONDS,
    });

    if (!rateLimitResult.success) {
      await logSuspiciousActivity({
        category: "webhook_abuse",
        event: "retell_webhook_rate_limited",
        severity: "warn",
        ip,
      });
      return NextResponse.json(
        { error: "Too many webhook requests" },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) },
      );
    }

    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-retell-signature");

    console.log("[Retell Webhook] Incoming request. Signature present:", !!signatureHeader);

    const verification = await verifyRetellSignature(rawBody, signatureHeader);
    if (!verification.valid) {
      console.warn(`[Retell Webhook] Signature verification failed: ${verification.error}`);
      await logSuspiciousActivity({
        category: "webhook_abuse",
        event: "retell_webhook_invalid_signature",
        severity: "warn",
        ip,
      });
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Unauthorized", detail: verification.error },
          { status: 401 }
        );
      }
      // In non-production, log but continue processing
      console.log("[Retell Webhook] Non-production: continuing despite failed signature");
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await processRetellEvent(event);

    if (!result.success) {
      console.error(`[Retell Webhook] Processing failed: ${result.error}`);
      return NextResponse.json({ received: true, processed: false, error: result.error });
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error: any) {
    console.error("[Retell Webhook] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    service: "LockSafe Voice AI Receptionist",
    version: "1.0.0",
  });
}


// Data Ownership Layer
export const POST = withVendorAudit("retell", retellWebhookHandler);
