/**
 * Remediate REMOVED-drift cases surfaced by reconcile-campaign-drift.ts.
 *
 * Specifically: GoogleAdsCampaignDraft rows where Locksafe still records
 * status="PUBLISHED" but Google Ads has REMOVED the underlying campaign
 * entirely. These are data-drift errors that should be corrected on the
 * Locksafe side so the row no longer appears as "live" in the admin UI
 * or in any reporting (incl. the daily morning briefing).
 *
 * What this script changes:
 *   status → "PAUSED"   (was: "PUBLISHED")
 *   pausedAt → now
 *   adminNotes → appended with a structured drift-remediation note
 *
 * What this script does NOT touch:
 *   • DORMANT drifts (campaign Enabled, downstream paused) — those are
 *     operational state, not data drift. Operator decides whether to
 *     unpause or accept the pause.
 *   • UNKNOWN drifts — investigate manually; the campaign ID may be
 *     malformed or the campaign was never created.
 *   • Google Ads itself — read-only.
 *
 * Usage (DEFAULT IS DRY-RUN — must explicitly pass --apply to mutate):
 *   ./remediate-removed-drift.command            # preview only
 *   ./remediate-removed-drift.command --apply    # actually update DB
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths:   { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
import { getDefaultGoogleAdsClient } from "../src/lib/google-ads";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log("");
  console.log(`▶ Remediating REMOVED-drift cases  (${APPLY ? "APPLY" : "DRY-RUN"})`);
  console.log("");

  const drafts: Array<{
    id:               string;
    name:             string;
    status:           string;
    googleCampaignId: string | null;
    adminNotes:       string | null;
  }> = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      googleCampaignId: { not: null },
      status:           "PUBLISHED",
    },
    select: {
      id: true, name: true, status: true,
      googleCampaignId: true, adminNotes: true,
    },
  });

  if (drafts.length === 0) {
    console.log("  (no PUBLISHED drafts to check)");
    return;
  }

  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    console.error("  ✗ No active GoogleAdsAccount in the DB.");
    process.exit(1);
  }
  const { client } = ctx;

  const ids: string[] = [];
  for (const d of drafts) {
    if (d.googleCampaignId && /^[0-9]+$/.test(d.googleCampaignId)) {
      ids.push(d.googleCampaignId);
    }
  }
  if (ids.length === 0) {
    console.error("  ✗ No valid campaign IDs to check.");
    process.exit(1);
  }

  const liveRows = await client.query<{
    campaign: { id: string; status: string };
  }>(`
    SELECT campaign.id, campaign.status
    FROM campaign
    WHERE campaign.id IN (${ids.join(",")})
  `);
  const liveStatusById = new Map<string, string>();
  for (const r of liveRows) liveStatusById.set(r.campaign.id, r.campaign.status);

  // Sanity: if GAQL returned zero rows for a non-empty input, the API
  // is likely degraded (auth issue, partial 429 response, etc.). Don't
  // infer drift from no-data — abort instead.
  if (liveRows.length === 0) {
    console.error("  ✗ GAQL returned zero campaign rows for a non-empty ID list — likely API failure. Aborting.");
    process.exit(1);
  }

  // ── Find rows where Locksafe says PUBLISHED but Google says
  // REMOVED — OR Google didn't return the campaign at all.
  //
  // Google purges removed campaigns from `FROM campaign` queries
  // entirely after ~24-72h, at which point status="REMOVED" is no
  // longer returned and the ID simply disappears. We treat both
  // "explicitly REMOVED" and "missing from response" as the same
  // drift case, because the operational outcome is identical: the
  // campaign doesn't exist on Google Ads but Locksafe thinks it does.
  const toFix: typeof drafts = [];
  for (const d of drafts) {
    const live = liveStatusById.get(d.googleCampaignId!);
    const isRemoved = live === "REMOVED";
    const isPurged  = live === undefined;
    if (isRemoved || isPurged) toFix.push(d);
  }

  if (toFix.length === 0) {
    console.log("  ✓ No REMOVED-drift cases found. Locksafe is in sync.");
    return;
  }

  console.log(`  Found ${toFix.length} REMOVED-drift case${toFix.length === 1 ? "" : "s"}:`);
  console.log("");

  const now = new Date();
  const noteStamp = now.toISOString().slice(0, 10);
  for (const d of toFix) {
    const live = liveStatusById.get(d.googleCampaignId!);
    const reasonShape = live === "REMOVED"
      ? `Google Ads has REMOVED this campaign`
      : `Google Ads has purged this campaign (no longer surfaces in GAQL — likely fully removed)`;
    const note = `[${noteStamp}] auto-remediation: ${reasonShape} (ID ${d.googleCampaignId}); flipped Locksafe status from PUBLISHED to PAUSED to reflect reality.`;
    const newAdminNotes = d.adminNotes
      ? `${d.adminNotes}\n${note}`
      : note;

    console.log(`  • ${d.name}  (campaign ${d.googleCampaignId})`);
    console.log(`      PUBLISHED → PAUSED`);
    console.log(`      note: ${note}`);

    if (APPLY) {
      await prisma.googleAdsCampaignDraft.update({
        where: { id: d.id },
        data: {
          status:     "PAUSED",
          pausedAt:   now,
          adminNotes: newAdminNotes,
        },
      });
      console.log(`      ✓ updated`);
    }
    console.log("");
  }

  console.log("──────────────────────────────────────────────────────────────");
  if (APPLY) {
    console.log(`✓ Updated ${toFix.length} row${toFix.length === 1 ? "" : "s"}.`);
  } else {
    console.log(`Dry-run only. Re-run with --apply to commit these changes.`);
    console.log(`  ./remediate-removed-drift.command --apply`);
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("✗ Failed:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect?.();
  });
