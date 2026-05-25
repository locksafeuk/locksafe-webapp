/**
 * Normalize locksmith location data to postcode format.
 *
 * Usage:
 *   npx tsx --env-file=.env --tsconfig tsconfig.scripts.json scripts/normalize-locksmith-postcodes.ts
 *   npx tsx --env-file=.env --tsconfig tsconfig.scripts.json scripts/normalize-locksmith-postcodes.ts --apply
 */

import { PrismaClient } from "@prisma/client";
import { extractUkPostcode, normalizeUkPostcode, reverseGeocodePostcodeFromCoords } from "../src/lib/location-display";

const prisma = new PrismaClient();

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function toNormalizedCoverageAreas(values: string[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const postcode = normalizeUkPostcode(value) ?? extractUkPostcode(value);
    if (postcode) seen.add(postcode);
  }
  return Array.from(seen);
}

async function derivePostcode(locksmith: {
  baseAddress: string | null;
  baseLat: number | null;
  baseLng: number | null;
  coverageAreas: string[];
}): Promise<string | null> {
  const fromAddress = normalizeUkPostcode(locksmith.baseAddress) ?? extractUkPostcode(locksmith.baseAddress);
  if (fromAddress) return fromAddress;

  const fromCoverage = locksmith.coverageAreas
    .map((v) => normalizeUkPostcode(v) ?? extractUkPostcode(v))
    .find((v): v is string => Boolean(v));
  if (fromCoverage) return fromCoverage;

  if (typeof locksmith.baseLat === "number" && typeof locksmith.baseLng === "number") {
    return await reverseGeocodePostcodeFromCoords(locksmith.baseLat, locksmith.baseLng);
  }

  return null;
}

async function main() {
  const apply = hasFlag("--apply");

  const locksmiths = await prisma.locksmith.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      baseAddress: true,
      baseLat: true,
      baseLng: true,
      coverageAreas: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let alreadyNormalized = 0;
  let updatesNeeded = 0;
  let updated = 0;
  let unresolved = 0;
  let coverageChanged = 0;

  for (const locksmith of locksmiths) {
    const normalizedCoverageAreas = toNormalizedCoverageAreas(locksmith.coverageAreas ?? []);
    const nextPostcode = await derivePostcode(locksmith);
    const currentPostcode = normalizeUkPostcode(locksmith.baseAddress) ?? extractUkPostcode(locksmith.baseAddress);

    const baseAddressChanged = (currentPostcode ?? null) !== (nextPostcode ?? null);
    const coverageAreasChanged = JSON.stringify(locksmith.coverageAreas ?? []) !== JSON.stringify(normalizedCoverageAreas);

    if (!baseAddressChanged && !coverageAreasChanged) {
      alreadyNormalized++;
      continue;
    }

    updatesNeeded++;
    if (coverageAreasChanged) coverageChanged++;
    if (!nextPostcode) unresolved++;

    if (!apply) continue;

    await prisma.locksmith.update({
      where: { id: locksmith.id },
      data: {
        baseAddress: nextPostcode,
        coverageAreas: normalizedCoverageAreas,
      },
    });

    updated++;
    console.log(
      `[updated] ${locksmith.name} <${locksmith.email}> baseAddress=${nextPostcode ?? "null"} coverageAreas=${normalizedCoverageAreas.length}`,
    );
  }

  console.log("\n=== Locksmith Postcode Normalization ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Total locksmiths: ${locksmiths.length}`);
  console.log(`Already normalized: ${alreadyNormalized}`);
  console.log(`Updates needed: ${updatesNeeded}`);
  console.log(`Coverage areas changed: ${coverageChanged}`);
  console.log(`Unresolved postcode records: ${unresolved}`);
  if (apply) {
    console.log(`Updated records: ${updated}`);
  } else {
    console.log("No writes performed. Re-run with --apply to persist changes.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
