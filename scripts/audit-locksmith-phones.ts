/**
 * Audit locksmith phone numbers — list any that won't normalise into a valid
 * WhatsApp-ready international form.
 *
 * Run with:
 *   npx tsx scripts/audit-locksmith-phones.ts
 *   npx tsx scripts/audit-locksmith-phones.ts --csv > broken-phones.csv
 *
 * Uses the same `normalisePhoneForWa` that powers the admin WhatsApp button,
 * so a row appearing here is exactly a row where the green WhatsApp button
 * is currently dead (or would be after the recent normaliser tightening).
 */
import { PrismaClient } from "@prisma/client";
import { normalisePhoneForWa } from "../src/lib/whatsapp-link";

const prisma = new PrismaClient();
const csvMode = process.argv.includes("--csv");

async function main() {
  const locksmiths = await prisma.locksmith.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      isVerified: true,
    },
    orderBy: { name: "asc" },
  });

  const broken: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    reason: string;
    active: boolean;
    verified: boolean;
  }> = [];

  for (const l of locksmiths) {
    const wa = normalisePhoneForWa(l.phone);
    if (wa) continue;
    const trimmed = (l.phone || "").trim();
    let reason = "unknown";
    if (!trimmed) reason = "empty";
    else if (/^0\d{9}$/.test(trimmed.replace(/\s+/g, ""))) reason = "10 digits, missing a digit";
    else if (trimmed.replace(/\s+/g, "").startsWith("0") && !trimmed.replace(/\s+/g, "").startsWith("07")) reason = "UK landline (not a mobile)";
    else if (/[a-zA-Z]/.test(trimmed)) reason = "contains letters";
    else reason = "malformed";
    broken.push({
      id: l.id,
      name: l.name || "(no name)",
      email: l.email,
      phone: l.phone || "",
      reason,
      active: l.isActive,
      verified: l.isVerified,
    });
  }

  if (csvMode) {
    console.log("id,name,email,phone,reason,active,verified");
    for (const b of broken) {
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      console.log(
        [
          b.id,
          b.name,
          b.email,
          b.phone,
          b.reason,
          String(b.active),
          String(b.verified),
        ]
          .map(esc)
          .join(","),
      );
    }
  } else {
    console.log("");
    console.log(`Total locksmiths:        ${locksmiths.length}`);
    console.log(`With invalid WA phones:  ${broken.length}`);
    console.log("");
    if (broken.length > 0) {
      console.log("─".repeat(120));
      for (const b of broken) {
        const flags = [
          b.verified ? "verified" : "unverified",
          b.active ? "active" : "inactive",
        ].join("/");
        console.log(`  ${b.name.padEnd(30)}  ${b.phone.padEnd(20)}  ${b.reason.padEnd(28)}  ${flags}`);
        console.log(`    email: ${b.email}`);
        console.log(`    id:    ${b.id}`);
      }
      console.log("─".repeat(120));
      console.log("");
      console.log("Fix in admin → /admin/locksmiths → click row → Edit Details → Phone.");
      console.log("Or re-run with --csv to export.");
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
