/**
 * Test All Telegram Notifications
 *
 * POST /api/admin/telegram/test-all
 *
 * Sends test notifications for all notification types to verify the integration.
 */

import { NextResponse } from "next/server";
import {
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
  sendAdminAlert,
  sendDailySummary,
} from "@/lib/telegram";

export async function POST() {
  const results: Array<{ scenario: string; success: boolean; error?: string }> = [];

  // Helper to add delay between messages to avoid rate limiting
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // 1. New Customer
    const r1 = await notifyNewCustomer({
      name: "John Smith (TEST)",
      email: "john.test@example.com",
      phone: "07700 900123",
    });
    results.push({ scenario: "New Customer", success: r1 });
    await delay(500);

    // 2. New Locksmith
    const r2 = await notifyNewLocksmith({
      name: "Mike's Locks (TEST)",
      email: "mike.test@example.com",
      phone: "07700 900456",
      companyName: "Mike's Lock Services",
      baseAddress: "123 High Street, London",
      coverageRadius: 15,
    });
    results.push({ scenario: "New Locksmith", success: r2 });
    await delay(500);

    // 3. New Job
    const r3 = await notifyNewJob({
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
    results.push({ scenario: "New Job (Urgent)", success: r3 });
    await delay(500);

    // 4. Locksmith Application
    const r4 = await notifyLocksmithApplication({
      jobNumber: "LS-TEST-0001",
      jobId: "test-job-id",
      locksmithName: "Dave Thompson (TEST)",
      locksmithCompany: "24/7 Lock Solutions",
      locksmithPhone: "07700 900111",
      customerName: "Sarah Johnson",
      estimatedArrival: "15 minutes",
      distanceMiles: 2.3,
    });
    results.push({ scenario: "Locksmith Application", success: r4 });
    await delay(500);

    // 5. Application Accepted
    const r5 = await notifyApplicationAccepted({
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
    results.push({ scenario: "Application Accepted", success: r5 });
    await delay(500);

    // 6. Assessment Fee Paid
    const r6 = await notifyAssessmentFeePaid({
      jobNumber: "LS-TEST-0001",
      jobId: "test-job-id",
      customerName: "Sarah Johnson (TEST)",
      locksmithName: "Dave Thompson",
      amount: 49.00,
    });
    results.push({ scenario: "Assessment Fee Paid", success: r6 });
    await delay(500);

    // 7. Quote Submitted
    const r7 = await notifyQuoteSubmitted({
      jobNumber: "LS-TEST-0001",
      jobId: "test-job-id",
      locksmithName: "Dave Thompson (TEST)",
      customerName: "Sarah Johnson",
      labourCost: 85.00,
      partsCost: 45.00,
      total: 130.00,
      description: "Replace cylinder lock and provide 3 new keys",
    });
    results.push({ scenario: "Quote Submitted", success: r7 });
    await delay(500);

    // 8. Quote Accepted
    const r8 = await notifyQuoteAccepted({
      jobNumber: "LS-TEST-0001",
      jobId: "test-job-id",
      locksmithName: "Dave Thompson (TEST)",
      customerName: "Sarah Johnson",
      total: 130.00,
    });
    results.push({ scenario: "Quote Accepted", success: r8 });
    await delay(500);

    // 9. Quote Declined
    const r9 = await notifyQuoteDeclined({
      jobNumber: "LS-TEST-0002",
      jobId: "test-job-id-2",
      locksmithName: "Another Locksmith (TEST)",
      customerName: "Test Customer",
      total: 250.00,
      reason: "Too expensive",
    });
    results.push({ scenario: "Quote Declined", success: r9 });
    await delay(500);

    // 10. Work Completed
    const r10 = await notifyWorkCompleted({
      jobNumber: "LS-TEST-0001",
      jobId: "test-job-id",
      locksmithName: "Dave Thompson (TEST)",
      customerName: "Sarah Johnson",
      total: 130.00,
    });
    results.push({ scenario: "Work Completed", success: r10 });
    await delay(500);

    // 11. Job Signed
    const r11 = await notifyJobSigned({
      jobNumber: "LS-TEST-0001",
      jobId: "test-job-id",
      locksmithName: "Dave Thompson (TEST)",
      customerName: "Sarah Johnson",
      total: 130.00,
      locksmithEarnings: 110.50,
      platformFee: 19.50,
    });
    results.push({ scenario: "Job Signed Off", success: r11 });
    await delay(500);

    // 12. Payment Received
    const r12 = await notifyPaymentReceived({
      jobNumber: "LS-TEST-0001",
      jobId: "test-job-id",
      customerName: "Sarah Johnson (TEST)",
      locksmithName: "Dave Thompson",
      amount: 130.00,
      paymentType: "full_payment",
      method: "Card (Stripe)",
    });
    results.push({ scenario: "Payment Received", success: r12 });
    await delay(500);

    // 13. Refund Requested
    const r13 = await notifyRefundRequested({
      jobNumber: "LS-TEST-0003",
      jobId: "test-job-id-3",
      customerName: "Unhappy Customer (TEST)",
      amount: 49.00,
      reason: "Locksmith did not arrive",
    });
    results.push({ scenario: "Refund Requested", success: r13 });
    await delay(500);

    // 14. Refund Processed
    const r14 = await notifyRefundProcessed({
      jobNumber: "LS-TEST-0003",
      jobId: "test-job-id-3",
      customerName: "Unhappy Customer (TEST)",
      amount: 49.00,
      approved: true,
      adminNotes: "Refund approved - locksmith no-show confirmed",
    });
    results.push({ scenario: "Refund Processed", success: r14 });
    await delay(500);

    // 15. Locksmith Arrived
    const r15 = await notifyLocksmithArrived({
      jobNumber: "LS-TEST-0001",
      jobId: "test-job-id",
      locksmithName: "Dave Thompson (TEST)",
      customerName: "Sarah Johnson",
      address: "10 Downing Street, SW1A 1AA",
    });
    results.push({ scenario: "Locksmith Arrived", success: r15 });
    await delay(500);

    // 16. Review Submitted
    const r16 = await notifyReviewSubmitted({
      jobNumber: "LS-TEST-0001",
      locksmithName: "Dave Thompson (TEST)",
      customerName: "Sarah Johnson",
      rating: 5,
      comment: "Excellent service! Fast and professional. Highly recommended!",
    });
    results.push({ scenario: "Review Submitted (5 stars)", success: r16 });
    await delay(500);

    // 17. Job Auto-Completed
    const r17 = await notifyJobAutoCompleted({
      jobNumber: "LS-TEST-0004",
      jobId: "test-job-id-4",
      locksmithName: "Test Locksmith (TEST)",
      customerName: "No Response Customer",
      total: 95.00,
      paymentProcessed: true,
    });
    results.push({ scenario: "Job Auto-Completed", success: r17 });
    await delay(500);

    // 18. Stripe Connect Completed
    const r18 = await notifyStripeConnectCompleted({
      locksmithName: "New Pro Locksmith (TEST)",
      locksmithEmail: "pro.locksmith@example.com",
    });
    results.push({ scenario: "Stripe Connect Completed", success: r18 });
    await delay(500);

    // 19. New Lead
    const r19 = await notifyNewLead({
      email: "interested@example.com",
      phone: "07700 900999",
      source: "Google Ads",
      utmCampaign: "lockout_emergency_march",
    });
    results.push({ scenario: "New Lead Captured", success: r19 });
    await delay(500);

    // 20. Admin Alert (Info)
    const r20a = await sendAdminAlert({
      title: "System Test (INFO)",
      message: "This is a test INFO alert from the notification system.",
      severity: "info",
    });
    results.push({ scenario: "Admin Alert (Info)", success: r20a });
    await delay(500);

    // 21. Admin Alert (Warning)
    const r20b = await sendAdminAlert({
      title: "System Test (WARNING)",
      message: "This is a test WARNING alert from the notification system.",
      severity: "warning",
    });
    results.push({ scenario: "Admin Alert (Warning)", success: r20b });
    await delay(500);

    // 22. Admin Alert (Error)
    const r20c = await sendAdminAlert({
      title: "System Test (ERROR)",
      message: "This is a test ERROR alert from the notification system.",
      severity: "error",
    });
    results.push({ scenario: "Admin Alert (Error)", success: r20c });
    await delay(500);

    // 23. Daily Summary
    const r21 = await sendDailySummary({
      date: new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }),
      newCustomers: 12,
      newLocksmiths: 3,
      newJobs: 28,
      completedJobs: 24,
      totalRevenue: 4850.00,
      platformEarnings: 727.50,
    });
    results.push({ scenario: "Daily Summary", success: r21 });

    // Count results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Sent ${successful} of ${results.length} test notifications`,
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
    });

  } catch (error) {
    console.error("[Telegram Test All] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to send all test notifications",
    scenarios: [
      "New Customer",
      "New Locksmith",
      "New Job (Urgent)",
      "Locksmith Application",
      "Application Accepted",
      "Assessment Fee Paid",
      "Quote Submitted",
      "Quote Accepted",
      "Quote Declined",
      "Work Completed",
      "Job Signed Off",
      "Payment Received",
      "Refund Requested",
      "Refund Processed",
      "Locksmith Arrived",
      "Review Submitted",
      "Job Auto-Completed",
      "Stripe Connect Completed",
      "New Lead Captured",
      "Admin Alert (Info)",
      "Admin Alert (Warning)",
      "Admin Alert (Error)",
      "Daily Summary",
    ],
  });
}
