/**
 * Real A-to-Z Job + Payment Flow (hosted)
 *
 * This script exercises a realistic end-to-end path on the deployed API:
 * 1) Create job (booking)
 * 2) Locksmith applies
 * 3) Customer assessment payment intent is created + confirmed (4242 equivalent)
 * 4) Customer accepts locksmith application (job booked)
 * 5) Locksmith posts quote
 * 6) Job moves through live statuses to PENDING_CUSTOMER_CONFIRMATION
 * 7) Customer signs completion and final payment is charged
 * 8) Verify DB state + payments summary
 *
 * Card used:
 * - Stripe fixture `pm_card_visa` (equivalent to 4242 4242 4242 4242)
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   NEXT_PUBLIC_APP_URL=https://www.locksafe.uk npx tsx --tsconfig tsconfig.scripts.json scripts/test-a2z-book-pay-flow.ts
 */

import { getStripe } from "@/lib/stripe";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk";
const KEEP_TEST_DATA = process.env.KEEP_TEST_DATA === "true";

const TEST_CARD_PM = "pm_card_visa"; // 4242-equivalent

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function logStep(label: string, detail = "") {
  console.log(`${C.cyan}→${C.reset} ${label}${detail ? ` ${detail}` : ""}`);
}

function ok(label: string, detail = "") {
  console.log(`${C.green}✓${C.reset} ${label}${detail ? ` ${detail}` : ""}`);
}

function warn(label: string, detail = "") {
  console.log(`${C.yellow}⚠${C.reset} ${label}${detail ? ` ${detail}` : ""}`);
}

function fail(label: string, detail = "") {
  console.log(`${C.red}✗${C.reset} ${label}${detail ? ` ${detail}` : ""}`);
}

type JsonObject = Record<string, unknown>;

async function postJson(path: string, body: JsonObject): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = { raw: await res.text().catch(() => "") };
  }
  return { status: res.status, json };
}

async function patchJson(path: string, body: JsonObject): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = { raw: await res.text().catch(() => "") };
  }
  return { status: res.status, json };
}

async function cleanupTestData(jobId: string) {
  const { default: prisma } = await import("@/lib/db");

  await prisma.signature.deleteMany({ where: { jobId } });
  await prisma.payment.deleteMany({ where: { jobId } });
  await prisma.quote.deleteMany({ where: { jobId } });
  await prisma.locksmithApplication.deleteMany({ where: { jobId } });
  await prisma.jobAuction.deleteMany({ where: { jobId } });
  await prisma.job.delete({ where: { id: jobId } });
}

async function main() {
  console.log(`\n${C.bold}LockSafe Real Scenario: Booking + Payment A2Z${C.reset}`);
  console.log(`Base URL: ${BASE_URL}`);

  const stripe = getStripe();
  const { default: prisma } = await import("@/lib/db");
  let tempLocksmithId: string | null = null;

  // 1) Customer + locksmith preconditions
  logStep("Preparing test customer and locksmith");

  let customer = await prisma.customer.findFirst({
    where: { email: "a2z-flow-test@locksafe.internal" },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "A2Z Flow Test Customer",
        email: "a2z-flow-test@locksafe.internal",
        phone: "07700900001",
      },
    });
    ok("Created test customer", customer.id);
  } else {
    ok("Reusing test customer", customer.id);
  }

  let locksmith = await prisma.locksmith.findFirst({
    where: {
      isActive: true,
      isVerified: true,
      insuranceDocumentUrl: { not: null },
      NOT: { insuranceStatus: "expired" },
      stripeConnectId: null,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      stripeConnectId: true,
    },
  });

  // For this test we need a locksmith without Stripe Connect so final charge can
  // proceed through the manual-payout path in test mode.
  if (!locksmith) {
    const suffix = Date.now().toString().slice(-6);
    const created = await prisma.locksmith.create({
      data: {
        name: `A2Z Test Locksmith ${suffix}`,
        companyName: "LockSafe Test Ops",
        email: `a2z-locksmith-${suffix}@locksafe.internal`,
        phone: `0770091${suffix}`.slice(0, 11),
        isVerified: true,
        isActive: true,
        coverageAreas: ["SW1A"],
        services: ["lockout", "repair", "replacement"],
        baseLat: 51.5034,
        baseLng: -0.1276,
        coverageRadius: 15,
        insuranceDocumentUrl: `https://example.com/test-insurance-${suffix}.pdf`,
        insuranceStatus: "verified",
        insuranceExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        defaultAssessmentFee: 35,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        stripeConnectId: true,
      },
    });
    locksmith = created;
    tempLocksmithId = created.id;
    ok("Created temporary non-Connect locksmith", created.id);
  }

  ok("Selected locksmith", `${locksmith.name} (${locksmith.id})`);
  if (locksmith.stripeConnectId) warn("Selected locksmith has Stripe Connect ID", locksmith.stripeConnectId);

  // 2) Create job (booking request)
  logStep("Creating job via hosted API");
  const createJob = await postJson("/api/jobs", {
    customerId: customer.id,
    problemType: "lockout",
    propertyType: "house",
    postcode: "SW1A 1AA",
    address: "10 Downing Street, London SW1A 1AA",
    description: "[A2Z TEST] Real scenario booking + payment flow",
    requestGps: { lat: 51.5034, lng: -0.1276 },
  });

  if (createJob.status !== 200 || !createJob.json?.success) {
    throw new Error(`Job creation failed (${createJob.status}): ${JSON.stringify(createJob.json)}`);
  }

  const jobId = createJob.json.id as string;
  const jobNumber = createJob.json.jobNumber as string;
  ok("Job created", `${jobNumber} (${jobId})`);

  try {
    // 3) Locksmith applies
    logStep("Submitting locksmith application");
    const appRes = await postJson(`/api/jobs/${jobId}/applications`, {
      locksmithId: locksmith.id,
      assessmentFee: 35,
      eta: 25,
      message: "[A2Z TEST] I can attend quickly.",
    });

    if (appRes.status !== 200 || !appRes.json?.success) {
      throw new Error(`Application failed (${appRes.status}): ${JSON.stringify(appRes.json)}`);
    }

    const applicationId = appRes.json.application.id as string;
    ok("Application submitted", applicationId);

    // 4) Create assessment payment intent
    logStep("Creating assessment payment intent (£35)");
    const createIntent = await postJson("/api/payments/create-intent", {
      type: "assessment_fee",
      amount: 35,
      jobId,
      customerId: customer.id,
      locksmithId: locksmith.id,
      applicationId,
    });

    if (createIntent.status !== 200 || !createIntent.json?.paymentIntentId) {
      throw new Error(`Create-intent failed (${createIntent.status}): ${JSON.stringify(createIntent.json)}`);
    }

    const assessmentPiId = createIntent.json.paymentIntentId as string;
    const stripeCustomerId = createIntent.json.stripeCustomerId as string | undefined;
    ok("Assessment PaymentIntent created", assessmentPiId);

    // 5) Confirm PI with the 4242-equivalent fixture
    logStep("Confirming assessment payment (pm_card_visa ~= 4242)");
    const confirmedAssessment = await stripe.paymentIntents.confirm(assessmentPiId, {
      payment_method: TEST_CARD_PM,
      return_url: `${BASE_URL}/payment/return`,
    });

    if (confirmedAssessment.status !== "succeeded") {
      throw new Error(`Assessment payment status: ${confirmedAssessment.status}`);
    }

    const paymentMethodId = confirmedAssessment.payment_method as string;
    ok("Assessment payment succeeded", `${confirmedAssessment.id} (${paymentMethodId})`);

    // 6) Accept application (books locksmith and persists card refs)
    logStep("Accepting locksmith application");
    const acceptRes = await postJson(`/api/jobs/${jobId}/accept-application`, {
      applicationId,
      paymentIntentId: confirmedAssessment.id,
      stripeCustomerId: (confirmedAssessment.customer as string) || stripeCustomerId,
      stripePaymentMethodId: paymentMethodId,
    });

    if (acceptRes.status !== 200 || !acceptRes.json?.success) {
      throw new Error(`Accept-application failed (${acceptRes.status}): ${JSON.stringify(acceptRes.json)}`);
    }

    ok("Application accepted / job booked", acceptRes.json.job?.status || "ACCEPTED");

    // 7) Submit quote
    logStep("Submitting quote (£135 total)");
    const quoteRes = await postJson(`/api/jobs/${jobId}/quote`, {
      lockType: "Euro Cylinder",
      defect: "Latch and cylinder wear",
      difficulty: "medium",
      parts: [{ name: "Euro Cylinder", quantity: 1, unitPrice: 45, total: 45 }],
      labourCost: 90,
      labourTime: 45,
      partsTotal: 45,
      subtotal: 135,
      vat: 0,
      total: 135,
      quoteGps: { lat: 51.5034, lng: -0.1276 },
    });

    if (quoteRes.status !== 200 || !quoteRes.json?.success) {
      throw new Error(`Quote creation failed (${quoteRes.status}): ${JSON.stringify(quoteRes.json)}`);
    }
    ok("Quote submitted", `quoteId=${quoteRes.json.quote?.id}`);

    // 8) Customer accepts quote
    logStep("Accepting quote");
    const quoteAccept = await patchJson(`/api/jobs/${jobId}/quote`, { action: "accept" });
    if (quoteAccept.status !== 200 || !quoteAccept.json?.success) {
      throw new Error(`Quote accept failed (${quoteAccept.status}): ${JSON.stringify(quoteAccept.json)}`);
    }
    ok("Quote accepted", quoteAccept.json.job?.status || "QUOTE_ACCEPTED");

    // 9) Move status to waiting-for-signature
    logStep("Advancing status to PENDING_CUSTOMER_CONFIRMATION");
    const statuses = ["EN_ROUTE", "ARRIVED", "IN_PROGRESS", "PENDING_CUSTOMER_CONFIRMATION"] as const;
    for (const status of statuses) {
      const s = await patchJson(`/api/jobs/${jobId}/status`, {
        status,
        gpsData: { lat: 51.5034, lng: -0.1276 },
        eta: status === "EN_ROUTE" ? "15 minutes" : undefined,
      });
      if (s.status !== 200 || !s.json?.success) {
        throw new Error(`Status update ${status} failed (${s.status}): ${JSON.stringify(s.json)}`);
      }
      ok(`Status updated`, status);
    }

    // 10) Customer signs completion, triggering final off-session charge
    logStep("Signing completion and charging final payment");
    const signRes = await postJson(`/api/jobs/${jobId}/confirm-completion`, {
      signatureData: "data:image/png;base64,aGVsbG8=",
      signerName: "A2Z Test Customer",
      confirmsWork: true,
      confirmsPrice: true,
      confirmsSatisfied: true,
      signatureGps: { lat: 51.5034, lng: -0.1276 },
    });

    if (signRes.status !== 200 || !signRes.json?.success) {
      throw new Error(`Confirm-completion failed (${signRes.status}): ${JSON.stringify(signRes.json)}`);
    }

    ok("Job signed", signRes.json.signature?.id || "signature recorded");

    // 11) Verify final state from DB
    logStep("Verifying DB outcomes");
    const finalJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        quote: true,
        payments: true,
        customer: true,
      },
    });

    if (!finalJob) {
      throw new Error("Final job fetch failed");
    }

    const assessmentPayment = finalJob.payments.find((p) => p.type === "assessment");
    const finalPayment = finalJob.payments.find((p) => p.type === "final_payment");

    ok("Final job status", finalJob.status);
    ok("Assessment paid flag", String(finalJob.assessmentPaid));
    ok("Customer has saved Stripe customer", String(!!finalJob.customer?.stripeCustomerId));
    ok("Customer has saved payment method", String(!!finalJob.customer?.stripePaymentMethodId));

    console.log("\nPayment summary:");
    console.log(`- Assessment payment: ${assessmentPayment?.status || "missing"} (£${assessmentPayment?.amount ?? 0})`);
    console.log(`- Final payment: ${finalPayment?.status || "missing"} (£${finalPayment?.amount ?? 0})`);
    console.log(`- Quote total: £${finalJob.quote?.total ?? 0}`);
    console.log(`- Job number: ${finalJob.jobNumber}`);
    console.log(`- Admin URL: ${BASE_URL}/admin/jobs/${jobId}`);

    if (finalJob.status !== "SIGNED") {
      throw new Error(`Expected SIGNED, got ${finalJob.status}`);
    }

    if (!assessmentPayment || assessmentPayment.status !== "succeeded") {
      throw new Error("Assessment payment was not recorded as succeeded");
    }

    if (!finalPayment || finalPayment.status !== "succeeded") {
      throw new Error("Final payment was not recorded as succeeded");
    }

    console.log(`\n${C.green}${C.bold}A2Z FLOW PASSED${C.reset}`);
  } finally {
    if (!KEEP_TEST_DATA) {
      logStep("Cleaning up test records");
      try {
        await cleanupTestData(jobId);
        ok("Cleanup complete", jobId);
      } catch (err) {
        warn("Cleanup failed", String(err));
      }

      if (tempLocksmithId) {
        try {
          await prisma.locksmith.delete({ where: { id: tempLocksmithId } });
          ok("Temporary locksmith removed", tempLocksmithId);
        } catch (err) {
          warn("Temporary locksmith cleanup failed", String(err));
        }
      }
    } else {
      warn("Keeping test data", `jobId=${jobId}`);
    }
  }
}

main().catch((err) => {
  fail("A2Z flow failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
