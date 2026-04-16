import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  verifyBlandWebhook,
  unauthorizedResponse,
  blandCorsHeaders,
  logBlandRequest,
  checkRateLimit,
  getClientIp,
} from "@/lib/bland-auth";

// Handle OPTIONS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: blandCorsHeaders });
}

/**
 * Bland.ai Webhook: Post-call data
 * Receives call summary and extracted variables after call ends
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
        },
        { status: 429, headers: blandCorsHeaders }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Verify authentication
    const authResult = await verifyBlandWebhook(request, rawBody);
    if (!authResult.isValid) {
      return unauthorizedResponse(authResult.error);
    }

    // Log request (without full body for webhooks - can be large)
    console.log("[Bland.ai Webhook] Received post-call data:", {
      auth: authResult.method,
      call_id: body.call_id,
      call_status: body.call_status,
      timestamp: new Date().toISOString(),
    });

    const {
      call_id,
      call_status,
      call_length,
      from,
      to,
      completed,
      created_at,
      ended_at,
      transcripts,
      summary,
      variables,
      recording_url,
      error_message,
    } = body;

    // Extract relevant variables from the call
    const extractedData = {
      call_id,
      call_status,
      call_length_seconds: call_length,
      from_number: from,
      to_number: to,
      completed,
      created_at,
      ended_at,
      summary,
      recording_url,
      error_message,
      // Extracted variables from conversation
      customer_name: variables?.customer_name || variables?.full_name || variables?.caller_name,
      customer_email: variables?.email || variables?.customer_email,
      customer_phone: variables?.phone_number || variables?.customer_phone || from,
      service_type: variables?.service_type,
      property_type: variables?.property_type,
      postcode: variables?.postcode,
      address: variables?.address,
      urgency: variables?.urgency || variables?.preferred_timeframe,
      customer_id: variables?.customer_id,
      job_id: variables?.job_id,
      job_number: variables?.job_number,
    };

    // If we have a job_id from the call, update the job with call data
    if (extractedData.job_id) {
      try {
        await prisma.job.update({
          where: { id: extractedData.job_id },
          data: {
            blandCallId: call_id,
            phoneCollectedData: {
              ...(typeof body.variables === 'object' ? body.variables : {}),
              call_id,
              call_status,
              call_length_seconds: call_length,
              completed,
              summary,
              recording_url,
              webhook_received_at: new Date().toISOString(),
            },
          },
        });
        console.log(`[Bland.ai Webhook] Updated job ${extractedData.job_id} with call data`);
      } catch (updateError) {
        console.error("[Bland.ai Webhook] Failed to update job:", updateError);
      }
    }

    // Log call analytics
    try {
      await prisma.analyticsEvent.create({
        data: {
          type: "bland_call_completed",
          data: {
            call_id,
            call_status,
            call_length_seconds: call_length,
            completed,
            had_error: !!error_message,
            error_message,
            customer_id: extractedData.customer_id,
            job_id: extractedData.job_id,
            job_number: extractedData.job_number,
            service_type: extractedData.service_type,
            from_number: from,
          },
          userId: extractedData.customer_id,
          userType: "customer",
        },
      });
    } catch (analyticsError) {
      console.error("[Bland.ai Webhook] Failed to log analytics:", analyticsError);
    }

    // Handle failed calls
    if (!completed || error_message) {
      console.error(`[Bland.ai Webhook] Call failed: ${error_message || "Unknown error"}`);
      // Could send internal notification here
    }

    return NextResponse.json(
      {
        success: true,
        message: "Webhook processed",
        call_id,
        job_id: extractedData.job_id,
      },
      { headers: blandCorsHeaders }
    );

  } catch (error) {
    console.error("[Bland.ai Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process webhook" },
      { status: 500, headers: blandCorsHeaders }
    );
  }
}

// Also handle GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    service: "LockSafe Bland.ai Webhook",
    timestamp: new Date().toISOString(),
  });
}
