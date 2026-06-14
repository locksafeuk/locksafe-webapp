/**
 * Clear social posts — DB cleanup for a fresh start.
 *
 * The SocialPost collection ballooned to ~13.5k rows (mostly FAILED + orphaned
 * with no pillar) from a runaway generator. This wipes the junk so the (now
 * fixed) pipeline can start clean.
 *
 * SAFE BY DEFAULT — dry run unless you pass --execute.
 *
 *   cd ~/Locksafe\ Project/locksafe-webapp
 *   npx tsx scripts/clear-social-posts.ts                 # DRY RUN: show counts, delete nothing
 *   npx tsx scripts/clear-social-posts.ts --execute       # delete everything EXCEPT already-PUBLISHED
 *   npx tsx scripts/clear-social-posts.ts --execute --all # delete EVERYTHING incl PUBLISHED history
 *   npx tsx scripts/clear-social-posts.ts --execute --failed-only  # delete only FAILED rows
 *
 * IMPORTANT: pause the generators first (admin → Organic → Autopilot OFF, and
 * stop/limit the CMO social agent) or it will just refill.
 */

import { prisma } from "@/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const all = args.includes("--all");
  const failedOnly = args.includes("--failed-only");

  const byStatus = await prisma.socialPost.groupBy({ by: ["status"], _count: { id: true } });
  const total = await prisma.socialPost.count();
  console.log("📊 Current SocialPost counts:");
  for (const s of byStatus.sort((a, b) => b._count.id - a._count.id)) {
    console.log(`   ${String(s.status).padEnd(18)} ${s._count.id}`);
  }
  console.log(`   ${"TOTAL".padEnd(18)} ${total}`);

  // Scope of deletion.
  let where: Record<string, unknown>;
  let label: string;
  if (failedOnly) {
    where = { status: "FAILED" };
    label = "FAILED only";
  } else if (all) {
    where = {};
    label = "EVERYTHING (including PUBLISHED history)";
  } else {
    where = { status: { not: "PUBLISHED" } };
    label = "everything EXCEPT already-PUBLISHED";
  }

  const toDelete = await prisma.socialPost.count({ where });
  console.log(`\n🗑️  Scope: ${label}`);
  console.log(`    Would delete: ${toDelete} of ${total} posts.`);

  if (!execute) {
    console.log("\n🔒 DRY RUN — nothing deleted. Re-run with --execute to delete for real.");
    return;
  }

  console.log("\n⏳ Deleting…");
  const res = await prisma.socialPost.deleteMany({ where });
  const remaining = await prisma.socialPost.count();
  console.log(`✅ Deleted ${res.count} posts. Remaining: ${remaining}.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
