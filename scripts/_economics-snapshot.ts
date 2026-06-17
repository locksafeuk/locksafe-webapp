/**
 * _economics-snapshot.ts  — READ ONLY
 *
 * Task 2 of LOCKSAFE_ECONOMICS_PLAN.md: pull the three already-available numbers.
 *   1. Bill split (call-out / assessment vs labour+parts) + implied effective take
 *   2. Demand÷capacity regime (monthly completed jobs ÷ active locksmiths)
 *   3. Realised take from Payout.platformFee (vs the theoretical ~22%)
 *   (+ interim pay-link collection rate, inferred from paymentUrl→succeeded)
 *
 * Performs NO writes. Aggregates only. Safe to run against production.
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/_economics-snapshot.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAYS = 90;
const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const DONE = ["COMPLETED", "SIGNED"] as const;
const gbp = (n: number | null | undefined) =>
  n == null ? "n/a" : "£" + n.toFixed(2);
const pct = (n: number | null | undefined) =>
  n == null ? "n/a" : (n * 100).toFixed(1) + "%";

async function main() {
  const out: Record<string, unknown> = { window_days: DAYS, generated: new Date().toISOString() };

  // ---------- 1. BILL SPLIT ----------
  try {
    const jobAgg = await prisma.job.aggregate({
      where: { status: { in: DONE as unknown as string[] }, createdAt: { gte: since } },
      _count: { _all: true, assessmentFee: true },
      _avg: { assessmentFee: true },
      _sum: { assessmentFee: true },
    });
    // Quotes within window (proxy for finished work value). Caveat: keyed by quote
    // createdAt, not strictly the completed-job set, but close for split intuition.
    const quoteAgg = await prisma.quote.aggregate({
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _avg: { labourCost: true, partsTotal: true, subtotal: true, total: true },
    });

    const avgAssess = jobAgg._avg.assessmentFee ?? 0;
    const avgLabour = quoteAgg._avg.labourCost ?? 0;
    const avgParts = quoteAgg._avg.partsTotal ?? 0;
    const avgWork = avgLabour + avgParts;
    const avgBill = avgAssess + avgWork;
    // Theoretical take using DEFAULT split (0.15 call-out, 0.25 work)
    const theoTake = 0.15 * avgAssess + 0.25 * avgWork;
    const theoTakePctOfBill = avgBill > 0 ? theoTake / avgBill : null;

    out.bill_split = {
      completed_jobs_in_window: jobAgg._count._all,
      jobs_with_assessment_fee: jobAgg._count.assessmentFee,
      avg_assessment_fee: avgAssess,
      quotes_in_window: quoteAgg._count._all,
      avg_labour: avgLabour,
      avg_parts: avgParts,
      avg_work_value: avgWork,
      avg_total_bill_modelled: avgBill,
      theoretical_take_per_job: theoTake,
      theoretical_take_pct_of_bill: theoTakePctOfBill,
    };
  } catch (e) {
    out.bill_split = { error: String(e) };
  }

  // ---------- 2. DEMAND ÷ CAPACITY ----------
  try {
    const completed30 = await prisma.job.count({
      where: { status: { in: DONE as unknown as string[] }, createdAt: { gte: since30 } },
    });
    const completed90 = await prisma.job.count({
      where: { status: { in: DONE as unknown as string[] }, createdAt: { gte: since } },
    });
    const activeLocksmiths = await prisma.locksmith.count({
      where: { isActive: true, onboardingCompleted: true },
    });
    const availableLocksmiths = await prisma.locksmith.count({
      where: { isActive: true, onboardingCompleted: true, isAvailable: true },
    });
    out.demand_capacity = {
      completed_jobs_last_30d: completed30,
      completed_jobs_last_90d: completed90,
      active_onboarded_locksmiths: activeLocksmiths,
      of_which_available: availableLocksmiths,
      jobs_per_active_locksmith_per_month:
        activeLocksmiths > 0 ? completed30 / activeLocksmiths : null,
      regime_hint:
        activeLocksmiths > 0
          ? completed30 / activeLocksmiths < 4
            ? "DEMAND-BOUND (idle capacity) → t* can push toward ~40%"
            : "SUPPLY-BOUND (locksmiths scarce) → t* falls back toward ~25%"
          : "no active locksmiths",
    };
  } catch (e) {
    out.demand_capacity = { error: String(e) };
  }

  // ---------- 3. REALISED TAKE ----------
  try {
    const payAgg = await prisma.payout.aggregate({
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { amount: true, platformFee: true, netAmount: true },
      _avg: { amount: true, platformFee: true },
    });
    const sumAmount = payAgg._sum.amount ?? 0;
    const sumFee = payAgg._sum.platformFee ?? 0;
    out.realised_take = {
      payouts_in_window: payAgg._count._all,
      sum_gross: sumAmount,
      sum_platform_fee: sumFee,
      avg_take_per_payout: payAgg._avg.platformFee ?? null,
      realised_take_pct: sumAmount > 0 ? sumFee / sumAmount : null,
    };
  } catch (e) {
    out.realised_take = { error: String(e) };
  }

  // ---------- BONUS: interim collection rate ----------
  try {
    const linkTypes = ["assessment", "callout"];
    const sentish = await prisma.payment.count({
      where: { createdAt: { gte: since }, type: { in: linkTypes }, paymentUrl: { not: null } },
    });
    const paid = await prisma.payment.count({
      where: {
        createdAt: { gte: since },
        type: { in: linkTypes },
        paymentUrl: { not: null },
        status: "succeeded",
      },
    });
    out.collection_rate_interim = {
      note: "inferred from paymentUrl NOT NULL → succeeded; replace once paymentLinkSentAt lands (Task 3)",
      links_with_url: sentish,
      paid: paid,
      interim_collection_pct: sentish > 0 ? paid / sentish : null,
    };
  } catch (e) {
    out.collection_rate_interim = { error: String(e) };
  }

  // ---------- PRINT ----------
  console.log("\n===== LOCKSAFE ECONOMICS SNAPSHOT (read-only) =====");
  console.log(JSON.stringify(out, null, 2));

  const bs: any = out.bill_split, dc: any = out.demand_capacity, rt: any = out.realised_take, cr: any = out.collection_rate_interim;
  console.log("\n----- HUMAN SUMMARY -----");
  if (bs && !bs.error) {
    console.log(`Bill: avg call-out ${gbp(bs.avg_assessment_fee)} + avg work ${gbp(bs.avg_work_value)} = ${gbp(bs.avg_total_bill_modelled)} bill`);
    console.log(`Theoretical take/job (15/25 split): ${gbp(bs.theoretical_take_per_job)}  (${pct(bs.theoretical_take_pct_of_bill)} of bill)  [brief assumed ~£38 / ~22%]`);
    console.log(`  (n=${bs.completed_jobs_in_window} completed jobs, ${bs.quotes_in_window} quotes in ${DAYS}d)`);
  }
  if (dc && !dc.error) {
    console.log(`Demand÷capacity: ${dc.completed_jobs_last_30d} jobs/30d ÷ ${dc.active_onboarded_locksmiths} active = ${dc.jobs_per_active_locksmith_per_month?.toFixed?.(2)} jobs/locksmith/mo`);
    console.log(`  → ${dc.regime_hint}`);
  }
  if (rt && !rt.error) {
    console.log(`Realised take: ${pct(rt.realised_take_pct)} (avg ${gbp(rt.avg_take_per_payout)}/payout, n=${rt.payouts_in_window})  [vs theoretical ~22%]`);
  }
  if (cr && !cr.error) {
    console.log(`Collection rate (interim): ${pct(cr.interim_collection_pct)} (${cr.paid}/${cr.links_with_url})  [brief guessed 85%]`);
  }
  console.log("=================================================\n");
}

main()
  .catch((e) => { console.error("SNAPSHOT FAILED:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
