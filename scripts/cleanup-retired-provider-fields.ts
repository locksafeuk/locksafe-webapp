import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CountResult = { n: number };

async function count(collection: string, query: Record<string, unknown>) {
  const res = (await (prisma as any).$runCommandRaw({
    count: collection,
    query,
  })) as CountResult;

  return Number(res?.n ?? 0);
}

async function main() {
  console.log("\n🧹 Cleaning retired provider fields (Bland -> Retell only)\n");

  const before = {
    jobBlandCallId: await count("Job", { blandCallId: { $exists: true } }),
    jobCreatedViaBland: await count("Job", { createdVia: "bland_ai" }),
    customerCreatedViaBland: await count("Customer", { createdVia: "bland_ai" }),
  };

  console.log("Before:", before);

  const unsetBlandCallId = await (prisma as any).$runCommandRaw({
    update: "Job",
    updates: [
      {
        q: { blandCallId: { $exists: true } },
        u: { $unset: { blandCallId: "" } },
        multi: true,
      },
    ],
  });

  const normalizeJobCreatedVia = await (prisma as any).$runCommandRaw({
    update: "Job",
    updates: [
      {
        q: { createdVia: "bland_ai" },
        u: { $set: { createdVia: "phone" } },
        multi: true,
      },
    ],
  });

  const normalizeCustomerCreatedVia = await (prisma as any).$runCommandRaw({
    update: "Customer",
    updates: [
      {
        q: { createdVia: "bland_ai" },
        u: { $set: { createdVia: "phone" } },
        multi: true,
      },
    ],
  });

  const after = {
    jobBlandCallId: await count("Job", { blandCallId: { $exists: true } }),
    jobCreatedViaBland: await count("Job", { createdVia: "bland_ai" }),
    customerCreatedViaBland: await count("Customer", { createdVia: "bland_ai" }),
  };

  console.log("\nUpdate results:");
  console.log("- Job.blandCallId unset:", JSON.stringify(unsetBlandCallId));
  console.log("- Job.createdVia normalized:", JSON.stringify(normalizeJobCreatedVia));
  console.log("- Customer.createdVia normalized:", JSON.stringify(normalizeCustomerCreatedVia));

  console.log("\nAfter:", after);
  console.log("\n✅ Cleanup complete.\n");
}

main()
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
