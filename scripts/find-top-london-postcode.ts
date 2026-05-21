/**
 * Find which London postcode area has the most active, available
 * LockSafe locksmiths covering it. Used to pick a high-supply
 * target for a small Google Ads test campaign.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/find-top-london-postcode.ts
 */
import { PrismaClient } from "@prisma/client";
import { postcodeData } from "../src/lib/postcode-data";

const prisma = new PrismaClient();

// London outward postcode areas we have landing pages for
const LONDON_AREAS = ["e", "ec", "n", "nw", "se", "sw", "w", "wc"] as const;

function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8; // miles
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function main() {
  const locksmiths = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      baseLat: { not: null },
      baseLng: { not: null },
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      baseLat: true,
      baseLng: true,
      coverageRadius: true,
      isVerified: true,
      defaultAssessmentFee: true,
      rating: true,
      totalJobs: true,
    },
  });

  console.log(`Loaded ${locksmiths.length} active locksmiths with geo.\n`);

  type Row = {
    key: string;
    postcode: string;
    slug: string;
    area: string;
    totalCovering: number;
    verifiedCovering: number;
    autoDispatchReady: number;
    landingUrl: string;
  };

  const rows: Row[] = [];

  for (const key of LONDON_AREAS) {
    const pc = postcodeData[key];
    if (!pc) continue;
    const center = pc.coordinates;

    let total = 0;
    let verified = 0;
    let autoReady = 0;

    for (const ls of locksmiths) {
      const d = haversineMiles(center, {
        lat: ls.baseLat as number,
        lng: ls.baseLng as number,
      });
      const radius = ls.coverageRadius ?? 10;
      if (d <= radius) {
        total++;
        if (ls.isVerified) verified++;
        if (ls.isVerified && (ls.defaultAssessmentFee ?? 0) > 0) autoReady++;
      }
    }

    rows.push({
      key,
      postcode: pc.postcode,
      slug: pc.slug,
      area: pc.area,
      totalCovering: total,
      verifiedCovering: verified,
      autoDispatchReady: autoReady,
      landingUrl: `https://locksafe.uk/locksmith-area/${pc.slug}`,
    });
  }

  rows.sort((a, b) =>
    b.autoDispatchReady - a.autoDispatchReady ||
    b.verifiedCovering - a.verifiedCovering ||
    b.totalCovering - a.totalCovering,
  );

  console.log("Ranked London postcode areas by locksmith supply:\n");
  console.table(
    rows.map((r) => ({
      Postcode: r.postcode,
      Area: r.area,
      "Total covering": r.totalCovering,
      Verified: r.verifiedCovering,
      "Auto-dispatch ready": r.autoDispatchReady,
      "Landing URL": r.landingUrl,
    })),
  );

  const top = rows[0];
  if (top) {
    console.log("\n=== RECOMMENDED TEST CAMPAIGN TARGET ===");
    console.log(`Postcode area:       ${top.postcode}  (${top.area})`);
    console.log(`Total locksmiths:    ${top.totalCovering}`);
    console.log(`Verified:            ${top.verifiedCovering}`);
    console.log(`Auto-dispatch ready: ${top.autoDispatchReady}`);
    console.log(`Landing page:        ${top.landingUrl}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
