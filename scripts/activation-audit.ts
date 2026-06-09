/**
 * activation-audit.ts — The truth about your dispatchable supply.
 *
 * The admin "48 locksmiths" is a vanity number. A locksmith can only RECEIVE
 * jobs if the matcher's gates all pass: isActive + isAvailable + no blocking
 * profile gap (terms, base location, call-out fee, Stripe) + insurance not
 * expired. This script runs the SAME completeness engine the app uses and tells
 * you the real dispatch-ready count, who's blocked, and exactly what each is
 * missing — i.e. the targeting feed for the WhatsApp activation agent.
 *
 * READ-ONLY. Usage:
 *   npm run locksmiths:audit
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
import { computeCompleteness, COMPLETENESS_SELECT } from "../src/lib/locksmith-completeness";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

type Row = {
  id: string;
  name: string | null;
  phone: string | null;
  isActive: boolean;
  isAvailable: boolean;
  insuranceStatus: string;
} & Record<string, unknown>;

function isUKMobile(phone: string | null): boolean {
  if (!phone) return false;
  const c = phone.replace(/[^\d+]/g, "");
  return /^07\d{9}$/.test(c) || /^\+?447\d{9}$/.test(c) || /^00447\d{9}$/.test(c);
}

async function main() {
  const locksmiths = (await prisma.locksmith.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      isActive: true,
      isAvailable: true,
      ...COMPLETENESS_SELECT, // includes insuranceStatus
    },
  })) as Row[];

  let ready = 0;
  const blocked: Array<{ row: Row; missing: string[]; reasons: string[] }> = [];

  // Count how many locksmiths are missing each blocking requirement.
  const gapCount = new Map<string, number>();
  const bump = (k: string) => gapCount.set(k, (gapCount.get(k) ?? 0) + 1);

  for (const l of locksmiths) {
    const c = computeCompleteness(l as never);
    const blockingMissing = c.missing.filter((m) => m.blocking).map((m) => m.key);

    const reasons: string[] = [];
    if (!l.isActive) reasons.push("not_active");
    if (!l.isAvailable) reasons.push("not_available");
    if (l.insuranceStatus === "expired") reasons.push("insurance_expired");

    const dispatchable =
      !c.blockingDispatch && l.isActive && l.isAvailable && l.insuranceStatus !== "expired";

    if (dispatchable) {
      ready++;
    } else {
      for (const k of blockingMissing) bump(k);
      for (const r of reasons) bump(r);
      blocked.push({ row: l, missing: blockingMissing, reasons });
    }
  }

  console.log("\n=== Locksmith Activation Audit ===\n");
  console.log(`Total locksmiths:          ${locksmiths.length}`);
  console.log(`Dispatch-READY (live):     ${ready}`);
  console.log(`Dispatch-BLOCKED:          ${blocked.length}`);
  console.log(`WhatsApp/SMS-reachable blocked: ${blocked.filter((b) => isUKMobile(b.row.phone)).length}`);

  console.log("\nWhy blocked (count of locksmiths missing each gate):");
  for (const [k, n] of [...gapCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${n}`);
  }

  // "One step away" — a single fix flips them live. Highest-ROI to nudge first.
  const oneStep = blocked.filter((b) => b.missing.length + b.reasons.length === 1);
  console.log(`\n⚡ ONE STEP from going live (quickest wins): ${oneStep.length}`);
  for (const b of oneStep.slice(0, 40)) {
    const gap = [...b.missing, ...b.reasons][0];
    console.log(`  ${(b.row.name ?? "—").padEnd(28)} | ${b.row.phone ?? "no phone"} | needs: ${gap}`);
  }

  console.log(`\nAll blocked locksmiths (${blocked.length}):`);
  for (const b of blocked) {
    const gaps = [...b.missing, ...b.reasons].join(", ");
    console.log(`  ${(b.row.name ?? "—").padEnd(28)} | ${b.row.phone ?? "no phone"} | ${gaps}`);
  }
  console.log("");
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
