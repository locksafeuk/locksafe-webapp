/**
 * One-time cleanup: remove all SCHEDULED/DRAFT/PENDING_APPROVAL social posts
 * that are NOT published, so we can start fresh with proper multi-platform posts.
 *
 * Run: npx ts-node -P tsconfig.scripts.json scripts/cleanup-social-queue.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Count what we're about to delete
  const counts = await prisma.socialPost.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  console.log("Current post counts by status:");
  for (const c of counts) {
    console.log(`  ${c.status}: ${c._count.id}`);
  }

  // Delete everything that hasn't been published
  const result = await prisma.socialPost.deleteMany({
    where: {
      status: { in: ["SCHEDULED", "DRAFT", "PENDING_APPROVAL", "FAILED"] },
    },
  });

  console.log(`\n✅ Deleted ${result.count} stale posts`);

  // Final count
  const remaining = await prisma.socialPost.count();
  console.log(`   Remaining posts (published only): ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
