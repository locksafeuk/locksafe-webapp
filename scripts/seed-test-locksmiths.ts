/**
 * seed-test-locksmiths.ts
 *
 * Populates the database with test locksmith accounts.
 * Safe to run multiple times — uses upsert so existing records are updated, not duplicated.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS","strict":false}' scripts/seed-test-locksmiths.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "demo1234";

// Deduplicated list of test locksmith accounts
const TEST_LOCKSMITHS: Array<{
  email: string;
  name: string;
  phone: string;
}> = [
  { email: "aldum83@gmail.com",                name: "Al Dum",                    phone: "+447700000001" },
  { email: "amiosif14@gmail.com",              name: "Andrei Miosif",             phone: "+447700000002" },
  { email: "anafariseu79@gmail.com",           name: "Ana Fariseu",               phone: "+447700000003" },
  { email: "anamdum85@gmail.com",              name: "Anam Dum",                  phone: "+447700000004" },
  { email: "antoniealexandruiulian@gmail.com", name: "Antonie Alexandru Iulian",  phone: "+447700000005" },
  { email: "ciprianbalanica20@gmail.com",      name: "Ciprian Balanica",          phone: "+447700000006" },
  { email: "contact@locksafe.uk",              name: "LockSafe Contact",          phone: "+447700000007" },
  { email: "junob1090@gmail.com",              name: "Juno B",                    phone: "+447700000008" },
  { email: "lingotest63@gmail.com",            name: "Lingo Test",                phone: "+447700000009" },
  { email: "luciand2020@gmail.com",            name: "Lucian D",                  phone: "+447700000010" },
  { email: "medbranddynamics@gmail.com",       name: "Med Brand Dynamics",        phone: "+447700000011" },
  { email: "mirceaiosif82@gmail.com",          name: "Mircea Iosif",              phone: "+447700000012" },
  { email: "sorinavaleria@gmail.com",          name: "Sorina Valeria",            phone: "+447700000013" },
  { email: "morrimouth@gmail.com",             name: "Morri Mouth",               phone: "+447700000014" },
  { email: "medbrnaddynamics@gmail.com",       name: "Medbrnad Dynamics",         phone: "+447700000015" },
  { email: "bobbiejstasteful@gmail.com",       name: "Bobbie J Stasteful",        phone: "+447700000016" },
];

async function main() {
  console.log("🔧 Seeding test locksmith accounts...\n");

  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  let created = 0;
  let updated = 0;

  for (const locksmith of TEST_LOCKSMITHS) {
    const result = await prisma.locksmith.upsert({
      where: { email: locksmith.email },
      update: {
        passwordHash,
        name: locksmith.name,
        phone: locksmith.phone,
      },
      create: {
        email: locksmith.email,
        name: locksmith.name,
        phone: locksmith.phone,
        passwordHash,
        isVerified: false,
        isActive: true,
        rating: 5.0,
        totalJobs: 0,
        totalEarnings: 0,
        yearsExperience: 0,
        coverageAreas: [],
        services: ["lockout", "broken", "key-stuck", "security-upgrade"],
        coverageRadius: 10,
        smsNotifications: true,
        emailNotifications: true,
        pushNotifications: true,
        isAvailable: true,
        insuranceStatus: "pending",
        onboardingCompleted: false,
      },
    });

    const existed = result.createdAt.getTime() !== result.updatedAt.getTime();
    if (existed) {
      updated++;
      console.log(`   ↻ Updated:  ${locksmith.email}`);
    } else {
      created++;
      console.log(`   ✓ Created:  ${locksmith.email}`);
    }
  }

  console.log(`\n✅ Done — ${created} created, ${updated} updated.`);
  console.log(`   Password for all accounts: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
