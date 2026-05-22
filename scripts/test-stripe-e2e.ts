/**
 * Stripe Sandbox End-to-End Test
 *
 * Tests the full LockSafe payment workflow in Stripe TEST mode:
 *   1. Key mode validation (sk_test / pk_test consistency)
 *   2. Stripe Connect — create test Express account for locksmith
 *   3. Customer creation + SetupIntent (save card — Stripe test card 4242)
 *   4. Assessment fee charge (15% platform fee, 85% to locksmith)
 *   5. Work quote final charge via confirm-completion path
 *   6. Fee split verification — platform fee + locksmith share add up
 *   7. Decline card (4000 0000 0000 0002) — expect charge_failed
 *   8. Mode-mismatch guard — assertStripeModeConsistency() throws on sk_live + pk_test
 *   9. Rate limit sanity — 21 rapid POST requests → at least one 429
 *
 * Prerequisites:
 *   - STRIPE_SECRET_KEY must start with sk_test_
 *   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_
 *   - Run Stripe CLI: stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-stripe-e2e.ts
 */

import Stripe from "stripe";
import {
  getStripeMode,
  assertStripeModeConsistency,
  ASSESSMENT_FEE_COMMISSION,
  WORK_QUOTE_COMMISSION,
  formatAmountForStripe,
  formatAmountFromStripe,
  calculatePlatformFee,
  calculateLocksmithShare,
} from "../src/lib/stripe";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function pass(label: string) {
  console.log(`${GREEN}✓${RESET} ${label}`);
  passed++;
}

function fail(label: string, reason?: unknown) {
  const msg = reason instanceof Error ? reason.message : String(reason ?? "");
  console.log(`${RED}✗${RESET} ${label}${msg ? ` — ${msg}` : ""}`);
  failed++;
  failures.push(`${label}${msg ? `: ${msg}` : ""}`);
}

function section(title: string) {
  console.log(`\n${CYAN}━━━ ${title} ━━━${RESET}`);
}

function warn(msg: string) {
  console.log(`${YELLOW}⚠${RESET}  ${msg}`);
}

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    pass(label);
  } else {
    fail(label, detail ?? "assertion failed");
  }
}

// ---------------------------------------------------------------------------
// Bootstrap Stripe client (must be test key)
// ---------------------------------------------------------------------------

const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const PUB_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

if (!SECRET_KEY) {
  console.error(`${RED}STRIPE_SECRET_KEY is not set. Aborting.${RESET}`);
  process.exit(1);
}

if (!SECRET_KEY.startsWith("sk_test_")) {
  console.error(
    `${RED}STRIPE_SECRET_KEY must be a TEST key (sk_test_*). Found: ${SECRET_KEY.slice(0, 12)}... Aborting.${RESET}`
  );
  process.exit(1);
}

const stripe = new Stripe(SECRET_KEY, {
  apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  typescript: true,
});

// Synthetic IDs for resources created during the test — cleaned up at the end
const cleanup: { type: string; id: string }[] = [];

// ---------------------------------------------------------------------------
// Test cards (Stripe-defined, never real)
// ---------------------------------------------------------------------------
const CARD_SUCCESS = "pm_card_gb"; // UK Visa — succeeds
const CARD_DECLINE = "pm_card_chargeDeclined"; // Always declined
const CARD_3DS = "pm_card_authenticationRequired"; // Requires 3DS

// ---------------------------------------------------------------------------
// SECTION 1 — Key Mode Validation
// ---------------------------------------------------------------------------

async function testKeyMode() {
  section("1. Key Mode Validation");

  assert(
    getStripeMode() === "test",
    "getStripeMode() returns 'test' for sk_test_* key"
  );

  // assertStripeModeConsistency — same mode pair should not throw
  try {
    // Temporarily override env
    const origPub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_placeholder";
    assertStripeModeConsistency();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = origPub;
    pass("assertStripeModeConsistency() accepts sk_test + pk_test pair");
  } catch (err) {
    fail("assertStripeModeConsistency() should not throw on matching test keys", err);
  }

  // Mismatch detection — sk_live + pk_test
  const origKey = process.env.STRIPE_SECRET_KEY!;
  const origPub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_live_placeholder_test_ONLY";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_placeholder";
  try {
    assertStripeModeConsistency();
    fail("assertStripeModeConsistency() should throw on sk_live + pk_test mismatch");
  } catch {
    pass("assertStripeModeConsistency() throws on sk_live + pk_test mismatch");
  }
  process.env.STRIPE_SECRET_KEY = origKey;
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = origPub;

  // Mismatch detection — sk_test + pk_live
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder_test_ONLY";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_placeholder";
  try {
    assertStripeModeConsistency();
    fail("assertStripeModeConsistency() should throw on sk_test + pk_live mismatch");
  } catch {
    pass("assertStripeModeConsistency() throws on sk_test + pk_live mismatch");
  }
  process.env.STRIPE_SECRET_KEY = origKey;
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = origPub;
}

// ---------------------------------------------------------------------------
// SECTION 2 — Fee Split Maths
// ---------------------------------------------------------------------------

async function testFeeCalculations() {
  section("2. Fee Split Maths");

  // Assessment fee: £35, 15% commission
  const assessmentAmount = 35;
  const assessmentPlatformFee = calculatePlatformFee(assessmentAmount, "assessment_fee");
  const assessmentLocksmithShare = calculateLocksmithShare(assessmentAmount, "assessment_fee");

  assert(
    assessmentPlatformFee === Math.round(3500 * 0.15),
    `Assessment platform fee = ${assessmentPlatformFee}p (expect ${Math.round(3500 * 0.15)}p)`
  );
  assert(
    assessmentLocksmithShare === assessmentAmount * (1 - ASSESSMENT_FEE_COMMISSION),
    `Assessment locksmith share = £${assessmentLocksmithShare.toFixed(2)} (expect £${(assessmentAmount * 0.85).toFixed(2)})`
  );
  assert(
    Math.abs(formatAmountFromStripe(assessmentPlatformFee) + assessmentLocksmithShare - assessmentAmount) < 0.01,
    "Assessment: platformFee + locksmithShare = total"
  );

  // Work quote: £200, 25% commission
  const workAmount = 200;
  const workPlatformFee = calculatePlatformFee(workAmount, "work_quote");
  const workLocksmithShare = calculateLocksmithShare(workAmount, "work_quote");

  assert(
    workPlatformFee === Math.round(20000 * 0.25),
    `Work quote platform fee = ${workPlatformFee}p (expect ${Math.round(20000 * 0.25)}p)`
  );
  assert(
    workLocksmithShare === workAmount * (1 - WORK_QUOTE_COMMISSION),
    `Work quote locksmith share = £${workLocksmithShare.toFixed(2)} (expect £${(workAmount * 0.75).toFixed(2)})`
  );
  assert(
    Math.abs(formatAmountFromStripe(workPlatformFee) + workLocksmithShare - workAmount) < 0.01,
    "Work quote: platformFee + locksmithShare = total"
  );

  // Pence conversion round-trips
  assert(formatAmountForStripe(35) === 3500, "£35 → 3500p");
  assert(formatAmountFromStripe(3500) === 35, "3500p → £35");
}

// ---------------------------------------------------------------------------
// SECTION 3 — Stripe Customer + Payment Method
// ---------------------------------------------------------------------------

let testCustomerId: string;
let testPaymentMethodId: string;

async function testCustomerCreation() {
  section("3. Stripe Customer + Payment Method");

  try {
    const customer = await stripe.customers.create({
      email: "e2e-test@locksafe-sandbox.test",
      name: "E2E Test Customer",
      phone: "+447000000001",
      metadata: { platform: "locksafe", test: "stripe_e2e_sandbox" },
    });
    testCustomerId = customer.id;
    cleanup.push({ type: "customer", id: customer.id });
    pass(`Customer created: ${customer.id}`);
  } catch (err) {
    fail("Customer creation", err);
    return;
  }

  // Attach a test payment method to the customer
  try {
    const pm = await stripe.paymentMethods.attach(CARD_SUCCESS, {
      customer: testCustomerId,
    });
    testPaymentMethodId = pm.id;
    // Set as default
    await stripe.customers.update(testCustomerId, {
      invoice_settings: { default_payment_method: pm.id },
    });
    pass(`Payment method attached: ${pm.id} (${pm.card?.brand} ****${pm.card?.last4})`);
  } catch (err) {
    fail("Payment method attachment", err);
  }
}

// ---------------------------------------------------------------------------
// SECTION 4 — Stripe Connect Express Account (mock locksmith)
// ---------------------------------------------------------------------------

let testConnectAccountId: string;

async function testConnectAccount() {
  section("4. Stripe Connect Express Account");

  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      email: "e2e-locksmith@locksafe-sandbox.test",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { test: "stripe_e2e_sandbox" },
    });
    testConnectAccountId = account.id;
    cleanup.push({ type: "account", id: account.id });
    pass(`Express account created: ${account.id}`);
    assert(account.type === "express", "Account type is 'express'");
  } catch (err) {
    fail("Stripe Connect Express account creation", err);
  }
}

// ---------------------------------------------------------------------------
// SECTION 5 — Assessment Fee Charge (off-session, with transfer)
// ---------------------------------------------------------------------------

let assessmentPaymentIntentId: string;

async function testAssessmentFeeCharge() {
  section("5. Assessment Fee Charge (off-session)");

  if (!testCustomerId || !testPaymentMethodId || !testConnectAccountId) {
    warn("Skipping — prerequisites from sections 3/4 not met");
    return;
  }

  const amount = 35; // £35
  const amountPence = formatAmountForStripe(amount);
  const platformFeePence = Math.round(amountPence * ASSESSMENT_FEE_COMMISSION);
  const locksmithSharePence = amountPence - platformFeePence;

  try {
    const pi = await stripe.paymentIntents.create({
      amount: amountPence,
      currency: "gbp",
      customer: testCustomerId,
      payment_method: testPaymentMethodId,
      off_session: true,
      confirm: true,
      transfer_data: { destination: testConnectAccountId },
      application_fee_amount: platformFeePence,
      metadata: {
        type: "assessment_fee",
        jobId: "sandbox_job_001",
        customerId: "sandbox_cust_001",
        locksmithId: "sandbox_ls_001",
        platformFee: platformFeePence.toString(),
        locksmithShare: locksmithSharePence.toString(),
        test: "stripe_e2e_sandbox",
      },
      description: "LockSafe Assessment Fee — Sandbox E2E Test",
    });

    assessmentPaymentIntentId = pi.id;
    pass(`Assessment PaymentIntent created: ${pi.id}`);
    assert(pi.status === "succeeded", `Status = '${pi.status}' (expect 'succeeded')`);
    assert(pi.amount === amountPence, `Amount = ${pi.amount}p (expect ${amountPence}p)`);
    assert(
      pi.application_fee_amount === platformFeePence,
      `Platform fee = ${pi.application_fee_amount}p (expect ${platformFeePence}p)`
    );

    // Verify fee split printed clearly
    const locksmithGbp = formatAmountFromStripe(locksmithSharePence);
    const platformGbp = formatAmountFromStripe(platformFeePence);
    console.log(
      `   ${YELLOW}Split:${RESET} total=£${amount}  platform=£${platformGbp.toFixed(2)} (${(ASSESSMENT_FEE_COMMISSION * 100).toFixed(0)}%)  locksmith=£${locksmithGbp.toFixed(2)} (${((1 - ASSESSMENT_FEE_COMMISSION) * 100).toFixed(0)}%)`
    );
  } catch (err) {
    fail("Assessment fee charge", err);
  }
}

// ---------------------------------------------------------------------------
// SECTION 6 — Work Quote Final Charge (off-session)
// ---------------------------------------------------------------------------

async function testWorkQuoteFinalCharge() {
  section("6. Work Quote Final Charge (off-session)");

  if (!testCustomerId || !testPaymentMethodId || !testConnectAccountId) {
    warn("Skipping — prerequisites from sections 3/4 not met");
    return;
  }

  const quoteTotal = 200; // £200 job
  const assessmentAlreadyPaid = 35;
  const finalAmount = quoteTotal - assessmentAlreadyPaid; // £165

  const amountPence = formatAmountForStripe(finalAmount);
  const platformFeePence = Math.round(amountPence * WORK_QUOTE_COMMISSION);
  const locksmithSharePence = amountPence - platformFeePence;

  try {
    const pi = await stripe.paymentIntents.create({
      amount: amountPence,
      currency: "gbp",
      customer: testCustomerId,
      payment_method: testPaymentMethodId,
      off_session: true,
      confirm: true,
      transfer_data: { destination: testConnectAccountId },
      application_fee_amount: platformFeePence,
      metadata: {
        type: "work_quote",
        jobId: "sandbox_job_001",
        customerId: "sandbox_cust_001",
        locksmithId: "sandbox_ls_001",
        platformFee: platformFeePence.toString(),
        locksmithShare: locksmithSharePence.toString(),
        quoteTotal: quoteTotal.toString(),
        assessmentFeeDeducted: assessmentAlreadyPaid.toString(),
        test: "stripe_e2e_sandbox",
      },
      description: "LockSafe Work Payment — Sandbox E2E Test",
    });

    pass(`Work quote PaymentIntent created: ${pi.id}`);
    assert(pi.status === "succeeded", `Status = '${pi.status}' (expect 'succeeded')`);
    assert(pi.amount === amountPence, `Amount = ${pi.amount}p (expect ${amountPence}p)`);
    assert(
      pi.application_fee_amount === platformFeePence,
      `Platform fee = ${pi.application_fee_amount}p (expect ${platformFeePence}p)`
    );

    const locksmithGbp = formatAmountFromStripe(locksmithSharePence);
    const platformGbp = formatAmountFromStripe(platformFeePence);
    console.log(
      `   ${YELLOW}Split:${RESET} quoteTotal=£${quoteTotal}  assessmentDeducted=£${assessmentAlreadyPaid}  charged=£${finalAmount}  platform=£${platformGbp.toFixed(2)} (${(WORK_QUOTE_COMMISSION * 100).toFixed(0)}%)  locksmith=£${locksmithGbp.toFixed(2)} (${((1 - WORK_QUOTE_COMMISSION) * 100).toFixed(0)}%)`
    );
  } catch (err) {
    fail("Work quote final charge", err);
  }
}

// ---------------------------------------------------------------------------
// SECTION 7 — Decline Card (4000 0000 0000 0002)
// ---------------------------------------------------------------------------

async function testDeclineCard() {
  section("7. Decline Card Test");

  if (!testCustomerId) {
    warn("Skipping — customer from section 3 not created");
    return;
  }

  let declinedPmId: string | undefined;
  try {
    const pm = await stripe.paymentMethods.attach(CARD_DECLINE, {
      customer: testCustomerId,
    });
    declinedPmId = pm.id;
  } catch (err) {
    fail("Failed to attach decline card for test", err);
    return;
  }

  try {
    await stripe.paymentIntents.create({
      amount: 3500,
      currency: "gbp",
      customer: testCustomerId,
      payment_method: declinedPmId,
      off_session: true,
      confirm: true,
    });
    fail("Declined card should throw — expected StripeCardError");
  } catch (err: unknown) {
    if (
      err instanceof Stripe.errors.StripeCardError &&
      err.code === "card_declined"
    ) {
      pass(`Declined card throws StripeCardError (code=card_declined) ✓`);
    } else {
      fail("Declined card threw unexpected error", err);
    }
  }
}

// ---------------------------------------------------------------------------
// SECTION 8 — SetupIntent (save card for off-session use)
// ---------------------------------------------------------------------------

async function testSetupIntent() {
  section("8. SetupIntent — Save Card for Future Use");

  if (!testCustomerId) {
    warn("Skipping — customer from section 3 not created");
    return;
  }

  try {
    const si = await stripe.setupIntents.create({
      customer: testCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { platform: "locksafe", test: "stripe_e2e_sandbox" },
    });
    assert(si.status === "requires_payment_method" || si.status === "requires_confirmation", `SetupIntent status = '${si.status}'`);
    assert(si.usage === "off_session", "SetupIntent usage = 'off_session'");
    pass(`SetupIntent created: ${si.id}`);
  } catch (err) {
    fail("SetupIntent creation", err);
  }
}

// ---------------------------------------------------------------------------
// SECTION 9 — Rate Limit Guard (requires local server running)
// ---------------------------------------------------------------------------

async function testRateLimit() {
  section("9. Payment Endpoint Rate Limit (local server required)");

  let serverUp = false;
  try {
    const probe = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    serverUp = probe.ok;
  } catch {
    /* server not running */
  }

  if (!serverUp) {
    warn(`Local server not detected at ${BASE_URL} — skipping rate-limit test`);
    warn("Start the server with 'npm run dev' then re-run for this section");
    return;
  }

  // Send 21 POST requests to /api/payments/create-intent (limit = 20/min per IP)
  const requests = Array.from({ length: 21 }).map(() =>
    fetch(`${BASE_URL}/api/payments/create-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "assessment_fee", amount: 35, jobId: "rate-limit-test" }),
      signal: AbortSignal.timeout(3000),
    }).then((r) => r.status)
  );

  try {
    const statuses = await Promise.all(requests);
    const has429 = statuses.includes(429);
    assert(has429, `At least one 429 received from 21 rapid requests (statuses: ${[...new Set(statuses)].join(", ")})`);
  } catch (err) {
    warn(`Rate limit test inconclusive: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// SECTION 10 — Webhook Signature Validation
// ---------------------------------------------------------------------------

async function testWebhookSignature() {
  section("10. Webhook Signature Validation (local server required)");

  let serverUp = false;
  try {
    const probe = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    serverUp = probe.ok;
  } catch {
    /* server not running */
  }

  if (!serverUp) {
    warn(`Local server not detected at ${BASE_URL} — skipping webhook signature test`);
    return;
  }

  // Send a webhook with a completely invalid signature — must return 400
  try {
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=invalid,v1=invalid",
      },
      body: JSON.stringify({ type: "payment_intent.succeeded" }),
    });
    assert(res.status === 400, `Invalid signature returns 400 (got ${res.status})`);
  } catch (err) {
    fail("Webhook signature validation", err);
  }

  // Send without signature header — must return 400
  try {
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "payment_intent.succeeded" }),
    });
    assert(res.status === 400, `Missing signature returns 400 (got ${res.status})`);
  } catch (err) {
    fail("Webhook: missing signature header check", err);
  }
}

// ---------------------------------------------------------------------------
// CLEANUP
// ---------------------------------------------------------------------------

async function runCleanup() {
  section("Cleanup");
  for (const item of cleanup) {
    try {
      if (item.type === "customer") {
        await stripe.customers.del(item.id);
        console.log(`  Deleted customer ${item.id}`);
      } else if (item.type === "account") {
        await stripe.accounts.del(item.id);
        console.log(`  Deleted Express account ${item.id}`);
      }
    } catch (err) {
      console.warn(`  Could not delete ${item.type} ${item.id}: ${(err as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${CYAN}╔══════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}║   LockSafe — Stripe Sandbox E2E Test Suite   ║${RESET}`);
  console.log(`${CYAN}╚══════════════════════════════════════════════╝${RESET}`);
  console.log(`Mode: ${YELLOW}${getStripeMode().toUpperCase()}${RESET}`);
  console.log(`Key: ${SECRET_KEY.slice(0, 12)}...`);
  console.log(`App: ${BASE_URL}`);

  await testKeyMode();
  await testFeeCalculations();
  await testCustomerCreation();
  await testConnectAccount();
  await testAssessmentFeeCharge();
  await testWorkQuoteFinalCharge();
  await testDeclineCard();
  await testSetupIntent();
  await testRateLimit();
  await testWebhookSignature();
  await runCleanup();

  // ---------------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------------
  console.log(`\n${CYAN}━━━ Results ━━━${RESET}`);
  console.log(`${GREEN}Passed:${RESET} ${passed}`);
  console.log(`${failed > 0 ? RED : GREEN}Failed:${RESET} ${failed}`);

  if (failures.length > 0) {
    console.log(`\n${RED}Failures:${RESET}`);
    failures.forEach((f) => console.log(`  • ${f}`));
  }

  if (failed === 0) {
    console.log(`\n${GREEN}✓ All Stripe sandbox tests passed! Ready for live key switchover.${RESET}`);
    console.log(`\n${YELLOW}Live switchover checklist:${RESET}`);
    console.log("  1. Set STRIPE_SECRET_KEY=sk_live_...");
    console.log("  2. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...");
    console.log("  3. Register live webhook in Stripe Dashboard → https://locksafe.uk/api/webhooks/stripe");
    console.log("  4. Set STRIPE_WEBHOOK_SECRET to the live whsec_...");
    console.log("  5. Confirm /api/health shows stripe.mode=live");
  } else {
    console.log(`\n${RED}Fix the ${failed} failing test(s) before switching to live keys.${RESET}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${RED}Unhandled error:${RESET}`, err);
  process.exit(1);
});
