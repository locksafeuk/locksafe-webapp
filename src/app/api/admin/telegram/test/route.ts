import { NextRequest, NextResponse } from "next/server";
import {
  testTelegramConnection,
  sendAdminAlert,
  notifyNewCustomer,
  notifyNewLocksmith,
  notifyNewJob,
  notifyLocksmithApplication,
  notifyApplicationAccepted,
  notifyAssessmentFeePaid,
  notifyQuoteSubmitted,
  notifyQuoteAccepted,
  notifyQuoteDeclined,
  notifyWorkCompleted,
  notifyJobSigned,
  notifyPaymentReceived,
  notifyRefundRequested,
  notifyRefundProcessed,
  notifyLocksmithArrived,
  notifyReviewSubmitted,
  notifyJobAutoCompleted,
  notifyStripeConnectCompleted,
  notifyNewLead,
  sendDailySummary,
} from "@/lib/telegram";

// GET - Test Telegram connection or specific scenario
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scenario = searchParams.get("scenario");
  const all = searchParams.get("all") === "true";

  // If testing all scenarios
  if (all) {
    return await testAllScenarios();
  }

  // If testing a specific scenario
  if (scenario) {
    return await testScenario(scenario);
  }

  // Default: test connection
  try {
    const result = await testTelegramConnection();
    return NextResponse.json({
      ...result,
      availableScenarios: AVAILABLE_SCENARIOS,
      usage: {
        testConnection: "GET /api/admin/telegram/test",
        testScenario: "GET /api/admin/telegram/test?scenario=new_customer",
        testAll: "GET /api/admin/telegram/test?all=true",
      },
    });
  } catch (error) {
    console.error("[Telegram Test] Error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

const AVAILABLE_SCENARIOS = [
  "new_customer",
  "new_locksmith",
  "new_job",
  "locksmith_application",
  "application_accepted",
  "assessment_fee_paid",
  "quote_submitted",
  "quote_accepted",
  "quote_declined",
  "work_completed",
  "job_signed",
  "payment_received",
  "refund_requested",
  "refund_processed",
  "locksmith_arrived",
  "review_submitted",
  "job_auto_completed",
  "stripe_connect",
  "new_lead",
  "admin_alert_info",
  "admin_alert_warning",
  "admin_alert_error",
  "daily_summary",
];

async function testScenario(scenario: string): Promise<NextResponse> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    let result: boolean;

    switch (scenario) {
      case "new_customer":
        result = await notifyNewCustomer({
          name: "John Smith (TEST)",
          email: "john.test@example.com",
          phone: "07700 900123",
        });
        break;

      case "new_locksmith":
        result = await notifyNewLocksmith({
          name: "Mike's Locks (TEST)",
          email: "mike.test@example.com",
          phone: "07700 900456",
          companyName: "Mike's Lock Services",
          baseAddress: "123 High Street, London",
          coverageRadius: 15,
        });
        break;

      case "new_job":
        result = await notifyNewJob({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          customerName: "Sarah Johnson (TEST)",
          customerPhone: "07700 900789",
          problemType: "Locked Out",
          propertyType: "House",
          postcode: "SW1A 1AA",
          address: "10 Downing Street, London",
          description: "Lost keys, need emergency access",
          isUrgent: true,
        });
        break;

      case "locksmith_application":
        result = await notifyLocksmithApplication({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          locksmithName: "Dave Thompson (TEST)",
          locksmithCompany: "24/7 Lock Solutions",
          locksmithPhone: "07700 900111",
          customerName: "Sarah Johnson",
          estimatedArrival: "15 minutes",
          distanceMiles: 2.3,
        });
        break;

      case "application_accepted":
        result = await notifyApplicationAccepted({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          locksmithName: "Dave Thompson (TEST)",
          locksmithPhone: "07700 900111",
          customerName: "Sarah Johnson",
          customerPhone: "07700 900789",
          address: "10 Downing Street",
          postcode: "SW1A 1AA",
          estimatedArrival: "15 minutes",
        });
        break;

      case "assessment_fee_paid":
        result = await notifyAssessmentFeePaid({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          customerName: "Sarah Johnson (TEST)",
          locksmithName: "Dave Thompson",
          amount: 49.0,
        });
        break;

      case "quote_submitted":
        result = await notifyQuoteSubmitted({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          locksmithName: "Dave Thompson (TEST)",
          customerName: "Sarah Johnson",
          labourCost: 85.0,
          partsCost: 45.0,
          total: 130.0,
          description: "Replace cylinder lock and provide 3 new keys",
        });
        break;

      case "quote_accepted":
        result = await notifyQuoteAccepted({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          locksmithName: "Dave Thompson (TEST)",
          customerName: "Sarah Johnson",
          total: 130.0,
        });
        break;

      case "quote_declined":
        result = await notifyQuoteDeclined({
          jobNumber: "LS-TEST-0002",
          jobId: "test-job-id-2",
          locksmithName: "Another Locksmith (TEST)",
          customerName: "Test Customer",
          total: 250.0,
          reason: "Too expensive",
        });
        break;

      case "work_completed":
        result = await notifyWorkCompleted({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          locksmithName: "Dave Thompson (TEST)",
          customerName: "Sarah Johnson",
          total: 130.0,
        });
        break;

      case "job_signed":
        result = await notifyJobSigned({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          locksmithName: "Dave Thompson (TEST)",
          customerName: "Sarah Johnson",
          total: 130.0,
          locksmithEarnings: 110.5,
          platformFee: 19.5,
        });
        break;

      case "payment_received":
        result = await notifyPaymentReceived({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          customerName: "Sarah Johnson (TEST)",
          locksmithName: "Dave Thompson",
          amount: 130.0,
          paymentType: "full_payment",
          method: "Card (Stripe)",
        });
        break;

      case "refund_requested":
        result = await notifyRefundRequested({
          jobNumber: "LS-TEST-0003",
          jobId: "test-job-id-3",
          customerName: "Unhappy Customer (TEST)",
          amount: 49.0,
          reason: "Locksmith did not arrive",
        });
        break;

      case "refund_processed":
        result = await notifyRefundProcessed({
          jobNumber: "LS-TEST-0003",
          jobId: "test-job-id-3",
          customerName: "Unhappy Customer (TEST)",
          amount: 49.0,
          approved: true,
          adminNotes: "Refund approved - locksmith no-show confirmed",
        });
        break;

      case "locksmith_arrived":
        result = await notifyLocksmithArrived({
          jobNumber: "LS-TEST-0001",
          jobId: "test-job-id",
          locksmithName: "Dave Thompson (TEST)",
          customerName: "Sarah Johnson",
          address: "10 Downing Street, SW1A 1AA",
        });
        break;

      case "review_submitted":
        result = await notifyReviewSubmitted({
          jobNumber: "LS-TEST-0001",
          locksmithName: "Dave Thompson (TEST)",
          customerName: "Sarah Johnson",
          rating: 5,
          comment: "Excellent service! Fast and professional.",
        });
        break;

      case "job_auto_completed":
        result = await notifyJobAutoCompleted({
          jobNumber: "LS-TEST-0004",
          jobId: "test-job-id-4",
          locksmithName: "Test Locksmith (TEST)",
          customerName: "No Response Customer",
          total: 95.0,
          paymentProcessed: true,
        });
        break;

      case "stripe_connect":
        result = await notifyStripeConnectCompleted({
          locksmithName: "New Pro Locksmith (TEST)",
          locksmithEmail: "pro.locksmith@example.com",
        });
        break;

      case "new_lead":
        result = await notifyNewLead({
          email: "interested@example.com",
          phone: "07700 900999",
          source: "Google Ads",
          utmCampaign: "lockout_emergency_march",
        });
        break;

      case "admin_alert_info":
        result = await sendAdminAlert({
          title: "System Test (INFO)",
          message: "This is a test INFO alert.",
          severity: "info",
        });
        break;

      case "admin_alert_warning":
        result = await sendAdminAlert({
          title: "System Test (WARNING)",
          message: "This is a test WARNING alert.",
          severity: "warning",
        });
        break;

      case "admin_alert_error":
        result = await sendAdminAlert({
          title: "System Test (ERROR)",
          message: "This is a test ERROR alert.",
          severity: "error",
        });
        break;

      case "daily_summary":
        result = await sendDailySummary({
          date: new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          newCustomers: 12,
          newLocksmiths: 3,
          newJobs: 28,
          completedJobs: 24,
          totalRevenue: 4850.0,
          platformEarnings: 727.5,
        });
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown scenario: ${scenario}`,
            availableScenarios: AVAILABLE_SCENARIOS,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: result, scenario });
  } catch (error) {
    console.error(`[Telegram Test] Error in scenario ${scenario}:`, error);
    return NextResponse.json(
      { success: false, scenario, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function testAllScenarios(): Promise<NextResponse> {
  const results: Array<{ scenario: string; success: boolean }> = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const scenario of AVAILABLE_SCENARIOS) {
    try {
      const response = await testScenario(scenario);
      const data = await response.json();
      results.push({ scenario, success: data.success });
      await delay(600); // Delay to avoid rate limiting
    } catch (error) {
      results.push({ scenario, success: false });
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return NextResponse.json({
    success: failed === 0,
    message: `Sent ${successful} of ${results.length} test notifications`,
    summary: { total: results.length, successful, failed },
    results,
  });
}

// POST - Send a custom admin alert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, message, severity } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "Title and message are required" },
        { status: 400 }
      );
    }

    const result = await sendAdminAlert({
      title,
      message,
      severity: severity || "info",
    });

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error("[Telegram Alert] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
