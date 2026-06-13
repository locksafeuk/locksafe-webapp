/**
 * Veo monthly budget ledger.
 *
 * Veo b-roll costs real money, so spend is capped per calendar month. Usage is
 * tracked in a small JSON file on the Mac runner (the only place Veo runs) —
 * deliberately NOT a DB model, so Phase 2 deploys with zero schema migration.
 *
 * Cap defaults to ~$25 ≈ £20/month (LOCKSAFE_VEO_MONTHLY_CAP_USD). Once the
 * month's spend would exceed the cap, `reserve()` returns false and the caller
 * falls back to the free gradient/poster background.
 *
 * Ledger path: LOCKSAFE_VEO_LEDGER, else ~/.locksafe/veo-usage.json.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

interface Ledger {
  /** month (YYYY-MM) → { spendUsd, clips } */
  [month: string]: { spendUsd: number; clips: number };
}

function ledgerPath(): string {
  return process.env.LOCKSAFE_VEO_LEDGER || path.join(homedir(), ".locksafe", "veo-usage.json");
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
}

export function monthlyCapUsd(): number {
  return Number(process.env.LOCKSAFE_VEO_MONTHLY_CAP_USD || "25"); // ~£20
}

async function readLedger(): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(ledgerPath(), "utf8")) as Ledger;
  } catch {
    return {};
  }
}

async function writeLedger(l: Ledger): Promise<void> {
  const p = ledgerPath();
  await mkdir(path.dirname(p), { recursive: true }).catch(() => {});
  await writeFile(p, JSON.stringify(l, null, 2), "utf8");
}

export interface VeoSpendStatus {
  month: string;
  spentUsd: number;
  capUsd: number;
  clips: number;
  remainingUsd: number;
}

export async function veoSpendStatus(): Promise<VeoSpendStatus> {
  const month = currentMonth();
  const l = await readLedger();
  const m = l[month] ?? { spendUsd: 0, clips: 0 };
  const capUsd = monthlyCapUsd();
  return {
    month,
    spentUsd: m.spendUsd,
    capUsd,
    clips: m.clips,
    remainingUsd: Math.max(0, capUsd - m.spendUsd),
  };
}

/**
 * Check whether an estimated spend fits under this month's cap. Returns true if
 * generation may proceed. (We check before generating; record the actual after.)
 */
export async function canSpend(estUsd: number): Promise<boolean> {
  const { spentUsd, capUsd } = await veoSpendStatus();
  return spentUsd + estUsd <= capUsd;
}

/** Record actual spend after a successful Veo clip. */
export async function recordSpend(usd: number): Promise<void> {
  const month = currentMonth();
  const l = await readLedger();
  const m = l[month] ?? { spendUsd: 0, clips: 0 };
  m.spendUsd = Math.round((m.spendUsd + usd) * 1000) / 1000;
  m.clips += 1;
  l[month] = m;
  await writeLedger(l);
}
