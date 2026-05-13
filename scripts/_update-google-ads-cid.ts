import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CID = "4715226378"; // 471-522-6378

async function main() {
  await prisma.googleAdsApiConfig.updateMany({
    where: { key: "default" },
    data: { loginCustomerId: CID },
  });
  const updated = await prisma.googleAdsAccount.updateMany({
    where: {},
    data: { customerId: CID, loginCustomerId: CID },
  });
  console.log(`✅  Updated ${updated.count} account row(s) → customerId: ${CID}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
