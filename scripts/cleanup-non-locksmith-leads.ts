import * as path from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: { "@/*": ["src/*"] },
});

import prisma from "../src/lib/db";

type LeadRow = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  website: string | null;
  email: string | null;
  createdAt: Date;
};

const LOCKSMITH_STRONG_PATTERNS = [
  /locksmith(s)?/i,
  /lock/i,
  /\blocks?\b/i,
  /lock\s*(and|&)\s*key/i,
  /\block\s*specialist\b/i,
  /\block\s*safe\b/i,
  /\bkey\s*cut(ting)?\b/i,
  /\bauto\s*locksmith\b/i,
  /\bcar\s*keys?\b/i,
  /\bauto\s*key(s)?\b/i,
  /\block\s*out\b/i,
  /\block\s*change\b/i,
  /\bupvc\b/i,
];

const NON_LOCKSMITH_PATTERNS = [
  /\bplumb(er|ing)?\b/i,
  /\belectric(ian|al)?\b/i,
  /\bbathroom\b/i,
  /\bkitchen\b/i,
  /\bglazi(er|ng)?\b/i,
  /\btil(e|ing)\b/i,
  /\bcarpet\b/i,
  /\bpainting\b/i,
  /\bdecorat(or|ing)\b/i,
  /\broof(ing|er)?\b/i,
  /\bdentist\b/i,
  /\bsurgery\b/i,
  /\bbuilder\b/i,
  /\bjoiner\b/i,
];

const NON_UK_COUNTRY_TERMS = [
  /\baustralia\b/i,
  /\bcanada\b/i,
  /\busa\b/i,
  /\bunited states\b/i,
  /\bnew zealand\b/i,
];

function isDefinitelyNonUkPhone(phone: string | null): boolean {
  if (!phone) return false;
  const compact = phone.replace(/\s+/g, "").trim();
  if (!compact) return false;
  if (compact.startsWith("+")) return !compact.startsWith("+44");
  if (compact.startsWith("00")) return !compact.startsWith("0044");
  return false;
}

function classifyLead(lead: LeadRow): { remove: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const text = `${lead.name} ${lead.address} ${lead.website ?? ""}`;

  const hasPositive = LOCKSMITH_STRONG_PATTERNS.some((p) => p.test(text));
  const hasNegative = NON_LOCKSMITH_PATTERNS.some((p) => p.test(text));
  const nonUkCountry = NON_UK_COUNTRY_TERMS.some((p) => p.test(text));
  const nonUkPhone = isDefinitelyNonUkPhone(lead.phone);

  if (!hasPositive) reasons.push("no_strong_locksmith_signal");
  if (hasNegative) reasons.push("non_locksmith_keyword");
  if (nonUkCountry) reasons.push("non_uk_country_term");
  if (nonUkPhone) reasons.push("non_uk_phone");

  // Strict deletion rule requested: drop anything that doesn't clearly look
  // like locksmith business, or anything that is clearly non-UK.
  // We keep positive locksmith matches even if they include generic words
  // that could appear in mixed-category listings.
  const remove = !hasPositive || nonUkCountry || nonUkPhone;
  return { remove, reasons };
}

async function main() {
  const apply = process.argv.includes("--apply");

  const leads = (await (prisma as unknown as {
    locksmithLead: { findMany: (a: unknown) => Promise<LeadRow[]> };
  }).locksmithLead.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      address: true,
      phone: true,
      website: true,
      email: true,
      createdAt: true,
    },
  })) as LeadRow[];

  const flagged = leads
    .map((lead) => ({ lead, ...classifyLead(lead) }))
    .filter((row) => row.remove);

  const byReason = new Map<string, number>();
  for (const row of flagged) {
    for (const reason of row.reasons) {
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    }
  }

  console.log("\n=== Non-locksmith Lead Cleanup ===\n");
  console.log(`Total leads scanned: ${leads.length}`);
  console.log(`Flagged for deletion: ${flagged.length}`);
  console.log(`Mode: ${apply ? "APPLY (deleting)" : "DRY-RUN (no delete)"}`);

  if (byReason.size > 0) {
    console.log("\nReason breakdown:");
    for (const [reason, count] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`- ${reason}: ${count}`);
    }
  }

  const sample = flagged.slice(0, 30);
  if (sample.length > 0) {
    console.log("\nSample flagged leads:");
    for (const row of sample) {
      console.log(`- ${row.lead.name} | ${row.lead.city} | phone=${row.lead.phone ?? ""} | email=${row.lead.email ?? ""} | reasons=${row.reasons.join(",")}`);
    }
  }

  if (!apply || flagged.length === 0) return;

  const ids = flagged.map((f) => f.lead.id);
  const result = await (prisma as unknown as {
    locksmithLead: { deleteMany: (a: unknown) => Promise<{ count: number }> };
  }).locksmithLead.deleteMany({ where: { id: { in: ids } } });

  console.log(`\nDeleted leads: ${result.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
  });
