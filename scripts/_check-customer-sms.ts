import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function searchPartial(model: string, fields: string[], regex: RegExp) {
  // @ts-ignore
  const m = (prisma as any)[model];
  if (!m) return null;
  const where = { OR: fields.map((f) => ({ [f]: { contains: "737555299" } })) };
  try {
    const rows = await m.findMany({ where, take: 5 });
    return rows;
  } catch (e: any) {
    return { err: e.message };
  }
}

async function main() {
  const target = "+447737555299";
  const variants = [target, "07737555299", "447737555299", "7737555299", "+44 7737 555299", "+44 7737 555 299"];
  const last9 = "737555299";

  console.log("=== Customers matching", target, "===");
  const customers = await prisma.customer.findMany({
    where: { OR: [{ phone: { in: variants } }, { phone: { contains: last9 } }] },
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
  });
  console.log(JSON.stringify(customers, null, 2));

  console.log("\n=== OutboundSms matching ===");
  // @ts-ignore
  const outbound = await prisma.outboundSms?.findMany?.({
    where: { OR: [{ to: { in: variants } }, { to: { contains: last9 } }] },
    orderBy: { createdAt: "desc" },
    take: 20,
  }).catch((e: any) => ({ err: e.message }));
  console.log(JSON.stringify(outbound, null, 2));

  console.log("\n=== Leads / CallRecords (last9) ===");
  const calls = await (prisma as any).callRecord?.findMany?.({
    where: { callerPhone: { contains: last9 } },
    orderBy: { createdAt: "desc" },
    take: 5,
  }).catch((e: any) => ({ err: e.message }));
  console.log(JSON.stringify(calls, null, 2));

  console.log("\n=== Jobs by phone (any variant) ===");
  const jobs = await prisma.job.findMany({
    where: { customer: { phone: { in: variants } } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      jobNumber: true,
      problemType: true,
      postcode: true,
      status: true,
      createdAt: true,
      customer: { select: { name: true, phone: true } },
    },
  });
  console.log(JSON.stringify(jobs, null, 2));

  console.log("\n=== Twilio config presence ===");
  console.log({
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || "(not set)",
    TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID || "(not set)",
  });

  console.log("\n=== Partial scan across other models ===");
  const checks: Array<[string, string[]]> = [
    ["locksmith", ["phone"]],
    ["locksmithLead", ["phone"]],
    ["callRecord", ["callerPhone"]],
    ["locksmithApplication", ["contactPhone"]],
    ["locksmithCompany", ["contactPhone"]],
    ["stripeReminderLog", ["phone"]],
    ["whatsAppClickLog", ["phone"]],
  ];
  for (const [model, fields] of checks) {
    const r = await searchPartial(model, fields, /737555299/);
    if (r && (Array.isArray(r) ? r.length : true)) {
      console.log(model, "→", JSON.stringify(r, null, 2));
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
