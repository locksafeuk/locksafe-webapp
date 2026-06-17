/** READ ONLY — break (B): for each job, how many active locksmiths were in radius? */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

(async () => {
  const locks = await p.locksmith.findMany({
    where: { isActive: true, onboardingCompleted: true },
    select: { id: true, name: true, baseLat: true, baseLng: true, coverageRadius: true, isAvailable: true, baseAddress: true },
  });
  const withBase = locks.filter((l) => l.baseLat != null && l.baseLng != null);
  console.log("=== SUPPLY ===");
  console.log(`active+onboarded locksmiths: ${locks.length}; with base coords: ${withBase.length}; without coords (cannot be matched by radius): ${locks.length - withBase.length}`);

  // crude geographic clustering by 0.5° lat/lng cell
  const cells: Record<string, number> = {};
  for (const l of withBase) {
    const key = `${Math.round(l.baseLat! * 2) / 2},${Math.round(l.baseLng! * 2) / 2}`;
    cells[key] = (cells[key] ?? 0) + 1;
  }
  console.log("base-location clusters (lat,lng → count):", JSON.stringify(cells));

  const jobs = await p.job.findMany({
    orderBy: { createdAt: "asc" },
    select: { jobNumber: true, postcode: true, latitude: true, longitude: true, status: true, createdVia: true },
  });

  console.log("\n=== PER-JOB IN-RANGE COVERAGE ===");
  let noCoords = 0, zeroInRange = 0, hadRange = 0;
  for (const j of jobs) {
    if (j.latitude == null || j.longitude == null) {
      noCoords++;
      console.log(`${j.jobNumber.padEnd(16)} ${j.postcode?.split(" ")[0].padEnd(7)} NO JOB COORDS`);
      continue;
    }
    const inRange = withBase.filter((l) => {
      const d = haversineMiles(j.latitude!, j.longitude!, l.baseLat!, l.baseLng!);
      return d <= (l.coverageRadius ?? 10);
    });
    const avail = inRange.filter((l) => l.isAvailable);
    if (inRange.length === 0) zeroInRange++; else hadRange++;
    console.log(`${j.jobNumber.padEnd(16)} ${(j.postcode?.split(" ")[0]||"").padEnd(7)} inRange=${inRange.length} (available=${avail.length})  [${j.createdVia}/${j.status}]`);
  }
  console.log(`\nSummary: jobs with 0 locksmiths in range: ${zeroInRange}; with >=1 in range: ${hadRange}; jobs missing coords: ${noCoords}`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
