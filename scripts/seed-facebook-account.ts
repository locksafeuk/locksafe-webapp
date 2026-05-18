/**
 * Seed Facebook SocialAccount record using the system user token.
 * Run: npx tsx --env-file=.env.local --tsconfig tsconfig.scripts.json scripts/seed-facebook-account.ts
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "";
const PAGE_NAME = process.env.FACEBOOK_PAGE_NAME || "LockSafe UK";
const SYSTEM_USER_TOKEN = process.env.FACEBOOK_SYSTEM_USER_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || "";
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";

function assertRequiredEnv() {
  const missing: string[] = [];
  if (!PAGE_ID) missing.push("FACEBOOK_PAGE_ID");
  if (!SYSTEM_USER_TOKEN) missing.push("FACEBOOK_SYSTEM_USER_TOKEN or FACEBOOK_ACCESS_TOKEN");
  if (!PAGE_ACCESS_TOKEN) missing.push("FACEBOOK_PAGE_ACCESS_TOKEN");

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

async function main() {
  assertRequiredEnv();

  const result = await prisma.socialAccount.upsert({
    where: { platform_accountId: { platform: "FACEBOOK", accountId: PAGE_ID } },
    create: {
      platform: "FACEBOOK",
      accountId: PAGE_ID,
      accountName: PAGE_NAME,
      accountHandle: "locksafeuk",
      accessToken: SYSTEM_USER_TOKEN,
      pageId: PAGE_ID,
      pageAccessToken: PAGE_ACCESS_TOKEN,
      isActive: true,
      lastSyncAt: new Date(),
    },
    update: {
      accountName: PAGE_NAME,
      accessToken: SYSTEM_USER_TOKEN,
      pageId: PAGE_ID,
      pageAccessToken: PAGE_ACCESS_TOKEN,
      isActive: true,
      lastSyncAt: new Date(),
    },
  });

  console.log("✅ Facebook SocialAccount upserted:", result.id, result.platform, result.accountName);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
