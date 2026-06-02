/**
 * Cleanup unused Google Ads drafts.
 *
 * Defaults to DRY RUN. Pass --apply to actually delete.
 *
 * Deletes only non-live workflow statuses:
 *   DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | FAILED
 *
 * It intentionally keeps:
 *   PUBLISHING | PUBLISHED | PAUSED
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const APPLY = process.argv.includes("--apply");

const UNUSED_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "FAILED",
] as const;

async function main() {
  console.log("");
  console.log(`▶ Google Ads draft cleanup — ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`  Status filter: ${UNUSED_STATUSES.join(", ")}`);
  console.log("");

  const rows: Array<{
    id: string;
    name: string;
    status: string;
    googleCampaignId: string | null;
    finalUrl: string;
    createdAt: Date;
  }> = await prisma.googleAdsCampaignDraft.findMany({
    where: { status: { in: [...UNUSED_STATUSES] } },
    select: {
      id: true,
      name: true,
      status: true,
      googleCampaignId: true,
      finalUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (rows.length === 0) {
    console.log("No unused drafts found.");
    return;
  }

  const byStatus = new Map<string, number>();
  for (const row of rows) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
  }

  console.log(`Found ${rows.length} unused draft(s):`);
  for (const [status, count] of byStatus) {
    console.log(`  - ${status}: ${count}`);
  }
  console.log("");

  for (const row of rows.slice(0, 25)) {
    console.log(
      `  ${row.status.padEnd(18)} ${row.name.slice(0, 42).padEnd(42)} ` +
      `campaignId=${row.googleCampaignId ?? "-"} created=${row.createdAt.toISOString()}`,
    );
  }
  if (rows.length > 25) {
    console.log(`  ...and ${rows.length - 25} more`);
  }

  if (!APPLY) {
    console.log("");
    console.log("Dry run only. Re-run with --apply to delete these drafts.");
    return;
  }

  const deleted = await prisma.googleAdsCampaignDraft.deleteMany({
    where: { status: { in: [...UNUSED_STATUSES] } },
  });

  console.log("");
  console.log(`Deleted ${deleted.count} draft(s).`);
}

main()
  .catch((err) => {
    console.error("Cleanup failed:");
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect?.();
  });
