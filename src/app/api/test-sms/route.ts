import { NextRequest, NextResponse } from "next/server";
import {
  sendSMS,
  sendJobNotification,
  JobEventType,
  getActiveSmsProvider,
  isSmsProviderConfigured,
  estimateSegments,
} from "@/lib/sms";

/**
 * Test SMS endpoint
 * POST /api/test-sms
 *
 * Body:
 * - phone: Phone number to send test SMS to
 * - event?: Job event type to simulate (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, event } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    // If event is specified, test the full job notification flow
    if (event) {
      const mockContext = {
        jobId: "test-job-id-123",
        jobNumber: "JOB-TEST-001",
        customerName: "Test Customer",
        customerPhone: phone,
        locksmithName: "Test Locksmith",
        locksmithPhone: phone,
        problemType: "lockout",
        postcode: "SW1A 1AA",
        address: "123 Test Street, London",
        eta: "15 minutes",
        assessmentFee: 49,
        quotedAmount: 150,
        finalAmount: 199,
      };

      const results = await sendJobNotification(event as JobEventType, mockContext);

      return NextResponse.json({
        success: true,
        message: `Test SMS sent for event: ${event}`,
        results,
        sentTo: phone,
      });
    }

    // Simple test message
    const testMessage = `LockSafe UK Test: SMS integration is working! Time: ${new Date().toISOString()}`;

    const result = await sendSMS(phone, testMessage, { logContext: "test-sms" });

    return NextResponse.json({
      success: result.success,
      message: result.success ? "Test SMS sent successfully" : "Failed to send SMS",
      messageId: result.messageId,
      error: result.error,
      sentTo: phone,
      segmentInfo: estimateSegments(testMessage),
    });
  } catch (error) {
    console.error("[Test SMS] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to show available test events
 */
export async function GET() {
  const activeProvider = getActiveSmsProvider();

  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID ||
        process.env.TWILIO_ALPHANUMERIC_SENDER_ID ||
        process.env.TWILIO_SMS_PHONE_NUMBER ||
        process.env.TWILIO_PHONE_NUMBER)
  );

  const zadarmaConfigured = Boolean(
    process.env.ZADARMA_USER_KEY && process.env.ZADARMA_API_SECRET
  );

  const twilioNumber = process.env.TWILIO_SMS_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  return NextResponse.json({
    message: "SMS Test Endpoint",
    usage: {
      method: "POST",
      body: {
        phone: "+447xxxxxxxxx (required)",
        event: "optional - job event type to simulate",
      },
    },
    availableEvents: [
      "job_submitted",
      "quote_received",
      "locksmith_accepted",
      "en_route",
      "arrived",
      "full_quote",
      "quote_approved",
      "work_started",
      "work_completed",
      "job_signed",
      "payment_success",
      "payment_received",
      "review_request",
      "refund",
    ],
    smsConfig: {
      activeProvider,
      activeProviderReady: isSmsProviderConfigured(activeProvider),
      twilio: {
        configured: twilioConfigured,
        accountSidConfigured: !!process.env.TWILIO_ACCOUNT_SID,
        authTokenConfigured: !!process.env.TWILIO_AUTH_TOKEN,
        senderConfigured: Boolean(
          process.env.TWILIO_MESSAGING_SERVICE_SID ||
            process.env.TWILIO_ALPHANUMERIC_SENDER_ID ||
            process.env.TWILIO_SMS_PHONE_NUMBER ||
            process.env.TWILIO_PHONE_NUMBER
        ),
        smsNumber: twilioNumber || "Not configured",
      },
      zadarma: {
        configured: zadarmaConfigured,
        userKeyConfigured: !!process.env.ZADARMA_USER_KEY,
        apiSecretConfigured: !!process.env.ZADARMA_API_SECRET,
        callerIdConfigured: !!process.env.ZADARMA_SMS_CALLER_ID,
      },
    },
    note: isSmsProviderConfigured(activeProvider)
      ? `SMS provider ${activeProvider} configured and ready`
      : `WARNING: SMS provider ${activeProvider} is not fully configured`,
  });
}
