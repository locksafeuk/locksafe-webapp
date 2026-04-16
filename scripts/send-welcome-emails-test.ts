/**
 * Test Script: Send Welcome Emails to All Locksmiths
 *
 * This script sends welcome emails to all registered locksmiths on the platform.
 * It's useful for testing the email functionality and for sending initial welcome
 * emails to existing locksmiths who registered before this feature was implemented.
 *
 * Usage: bun run scripts/send-welcome-emails-test.ts
 */

import prisma from "../src/lib/db";
import { sendLocksmithWelcomeEmail } from "../src/lib/email";

async function main() {
  console.log("🔍 Fetching all locksmiths from database...\n");

  const locksmiths = await prisma.locksmith.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`📊 Found ${locksmiths.length} locksmiths\n`);

  if (locksmiths.length === 0) {
    console.log("❌ No locksmiths found in the database.");
    process.exit(0);
  }

  console.log("📧 Sending welcome emails...\n");

  const results = await Promise.allSettled(
    locksmiths.map(async (locksmith) => {
      console.log(`  → Sending to: ${locksmith.name} (${locksmith.email})`);
      return sendLocksmithWelcomeEmail(locksmith.email, {
        locksmithName: locksmith.name,
        companyName: locksmith.companyName,
      });
    })
  );

  // Count results
  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log("\n" + "=".repeat(60));
  console.log("📈 RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Locksmiths: ${locksmiths.length}`);
  console.log(`✅ Successfully Sent: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n⚠️  Failed Emails:");
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const locksmith = locksmiths[index];
        console.log(`  - ${locksmith.email}: ${result.reason}`);
      }
    });
  }

  console.log("=".repeat(60) + "\n");

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
