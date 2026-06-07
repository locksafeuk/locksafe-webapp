/**
 * dedupe-leads.ts — Merge duplicate locksmith leads that share a phone number.
 *
 * Why: the same business can be scraped twice under different googlePlaceIds
 * (legacy bulk-scrape IDs vs Serper IDs, "+44…" vs "0…" phone formats), so
 * placeId uniqueness doesn't catch them. This groups leads by NORMALIZED phone
 * and keeps exactly one per group.
 *
 * Keeper choice (best funnel state wins, never lose outreach history):
 *   1. status rank: onboarded > replied > not_interested > contacted > new
 *   2. has a real email
 *   3. oldest createdAt (carries outreach history/notes)
 * Before deleting the losers, any email/website missing on the keeper is
 * copied over from a duplicate.
 *
 * Usage:
 *   npm run leads:dedupe              # DRY-RUN report (safe)
 *   npm run leads:dedupe -- --apply   # merge + delete duplicates
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
  id: string;
  name: string;
  city: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: string;
  createdAt: Date;
};

/** Normalize a UK phone to a dedup key: +44/0044/44 prefixes → leading 0. */
function normalizePhoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+44")) d = "0" + d.slice(3);
  else if (d.startsWith("0044")) d = "0" + d.slice(4);
  else if (d.startsWith("44") && d.length >= 11) d = "0" + d.slice(2);
  return d.length >= 10 ? d : null;
}

const STATUS_RANK: Record<string, number> = {
  onboarded: 5,
  replied: 4,
  not_interested: 3, // keep the opt-out so we never re-contact someone who declined
  contacted: 2,
  new: 1,
};

function pickKeeper(group: LeadRow[]): LeadRow {
  return [...group].sort((a, b) => {
    const r = (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0);
    if (r !== 0) return r;
    const e = Number(Boolean(b.email)) - Number(Boolean(a.email));
    if (e !== 0) return e;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // oldest first
  })[0];
}

async function main() {
  const apply = process.argv.includes("--apply");

  const leads = (await prisma.locksmithLead.findMany({
    select: {
      id: true, name: true, city: true, phone: true,
      email: true, website: true, status: true, createdAt: true,
    },
  })) as LeadRow[];

  const byPhone = new Map<string, LeadRow[]>();
  for (const l of leads) {
    const key = normalizePhoneKey(l.phone);
    if (!key) continue;
    const arr = byPhone.get(key);
    if (arr) arr.push(l);
    else byPhone.set(key, [l]);
  }

  const groups = [...byPhone.entries()].filter(([, arr]) => arr.length > 1);
  const totalDupes = groups.reduce((s, [, arr]) => s + arr.length - 1, 0);

  console.log("\n=== Lead dedupe (by normalized phone) ===\n");
  console.log(`Total leads scanned:        ${leads.length}`);
  console.log(`Phone groups with dupes:    ${groups.length}`);
  console.log(`Duplicate records to merge: ${totalDupes}`);
  console.log(`Mode: ${apply ? "APPLY (merging + deleting)" : "DRY-RUN (no changes)"}`);

  if (groups.length === 0) {
    console.log("\nNo duplicates found — nothing to do.\n");
    return;
  }

  console.log("\nSample groups (first 20):");
  for (const [key, arr] of groups.slice(0, 20)) {
    const keeper = pickKeeper(arr);
    console.log(`\n  ${key} — ${arr.length} records:`);
    for (const l of arr) {
      const tag = l.id === keeper.id ? "KEEP " : "merge";
      console.log(`    [${tag}] ${l.name} | ${l.city} | ${l.status} | email=${l.email ?? "—"} | ${new Date(l.createdAt).toISOString().slice(0, 10)}`);
    }
  }

  if (!apply) {
    console.log("\nRe-run with --apply to merge and delete duplicates.\n");
    return;
  }

  let merged = 0;
  let deleted = 0;
  for (const [, arr] of groups) {
    const keeper = pickKeeper(arr);
    const losers = arr.filter((l) => l.id !== keeper.id);

    // Backfill keeper's missing email/website from any duplicate before delete.
    // Never copy junk/placeholder emails (e.g. no-email-found@locksafe.internal).
    const isRealEmail = (e: string | null): e is string =>
      Boolean(e && !/locksafe\.internal|@2x|\.(png|jpe?g|gif|svg)$|@(email|domain)\.com$/i.test(e));
    const donorEmail = !isRealEmail(keeper.email) ? (losers.map((l) => l.email).find(isRealEmail) ?? null) : null;
    const donorWebsite = !keeper.website ? losers.find((l) => l.website)?.website : null;
    if (donorEmail || donorWebsite) {
      await prisma.locksmithLead.update({
        where: { id: keeper.id },
        data: {
          ...(donorEmail ? { email: donorEmail } : {}),
          ...(donorWebsite ? { website: donorWebsite } : {}),
        },
      });
      merged++;
    }

    const res = await prisma.locksmithLead.deleteMany({
      where: { id: { in: losers.map((l) => l.id) } },
    });
    deleted += res.count;
  }

  console.log(`\nDone. Keepers enriched: ${merged} · Duplicates deleted: ${deleted}`);
  console.log(`Remaining leads: ${leads.length - deleted}\n`);
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
