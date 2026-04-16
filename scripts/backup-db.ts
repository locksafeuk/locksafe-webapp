/**
 * Database Backup Script
 * 
 * Creates a JSON backup of all MongoDB collections.
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS","strict":false}' scripts/backup-db.ts
 * 
 * Recommended: Run daily via cron job
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`📦 Starting database backup at ${new Date().toISOString()}`);

  const data: Record<string, any> = {
    _metadata: {
      timestamp: new Date().toISOString(),
      databaseUrl: (process.env.DATABASE_URL || "").replace(/\/\/.*@/, "//***@"), // Redact credentials
    },
    admins: await prisma.admin.findMany(),
    locksmiths: await prisma.locksmith.findMany(),
    customers: await prisma.customer.findMany(),
    jobs: await prisma.job.findMany(),
    quotes: await prisma.quote.findMany(),
    payments: await prisma.payment.findMany(),
    payouts: await prisma.payout.findMany(),
    reviews: await prisma.review.findMany(),
    signatures: await prisma.signature.findMany(),
    photos: await prisma.photo.findMany(),
    serviceAreas: await prisma.serviceArea.findMany(),
    blogPosts: await prisma.blogPost.findMany(),
    faqs: await prisma.fAQ.findMany(),
    analyticsEvents: await prisma.analyticsEvent.findMany(),
    locksmithApplications: await prisma.locksmithApplication.findMany(),
    reports: await prisma.report.findMany(),
    notifications: await prisma.notification.findMany(),
  };

  // Count records
  let totalRecords = 0;
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) continue;
    const count = Array.isArray(value) ? value.length : 0;
    totalRecords += count;
    console.log(`  ${key}: ${count} records`);
  }

  const filePath = path.join(backupDir, `backup-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  const fileSize = (fs.statSync(filePath).size / 1024).toFixed(1);
  console.log(`\n✅ Backup saved to ${filePath}`);
  console.log(`   Total records: ${totalRecords}`);
  console.log(`   File size: ${fileSize} KB`);

  // Keep only last 7 backups
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (backups.length > 7) {
    for (const old of backups.slice(7)) {
      fs.unlinkSync(path.join(backupDir, old));
      console.log(`   🗑️ Removed old backup: ${old}`);
    }
  }

  await prisma.$disconnect();
}

backup().catch((e) => {
  console.error("❌ Backup failed:", e);
  process.exit(1);
});
