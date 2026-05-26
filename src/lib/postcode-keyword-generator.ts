/**
 * Postcode × Service Keyword Generator
 *
 * Produces the "cheap tricky keywords" universe: hyper-local search
 * queries that combine UK postcode districts with locksmith service
 * templates. These are the keywords sharks structurally ignore (their
 * national-PPC tooling generates city-level keywords, not postcode-level)
 * and where LockSafe's "real local engineer" positioning wins.
 *
 * Generation rules:
 *   1. Only generate for postcode districts where we have LocksmithCoverage
 *      (anti-rip-off lever: never spend on keywords we can't fulfil).
 *   2. Each district gets ~5 service variants — covers the most common
 *      intent buckets without exploding the seed bank.
 *   3. Seeds are written to KeywordSeed with category="postcode_local"
 *      and source="postcode_generator:<batch_id>" so we can audit and
 *      regenerate them.
 *   4. Idempotent — re-running upserts. Existing seeds with newer activity
 *      (winCount/lossCount) are untouched.
 *
 * Expected output: 26 locksmiths × ~57 districts × 5 templates ≈ 7,400
 * unique keywords. (More than the 5,000 estimate because backfill picked
 * up large radii.)
 *
 * Run from a script (not a request handler) — this writes hundreds of
 * KeywordSeed rows in one pass.
 */

import { prisma as _prisma } from "@/lib/db";
import { addSeed, type SeedCategory } from "@/agents/core/seed-bank";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Service templates ───────────────────────────────────────────────────────

/**
 * The five service-intent buckets. Each one targets a different searcher
 * mindset; together they cover the bulk of profitable locksmith demand
 * outside the shark-dominated "emergency / locked out" head terms.
 *
 * The placeholder {district} gets replaced with the actual postcode
 * district (RG1, SK4, etc.). The keyword stays lowercase per
 * KeywordSeed.keyword normalisation in addSeed().
 */
export const POSTCODE_SERVICE_TEMPLATES: Array<{
  template:  string;
  family:    SeedCategory;
  intent:    string;  // human description, helps with audits
}> = [
  // Postcode-local emergency (hyper-local, sharks under-bid)
  { template: "locksmith {district}",             family: "postcode_local",     intent: "I'm in this postcode, find me a locksmith" },
  { template: "emergency locksmith {district}",   family: "postcode_local",     intent: "I'm locked out in this postcode right now" },
  { template: "24 hour locksmith {district}",     family: "postcode_local",     intent: "I need someone after-hours in this postcode" },

  // Service-specific long-tail (sharks ignore the granularity)
  { template: "lock change {district}",            family: "service_long_tail", intent: "I want a planned lock change in this area" },
  { template: "lock repair {district}",            family: "service_long_tail", intent: "broken lock, need it fixed here" },
  { template: "upvc door lock repair {district}",  family: "service_long_tail", intent: "specific lock type — informed buyer" },
  { template: "yale lock replacement {district}",  family: "service_long_tail", intent: "brand-specific — informed buyer" },
  { template: "anti snap lock {district}",         family: "service_long_tail", intent: "security upgrade — informed buyer" },

  // Trust-signal head terms (informed/cautious searchers).
  // NOTE: "mla locksmith {district}" was removed in May 2026 — LockSafe
  // does NOT currently hold MLA accreditation; bidding on a phrase that
  // implies membership we don't have is misrepresentation under the
  // Consumer Protection from Unfair Trading Regulations 2008.
  { template: "honest locksmith {district}",        family: "trust_signal",      intent: "scarred buyer looking for trustworthy operator" },
  { template: "fixed price locksmith {district}",   family: "trust_signal",      intent: "wants quote certainty" },
  { template: "dbs checked locksmith {district}",   family: "trust_signal",      intent: "knows DBS vetting matters (verifiable for LockSafe)" },
  { template: "no callout fee locksmith {district}", family: "trust_signal",     intent: "direct shark-contrast" },

  // B2B specialist
  { template: "landlord lock change {district}",   family: "b2b_specialist",    intent: "letting agent / landlord — repeat customer" },
  { template: "commercial locksmith {district}",   family: "b2b_specialist",    intent: "business premises — higher LTV" },
];

// ── Generator ───────────────────────────────────────────────────────────────

export interface GeneratorOptions {
  /** Limit total seeds inserted (safety cap). Default 10000. */
  maxSeeds?:        number;
  /** Only generate for districts already covered. Default true (recommended). */
  gateByCoverage?:  boolean;
  /** Tag generated seeds with this batch ID so we can audit. */
  batchId?:         string;
  /** Override service templates (mostly for tests). */
  templates?:       typeof POSTCODE_SERVICE_TEMPLATES;
  /** Dry-run: report what would be inserted without writing. */
  dryRun?:          boolean;
}

export interface GeneratorResult {
  districtsConsidered:  number;
  templatesUsed:        number;
  keywordsGenerated:    number;
  newSeedsCreated:      number;
  alreadyExisted:       number;
  sampleKeywords:       string[];  // first 10 as smoke-test
  errors:               string[];
}

/**
 * Build the postcode-keyword universe and write it to KeywordSeed.
 *
 * Default safety behaviours:
 *   - gateByCoverage=true: only generate seeds for districts already in
 *     LocksmithCoverage, so we never seed a keyword we can't fulfil
 *   - maxSeeds cap (default 10000): prevents accidental seed bank
 *     explosion if coverage table has bad data
 *   - dryRun option: preview the output before writing
 *
 * Run this once after each coverage backfill (or on a quarterly cadence).
 */
export async function generatePostcodeKeywords(
  options: GeneratorOptions = {},
): Promise<GeneratorResult> {
  const {
    maxSeeds       = 10000,
    gateByCoverage = true,
    batchId        = `pcgen_${Date.now()}`,
    templates      = POSTCODE_SERVICE_TEMPLATES,
    dryRun         = false,
  } = options;

  const result: GeneratorResult = {
    districtsConsidered: 0,
    templatesUsed:       templates.length,
    keywordsGenerated:   0,
    newSeedsCreated:     0,
    alreadyExisted:      0,
    sampleKeywords:      [],
    errors:              [],
  };

  // Pull unique covered districts (deduped — many locksmiths may share a district)
  const districts: string[] = gateByCoverage
    ? (await prisma.locksmithCoverage.findMany({
        where: { isPaused: false },
        select: { postcodeDistrict: true },
        distinct: ["postcodeDistrict"],
      })).map((r: { postcodeDistrict: string }) => r.postcodeDistrict)
    : [];

  result.districtsConsidered = districts.length;

  if (districts.length === 0 && gateByCoverage) {
    result.errors.push(
      "No covered districts found — run the locksmith coverage backfill first " +
      "(scripts/backfill-locksmith-coverage-v2.ts)",
    );
    return result;
  }

  // Generate every (district × template) combo, dedupe within this run
  const seen = new Set<string>();
  const queue: Array<{ keyword: string; family: SeedCategory; intent: string }> = [];

  for (const district of districts) {
    for (const { template, family, intent } of templates) {
      // Use uppercase district in the keyword string (matches what users
      // would type/Google would suggest). Normalised to lowercase by addSeed().
      const keyword = template.replace("{district}", district);
      if (seen.has(keyword)) continue;
      seen.add(keyword);
      queue.push({ keyword, family, intent });
      if (queue.length >= maxSeeds) break;
    }
    if (queue.length >= maxSeeds) break;
  }

  result.keywordsGenerated = queue.length;
  result.sampleKeywords = queue.slice(0, 10).map((q) => q.keyword);

  if (dryRun) return result;

  // Write to KeywordSeed. addSeed() is idempotent — re-runs preserve any
  // existing score/winCount/lossCount data.
  for (const { keyword, family, intent } of queue) {
    try {
      const existing = await prisma.keywordSeed.findUnique({
        where: { keyword: keyword.toLowerCase() },
      });
      if (existing) {
        result.alreadyExisted++;
        continue;
      }
      await addSeed(keyword, {
        category: family,
        source:   `postcode_generator:${batchId}`,
        notes:    `intent: ${intent}`,
      });
      result.newSeedsCreated++;
    } catch (err) {
      result.errors.push(`${keyword}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return result;
}
