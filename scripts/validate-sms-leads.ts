/**
 * validate-sms-leads.ts — Recheck the SMS-ready lead pool before any sends.
 *
 * Targets the exact pool the "SMS (… mobile)" action would contact: leads with
 * status "new" and a UK mobile. Re-validates each as a genuine locksmith
 * (strong locksmith signal in name/website/address, no non-locksmith keyword,
 * UK-looking) and reports clean vs suspicious so you only ever message real
 * locksmiths. DRY-RUN by default; pass --apply to remove the flagged junk.
 *
 * Usage:
 *   npm run leads:validate-sms            # report only (safe)
 *   npm run leads:validate-sms -- --apply # delete the flagged non-locksmiths
 *
 * Read-only unless --apply is given.
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

type LeadRow = {
  id: string; name: string; city: string; address: string;
  phone: string | null; website: string | null; email: string | null;
  rating: number; reviewCount: number;
};

const LOCKSMITH_STRONG = [
  /locksmith(s)?/i, /lock/i, /\blocks?\b/i, /\bkey\s*cut(ting)?\b/i,
  /\bauto\s*locksmith\b/i, /\bcar\s*keys?\b/i, /\bauto\s*key(s)?\b/i,
  /\block\s*out\b/i, /\block\s*change\b/i, /\bupvc\b/i, /\bsafe\b/i,
];
const NON_LOCKSMITH = [
  /\bplumb(er|ing)?\b/i, /\belectric(ian|al)?\b/i, /\bbathroom\b/i,
  /\bkitchen\b/i, /\bglazi(er|ng)?\b/i, /\btil(e|ing)\b/i, /\bcarpet\b/i,
  /\bpainting\b/i, /\bdecorat(or|ing)\b/i, /\broof(ing|er)?\b/i,
  /\bdentist\b/i, /\bsurgery\b/i, /\bbuilder\b/i, /\bjoiner\b/i,
  /\bgarage\s*door\b/i, /\bestate\s*agent\b/i, /\bcleaning\b/i,
];
const NON_UK_COUNTRY = [/\baustralia\b/i, /\bcanada\b/i, /\busa\b/i, /\bunited states\b/i, /\bnew zealand\b/i];

function isUKMobile(phone: string | null): boolean {
  if (!phone) return false;
  const c = phone.replace(/[\s\-().]/g, "");
  return /^07\d{9}$/.test(c) || /^\+447\d{9}$/.test(c) || /^00447\d{9}$/.test(c);
}
function nonUkPhone(phone: string | null): boolean {
  if (!phone) return false;
  const c = phone.replace(/\s+/g, "").trim();
  if (c.startsWith("+")) return !c.startsWith("+44");
  if (c.startsWith("00")) return !c.startsWith("0044");
  return false;
}

function classify(lead: LeadRow): { remove: boolean; review: boolean; reasons: string[] } {
  const text = `${lead.name} ${lead.address} ${lead.website ?? ""}`;
  const hasLock = LOCKSMITH_STRONG.some((p) => p.test(text));
  const hasOtherTrade = NON_LOCKSMITH.some((p) => p.test(text));
  const nonUk = NON_UK_COUNTRY.some((p) => p.test(text)) || nonUkPhone(lead.phone);
  const noReviews = (lead.reviewCount ?? 0) === 0 && (lead.rating ?? 0) === 0;

  const reasons: string[] = [];
  if (!hasLock) reasons.push("not_a_locksmith");
  if (nonUk) reasons.push("non_uk");
  if (hasLock && hasOtherTrade) reasons.push("multi_service_review");
  if (noReviews) reasons.push("no_reviews");

  // DELETE only genuine non-locksmiths or clearly non-UK. A business that has a
  // locksmith signal AND also lists glazing/plumbing/electrical is still a
  // locksmith — keep it, just flag for manual review (some are jack-of-all-
  // trades operators worth a second look).
  const remove = !hasLock || nonUk;
  const review = hasLock && hasOtherTrade;
  return { remove, review, reasons };
}

async function main() {
  const apply = process.argv.includes("--apply");

  // NB: filter UK mobiles in JS, not via Prisma `startsWith` — a "+447" prefix
  // becomes an invalid Mongo regex (the leading + is a quantifier).
  const newMobileLeads = (await prisma.locksmithLead.findMany({
    where: {
      status: "new",
      phone: { not: null },
    },
    select: {
      id: true, name: true, city: true, address: true,
      phone: true, website: true, email: true, rating: true, reviewCount: true,
    },
  })) as LeadRow[];

  // Strict UK-mobile re-validation (DB startsWith is loose).
  const pool = newMobileLeads.filter((l) => isUKMobile(l.phone));

  const withEmail = pool.filter((l) => l.email).length;
  const phoneOnly = pool.length - withEmail;

  const classified = pool.map((l) => ({ lead: l, ...classify(l) }));
  const toRemove = classified.filter((r) => r.remove);   // true non-locksmith / non-UK
  const toReview = classified.filter((r) => r.review);   // locksmith + other trades
  const noReviews = pool.filter((l) => (l.reviewCount ?? 0) === 0 && (l.rating ?? 0) === 0).length;
  const cleanGenuine = pool.length - toRemove.length - toReview.length;

  console.log("\n=== SMS-ready lead validation ===\n");
  console.log(`SMS pool (status=new, UK mobile):    ${pool.length}`);
  console.log(`  ...with email (→ email channel):    ${withEmail}`);
  console.log(`  ...phone-only (→ SMS channel):       ${phoneOnly}`);
  console.log(`\nClear genuine locksmiths:            ${cleanGenuine}`);
  console.log(`Multi-service (locksmith + other) — REVIEW, kept: ${toReview.length}`);
  console.log(`Not a locksmith / non-UK — DELETE:   ${toRemove.length}`);
  console.log(`(soft) no reviews/rating:            ${noReviews}`);
  console.log(`Mode: ${apply ? "APPLY (will delete the DELETE set only)" : "DRY-RUN (no changes)"}`);

  if (toRemove.length) {
    console.log("\nDELETE set (genuine non-locksmiths / non-UK):");
    for (const r of toRemove.slice(0, 40)) {
      console.log(`  ${r.lead.name} | ${r.lead.city} | ${r.lead.phone ?? ""} | ${r.reasons.join(",")}`);
    }
  }
  if (toReview.length) {
    console.log("\nREVIEW set (kept — locksmiths that also list other trades, first 40):");
    for (const r of toReview.slice(0, 40)) {
      console.log(`  ${r.lead.name} | ${r.lead.city} | ${r.lead.phone ?? ""}`);
    }
  }

  if (!apply || toRemove.length === 0) {
    console.log(`\n${toRemove.length ? "Re-run with --apply to delete ONLY the DELETE set." : "DELETE set is empty — the pool is clean. Multi-service leads are kept for you to eyeball."}\n`);
    return;
  }

  const ids = toRemove.map((f) => f.lead.id);
  const res = await prisma.locksmithLead.deleteMany({ where: { id: { in: ids } } });
  console.log(`\nDeleted ${res.count} non-locksmith leads. Remaining SMS pool: ${pool.length - res.count}\n`);
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
