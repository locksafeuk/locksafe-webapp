/**
 * Creates sparse unique indexes for referralCode on Customer and Locksmith collections.
 *
 * Background: Prisma does not support sparse unique indexes for MongoDB.
 * We removed @unique from referralCode to avoid "dup key: null" errors on existing data,
 * and instead manage uniqueness here with a sparse index (nulls are excluded).
 *
 * Run once against production: npx ts-node -P tsconfig.scripts.json scripts/fix-referralcode-indexes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n🔧 Creating sparse unique indexes for referralCode...\n");

  // Customer.referralCode — sparse unique
  await (prisma as any).$runCommandRaw({
    createIndexes: "Customer",
    indexes: [
      {
        key: { referralCode: 1 },
        name: "Customer_referralCode_sparse_key",
        unique: true,
        sparse: true,
      },
    ],
  });
  console.log("  ✅ Customer.referralCode — sparse unique index created");

  // Locksmith.referralCode — sparse unique
  await (prisma as any).$runCommandRaw({
    createIndexes: "Locksmith",
    indexes: [
      {
        key: { referralCode: 1 },
        name: "Locksmith_referralCode_sparse_key",
        unique: true,
        sparse: true,
      },
    ],
  });
  console.log("  ✅ Locksmith.referralCode — sparse unique index created");

  await prisma.$disconnect();
  console.log("\n✅ Done. Referral code uniqueness is now enforced for non-null values.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
