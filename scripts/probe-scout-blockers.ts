/**
 * Probe why Opportunity Scout's autoDraft path returned 0 with no
 * failures. Runs each gate manually and prints the verdict.
 */

import { PrismaClient } from "@prisma/client";
import { shouldCreateAutonomousDraft } from "../src/lib/google-ads-draft-throttle";

const prisma = new PrismaClient();

async function main() {
  // 1. Run the throttle directly.
  const throttle = await shouldCreateAutonomousDraft({ agentName: "opportunity-scout" });
  console.log("THROTTLE:", JSON.stringify(throttle, null, 2));

  // 2. For each candidate city the Scout returned, check the existing-draft + locksmith gates.
  //    eligible city list from the preflight coverage map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  const acct = await p.googleAdsAccount.findFirst({ where: { isActive: true } });
  if (!acct) { console.log("no active account"); return; }

  const cities = ["Leeds", "Stockport", "Newcastle", "Bradford", "Liverpool"];
  for (const city of cities) {
    console.log(`\n=== ${city} ===`);

    // Find covering locksmiths (within 10mi). Cheap approximation: cityName match in base location.
    const candidates = await p.locksmith.findMany({
      where: {
        isActive: true,
        isVerified: true,
        onboardingCompleted: true,
        stripeConnectVerified: true,
        totalJobs: { gte: 0 },
      },
      select: { id: true, name: true, baseAddress: true, totalJobs: true, rating: true },
    });
    const near = candidates.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => (c.baseAddress ?? "").toLowerCase().includes(city.toLowerCase()),
    );
    console.log(`  candidates matching "${city}" in baseAddress: ${near.length}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of near as any[]) {
      console.log(`    - ${c.name} (jobs=${c.totalJobs}, rating=${c.rating})`);
    }

    // Look for existing PUBLISHED-ish drafts targeting any geo whose name includes city.
    const drafts = await p.googleAdsCampaignDraft.findMany({
      where: {
        accountId: acct.id,
        status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PUBLISHING", "PUBLISHED"] },
      },
      select: { id: true, name: true, status: true, geoTargets: true, pausedAt: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocking = drafts.filter((d: any) =>
      d.name?.toLowerCase().includes(city.toLowerCase()) ||
      d.name?.toLowerCase().includes(city.slice(0, 4).toLowerCase()),
    );
    console.log(`  ${city} blocking drafts: ${blocking.length}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of blocking as any[]) {
      console.log(`    - "${d.name}" status=${d.status} pausedAt=${d.pausedAt?.toISOString() ?? "null"}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
