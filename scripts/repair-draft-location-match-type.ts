/**
 * Repair invalid GoogleAdsCampaignDraft.locationMatchType values.
 *
 * Why:
 * - Legacy defaults/inputs could persist PRESENCE_ONLY, which Google Ads v24
 *   rejects for campaign geoTargetTypeSetting.positiveGeoTargetType.
 *
 * Usage:
 *   # Dry-run (default): show drafts that would be changed
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.scripts.json scripts/repair-draft-location-match-type.ts
 *
 *   # Apply fixes for FAILED drafts only (default scope)
 *   APPLY=1 npx tsx --env-file=.env.local --tsconfig tsconfig.scripts.json scripts/repair-draft-location-match-type.ts
 *
 *   # Apply fixes across all statuses
 *   APPLY=1 ONLY_FAILED=0 npx tsx --env-file=.env.local --tsconfig tsconfig.scripts.json scripts/repair-draft-location-match-type.ts
 */

import prisma from "@/lib/db";
import { normalizeLocationMatchType } from "@/lib/google-ads-location-match-type";

const APPLY = process.env.APPLY === "1";
const ONLY_FAILED = process.env.ONLY_FAILED !== "0";

async function main() {
  const candidates = await prisma.googleAdsCampaignDraft.findMany({
    where: ONLY_FAILED ? { status: "FAILED" } : undefined,
    select: {
      id: true,
      name: true,
      status: true,
      locationMatchType: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const fixes = candidates
    .map((d) => ({
      ...d,
      normalized: normalizeLocationMatchType(d.locationMatchType),
    }))
    .filter((d) => d.locationMatchType !== d.normalized);

  console.log(`Scope: ${ONLY_FAILED ? "FAILED drafts only" : "all drafts"}`);
  console.log(`Candidates scanned: ${candidates.length}`);
  console.log(`Drafts requiring fix: ${fixes.length}`);

  if (fixes.length === 0) {
    console.log("No invalid locationMatchType values found.");
    return;
  }

  console.log("\nPlanned updates:");
  for (const d of fixes.slice(0, 50)) {
    console.log(`- ${d.id} | ${d.status} | ${d.name}`);
    console.log(`  ${d.locationMatchType} -> ${d.normalized}`);
  }
  if (fixes.length > 50) {
    console.log(`...and ${fixes.length - 50} more`);
  }

  if (!APPLY) {
    console.log("\nDry-run only. Set APPLY=1 to write changes.");
    return;
  }

  let updated = 0;
  for (const d of fixes) {
    await prisma.googleAdsCampaignDraft.update({
      where: { id: d.id },
      data: { locationMatchType: d.normalized },
    });
    updated += 1;
  }

  console.log(`\nUpdated ${updated} draft(s).`);
}

main()
  .catch((err) => {
    console.error("Repair failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
