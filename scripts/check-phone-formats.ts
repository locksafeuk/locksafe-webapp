/**
 * One-off audit: what phone formats are actually stored on Locksmith and
 * LocksmithLead records? Run: npx tsx scripts/check-phone-formats.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function classify(phone: string | null): string {
  if (!phone) return "empty";
  const p = phone.trim();
  if (/^\+44\d{10}$/.test(p)) return "+44XXXXXXXXXX";
  if (/^44\d{10}$/.test(p)) return "44XXXXXXXXXX";
  if (/^0\d{10}$/.test(p)) return "0XXXXXXXXXX";
  if (/^7\d{9}$/.test(p)) return "7XXXXXXXXX (bare)";
  if (/^\+44[\d\s]+$/.test(p)) return "+44 with spaces";
  if (/^0[\d\s]+$/.test(p)) return "0… with spaces";
  if (/^\+?\d[\d\s()-]+$/.test(p)) return "other-numeric";
  return "weird";
}

async function main() {
  const locksmiths = await prisma.locksmith.findMany({ select: { phone: true } });
  const leads = await prisma.locksmithLead.findMany({
    where: { phone: { not: null } },
    select: { phone: true },
  });

  for (const [label, rows] of [
    ["Locksmith", locksmiths.map((l) => l.phone)],
    ["LocksmithLead", leads.map((l) => l.phone)],
  ] as const) {
    const dist = new Map<string, { count: number; example: string }>();
    for (const phone of rows) {
      const key = classify(phone as string | null);
      const entry = dist.get(key) || { count: 0, example: String(phone) };
      entry.count += 1;
      dist.set(key, entry);
    }
    console.log(`\n=== ${label} (${rows.length} records) ===`);
    for (const [key, { count, example }] of [...dist.entries()].sort((a, b) => b[1].count - a[1].count)) {
      const masked = example.replace(/\d(?=[\d\s]{4})/g, "x");
      console.log(`${String(count).padStart(5)}  ${key}   e.g. "${masked}"`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
