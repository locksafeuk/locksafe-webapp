/**
 * Production Database Seed Script
 * 
 * This script safely seeds/upserts users into the production database
 * WITHOUT deleting existing data. Uses bcrypt for password hashing.
 * 
 * Usage: npx ts-node prisma/seed-production.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

async function main() {
  console.log("🌱 Production seed - upserting users...");

  // =====================================================
  // ADMIN USERS
  // =====================================================
  const adminUsers = [
    {
      email: "admin@locksafe.co.uk",
      password: "demo123",
      name: "Admin User",
      role: "super_admin",
    },
    {
      email: "support@locksafe.co.uk",
      password: "demo123",
      name: "Support Team",
      role: "admin",
    },
  ];

  for (const admin of adminUsers) {
    const existing = await prisma.admin.findFirst({ where: { email: admin.email } });
    if (existing) {
      await prisma.admin.update({
        where: { id: existing.id },
        data: {
          passwordHash: hashPassword(admin.password),
          isActive: true,
        },
      });
      console.log(`  ✅ Updated admin: ${admin.email}`);
    } else {
      await prisma.admin.create({
        data: {
          email: admin.email,
          passwordHash: hashPassword(admin.password),
          name: admin.name,
          role: admin.role,
          isActive: true,
        },
      });
      console.log(`  ✅ Created admin: ${admin.email}`);
    }
  }

  // =====================================================
  // LOCKSMITH USERS
  // =====================================================
  const locksmithUsers = [
    {
      email: "amiosif@icloud",
      password: "demo1234",
      name: "Andrei Miosif",
      phone: "+447377555299",
      companyName: "LockSafe UK",
    },
  ];

  for (const ls of locksmithUsers) {
    const existing = await prisma.locksmith.findFirst({ where: { email: ls.email } });
    if (existing) {
      await prisma.locksmith.update({
        where: { id: existing.id },
        data: {
          passwordHash: hashPassword(ls.password),
          isActive: true,
        },
      });
      console.log(`  ✅ Updated locksmith: ${ls.email}`);
    } else {
      await prisma.locksmith.create({
        data: {
          email: ls.email,
          passwordHash: hashPassword(ls.password),
          name: ls.name,
          phone: ls.phone,
          companyName: ls.companyName,
          rating: 4.8,
          totalJobs: 0,
          isVerified: true,
          isActive: true,
          baseLat: 51.5074,
          baseLng: -0.1278,
          coverageRadius: 30,
          services: ["Emergency Lockout", "Lock Replacement", "Security Upgrades"],
          coverageAreas: ["London", "Greater London"],
          yearsExperience: 5,
          onboardingCompleted: true,
        },
      });
      console.log(`  ✅ Created locksmith: ${ls.email}`);
    }
  }

  // =====================================================
  // CUSTOMER USERS
  // =====================================================
  const customerUsers = [
    {
      email: "customer@test.com",
      password: "demo123",
      name: "Test Customer",
      phone: "+447000000001",
    },
  ];

  for (const cust of customerUsers) {
    const existing = await prisma.customer.findFirst({ where: { email: cust.email } });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          passwordHash: hashPassword(cust.password),
        },
      });
      console.log(`  ✅ Updated customer: ${cust.email}`);
    } else {
      await prisma.customer.create({
        data: {
          email: cust.email,
          passwordHash: hashPassword(cust.password),
          name: cust.name,
          phone: cust.phone,
          emailVerified: true,
          onboardingCompleted: true,
        },
      });
      console.log(`  ✅ Created customer: ${cust.email}`);
    }
  }

  // =====================================================
  // VERIFICATION
  // =====================================================
  console.log("\n📊 Verification:");
  const admins = await prisma.admin.findMany({ select: { email: true, isActive: true, role: true } });
  const locksmiths = await prisma.locksmith.findMany({ select: { email: true, isActive: true } });
  const customers = await prisma.customer.findMany({ select: { email: true, emailVerified: true } });
  
  console.log("  Admins:", admins.map(a => `${a.email} (${a.role}, active: ${a.isActive})`).join(", "));
  console.log("  Locksmiths:", locksmiths.map(l => `${l.email} (active: ${l.isActive})`).join(", "));
  console.log("  Customers:", customers.map(c => `${c.email} (verified: ${c.emailVerified})`).join(", "));
  
  console.log("\n🎉 Production seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
