export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyRetellSignature } from "@/lib/retell-auth";
import { processRetellEvent } from "@/lib/retell-handler";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-retell-signature");

    const verification = verifyRetellSignature(rawBody, signatureHeader);
    if (!verification.valid) {
      console.warn(`[Retell Webhook] Signature verification failed: ${verification.error}`);
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Unauthorized", detail: verification.error },
          { status: 401 }
        );
      }
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
