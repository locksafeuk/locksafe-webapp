/**
 * Force-pause specific Locksafe drafts by name.
 *
 * Companion to remediate-removed-drift.ts for when:
 *   (a) the Google Ads API is quota-exhausted (429 RESOURCE_EXHAUSTED), or
 *   (b) Google has already purged the campaign so GAQL no longer
 *       returns it with status=REMOVED — it simply doesn't appear,
 *       and the auto-fixer can't see it.
 *
 * We hit case (a) and (b) at the same time on 2026-05-26 after the
 * routing-bug post-mortem. This script bypasses Google Ads entirely
 * and flips Locksafe.status from PUBLISHED to PAUSED for the named
 * campaigns, with an audit note explaining why.
 *
 * Idempotent. Dry-run by default. Pass --apply to commit.
 *
 * Usage:
 *   ./force-pause-removed-campaigns.command
 *   ./force-pause-removed-campaigns.command --apply
 *
 * The list of names is hard-coded below (the three campaigns we
 * confirmed REMOVED in Google Ads via the change-history forensic
 * pass on 2026-05-26). To re-use this script for other cases, copy
 * it and replace TARGET_NAMES.
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const APPLY = process.argv.includes("--apply");

// Confirmed REMOVED on Google Ads via Change History audit 2026-05-26.
// Each one was independently verified as gone from the Google Ads UI.
const TARGET_NAMES = [
  "LockSafe | Emergency Locksmith UK | Search",
  "AntiScam",
  "LockSafe Emergency Locksmith UK Cities",
];

async function main() {
  console.log("");
  console.log(`▶ Force-pausing known-removed campaigns  (${APPLY ? "APPLY" : "DRY-RUN"})`);
  console.log("");

  const drafts: Array<{
    id:               string;
    name:             string;
    status:           string;
    googleCampaignId: string | null;
    adminNotes:       string | null;
  }> = await prisma.googleAdsCampaignDraft.findMany({
    where: {
      name:   { in: TARGET_NAMES },
      status: "PUBLISHED",
    },
    select: {
      id: true, name: true, status: true,
      googleCampaignId: true, adminNotes: true,
    },
  });

  if (drafts.length === 0) {
    console.log("  ✓ No matching PUBLISHED rows found — already in sync.");
    return;
  }

  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  for (const d of drafts) {
    const note = `[${stamp}] manual remediation: Google Ads has REMOVED this campaign (verified via Change History audit); flipped Locksafe status from PUBLISHED to PAUSED to reflect reality. Google's GAQL no longer returns it.`;
    const newAdminNotes = d.adminNotes
      ? `${d.adminNotes}\n${note}`
      : note;

    console.log(`  • ${d.name}  (campaign ${d.googleCampaignId ?? "?"})`);
    console.log(`      PUBLISHED → PAUSED`);
    console.log(`      note: ${note.slice(0, 110)}…`);

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
    console.log(`✓ Updated ${drafts.length} row${drafts.length === 1 ? "" : "s"}.`);
  } else {
    console.log(`Dry-run only. Re-run with --apply to commit.`);
    console.log(`  ./force-pause-removed-campaigns.command --apply`);
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
