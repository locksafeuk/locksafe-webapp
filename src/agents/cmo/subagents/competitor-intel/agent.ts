/**
 * Competitor Intelligence Agent
 *
 * Runs weekly. Builds a real-time picture of UK locksmith competitor PPC
 * activity using live Google SERP scans and competitor page fingerprinting.
 *
 * WHY THE ARCHITECTURE CHANGED (SEMrush / SpyFu → own stack):
 * ─────────────────────────────────────────────────────────────
 * SEMrush / SpyFu work by crawling Google at massive scale and caching the
 * results. Their data is typically 2–14 days stale and is billed per row.
 * For a focused UK locksmith operation covering ~20 cities and ~15 keyword
 * templates, we can do better:
 *
 *   ✓ SERP Intelligence Client — directly observed live ads (real-time)
 *   ✓ Competitor Fingerprint   — landing page signals SEMrush doesn't have
 *   ✓ Cross-Validation Engine  — merges both into dualConfirmed keywords
 *   ✓ Zero API cost
 *
 * WHAT IT DOES:
 * ─────────────
 * 1. Reads CompetitorDomain table for active domains to track.
 * 2. Runs SERP scans for top keyword templates × top cities.
 *    Records which competitor domains appear in paid ads + ad copy.
 * 3. Fingerprints each competitor homepage:
 *    keyword signals, PPC tracking presence, trust badges, pricing.
 * 4. Merges SERP + fingerprint evidence → IntelKeyword list.
 * 5. Runs each keyword through the quality gate.
 * 6. Persists to CompetitorKeyword, CompetitorAdCopy, CompetitorGeoSignal.
 * 7. Graduates passing keywords into KeywordSeed (category="competitor").
 * 8. Detects geo entry/exit events (presenceScore delta > 0.15).
 * 9. Marks keywords as dropped when absent from both SERP and fingerprint.
 *
 * KEYWORD UNIVERSE:
 * ─────────────────
 * We scan LOCKSMITH_KEYWORD_TEMPLATES × top UK cities = ~100–150 queries.
 * At 2 s/query this takes ≈3–5 minutes — well within weekly cron tolerance.
 * The result covers 100% of the keyword battleground that matters to us.
 *
 * GEO SIGNALS:
 * ────────────
 * Each SERP result is geo-attributed (keyword contains city name, or the
 * scan itself targeted a city). Competitor presence per city is computed
 * as: (keywords where competitor appeared) / (total keywords scanned).
 */

import prisma from "@/lib/db";
import {
  getSerpIntelligenceClient,
  LOCKSMITH_KEYWORD_TEMPLATES,
  UK_INTEL_CITIES,
}                                               from "@/lib/serp-intelligence-client";
import { getCompetitorFingerprintClient }       from "@/lib/competitor-fingerprint";
import {
  mergeIntelKeywords,
  extractTopSeeds,
  buildGeoPresenceScores,
}                                               from "@/lib/competitor-cross-validate";
import { addSeed }                              from "@/agents/core/seed-bank";
import { BASELINE_NEGATIVE_KEYWORDS }           from "@/lib/google-ads-keywords";
import type { AgentConfig }                     from "@/agents/core/types";
import { COMPETITOR_INTEL_HEARTBEAT_CRON } from "@/agents/heartbeat-schedules";

// ── Constants ─────────────────────────────────────────────────────────────────

export const COMPETITOR_INTEL_AGENT_CONFIG: AgentConfig = {
  name:        "competitor-intel",
  displayName: "Competitor Intelligence",
  role:
    "Weekly live SERP scan + fingerprint of UK locksmith competitor ad activity. " +
    "Feeds verified competitor keywords into the seed bank as high-confidence seeds. " +
    "No paid API required — real-time Google data via own stack.",
  skillsPath:       "cmo/subagents/competitor-intel/SKILL.md",
  monthlyBudgetUsd: 0, // zero external API cost
  heartbeatCronExpr: COMPETITOR_INTEL_HEARTBEAT_CRON,
  permissions:      ["read:competitors", "write:seed-bank", "write:competitor-intel"],
  governanceLevel:  "supervised",
};

/**
 * Known UK locksmith competitor domains.
 * Seeded as defaults; admins can add/remove via the CompetitorDomain table.
 */
export const DEFAULT_COMPETITOR_DOMAINS = [
  { domain: "lockforce.co.uk",           label: "Lockforce (national franchise)" },
  { domain: "local-heroes.co.uk",        label: "Local Heroes (British Gas)" },
  { domain: "checkatrade.com",           label: "Checkatrade (marketplace)" },
  { domain: "rated.co.uk",              label: "Rated People (marketplace)" },
  { domain: "locksmiths.co.uk",         label: "Locksmiths.co.uk (directory)" },
  { domain: "emergencylocksmith.co.uk", label: "Emergency Locksmith UK" },
  { domain: "multiskilled.co.uk",       label: "Multi Skilled Ltd" },
  { domain: "locksmithsnearme.co.uk",   label: "Locksmiths Near Me" },
] as const;

/** How many keyword templates to scan per weekly run (keeps requests ≤ 150). */
const KW_TEMPLATES_PER_RUN = 10;

/** How many cities to scan per weekly run. */
const CITIES_PER_RUN = 10;

// ── Relevance regex ───────────────────────────────────────────────────────────

const LOCKSMITH_RELEVANCE_RE =
  /\b(locksmith|locked out|lock change|lock replacement|door lock|upvc|lock repair|lock pick|key cutting|deadlock|mortice|barrel lock|lock cylinder|lock broken|burglary repair|door handle|lock fitting|lockout|emergency lock)\b/i;

// ── City patterns (for geo attribution from keyword text) ─────────────────────

const UK_CITY_PATTERNS: Array<{ pattern: RegExp; geoId: string; name: string }> = [
  { pattern: /\bsheffield\b/i,    geoId: "1006502", name: "Sheffield" },
  { pattern: /\bleeds\b/i,        geoId: "1006499", name: "Leeds" },
  { pattern: /\bbirmingham\b/i,   geoId: "1006463", name: "Birmingham" },
  { pattern: /\bmanchester\b/i,   geoId: "1006500", name: "Manchester" },
  { pattern: /\bliverpool\b/i,    geoId: "1006498", name: "Liverpool" },
  { pattern: /\bnotting?ham\b/i,  geoId: "1006501", name: "Nottingham" },
  { pattern: /\bbristol\b/i,      geoId: "1006483", name: "Bristol" },
  { pattern: /\bleicester\b/i,    geoId: "1006490", name: "Leicester" },
  { pattern: /\bcoventry\b/i,     geoId: "1006487", name: "Coventry" },
  { pattern: /\bhull\b/i,         geoId: "1006497", name: "Kingston upon Hull" },
  { pattern: /\bexeter\b/i,       geoId: "1006488", name: "Exeter" },
  { pattern: /\bnorwich\b/i,      geoId: "1006496", name: "Norwich" },
  { pattern: /\bbradford\b/i,     geoId: "1006482", name: "Bradford" },
  { pattern: /\bstoke\b/i,        geoId: "1006507", name: "Stoke-on-Trent" },
  { pattern: /\bsouthampton\b/i,  geoId: "1006506", name: "Southampton" },
  { pattern: /\bportsmouth\b/i,   geoId: "1006503", name: "Portsmouth" },
  { pattern: /\bplymouth\b/i,     geoId: "1006504", name: "Plymouth" },
  { pattern: /\bsunderland\b/i,   geoId: "1006508", name: "Sunderland" },
  { pattern: /\bnewcastle\b/i,    geoId: "1006494", name: "Newcastle upon Tyne" },
  { pattern: /\bglasgow\b/i,      geoId: "1006524", name: "Glasgow" },
  { pattern: /\bedinburgh\b/i,    geoId: "1006516", name: "Edinburgh" },
  { pattern: /\bcardiff\b/i,      geoId: "1006534", name: "Cardiff" },
  { pattern: /\blondon\b/i,       geoId: "1006486", name: "London" },
];

function detectGeos(keyword: string): Array<{ geoId: string; name: string }> {
  return UK_CITY_PATTERNS.filter(({ pattern }) => pattern.test(keyword));
}

// ── Baseline profit check ──────────────────────────────────────────────────────

const BASELINE_CONV: Record<string, number> = {
  LOW: 0.07, MEDIUM: 0.12, HIGH: 0.15, UNKNOWN: 0.10,
};
const JOB_VALUE = 175;

function estimateProfitPerClick(cpcGbp: number, competitionIndex: number): number {
  const tier = competitionIndex >= 67 ? "HIGH"
    : competitionIndex >= 34 ? "MEDIUM"
    : competitionIndex > 0   ? "LOW"
    : "UNKNOWN";
  const floor = competitionIndex >= 67 ? 5.00
    : competitionIndex >= 34 ? 2.80
    : competitionIndex > 0   ? 1.20
    : 1.80;
  const effectiveCpc = Math.max(cpcGbp, floor);
  return BASELINE_CONV[tier] * JOB_VALUE - effectiveCpc;
}

// ── Quality gate ───────────────────────────────────────────────────────────────

const negativeSet = new Set(
  BASELINE_NEGATIVE_KEYWORDS.map((k: string) => k.toLowerCase()),
);

export interface QualityGateResult {
  passes:          boolean;
  reason?:         "negative_keyword" | "not_locksmith" | "unprofitable";
  profitPerClick?: number;
}

export function runQualityGate(
  keyword:          string,
  cpcGbp:           number,
  competitionIndex: number,
  isDualConfirmed:  boolean,
): QualityGateResult {
  const norm = keyword.toLowerCase().trim();

  if (negativeSet.has(norm)) {
    return { passes: false, reason: "negative_keyword" };
  }

  if (!LOCKSMITH_RELEVANCE_RE.test(keyword)) {
    return { passes: false, reason: "not_locksmith" };
  }

  // Dual-confirmed keywords with unknown CPC get a pass — we'll price them
  // on the next scout run via Keyword Planner.
  if (cpcGbp === 0 && isDualConfirmed) {
    return { passes: true, profitPerClick: undefined };
  }

  const profit = estimateProfitPerClick(cpcGbp, competitionIndex);
  if (profit <= 0) {
    return { passes: false, reason: "unprofitable", profitPerClick: profit };
  }

  return { passes: true, profitPerClick: profit };
}

// ── Main agent function ────────────────────────────────────────────────────────

export interface CompetitorIntelResult {
  domainsScanned:      number;
  serpRequestsUsed:    number;
  keywordsDiscovered:  number;
  dualConfirmedKws:    number;
  qualityGatePassed:   number;
  seedsGraduated:      number;
  geoEntryEvents:      number;
  geoExitEvents:       number;
  fingerprintsScanned: number;
  errors:              string[];
}

export async function runCompetitorIntelAgent(): Promise<CompetitorIntelResult> {
  const serpClient        = getSerpIntelligenceClient();
  const fingerprintClient = getCompetitorFingerprintClient();
  const db                = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const result: CompetitorIntelResult = {
    domainsScanned:      0,
    serpRequestsUsed:    0,
    keywordsDiscovered:  0,
    dualConfirmedKws:    0,
    qualityGatePassed:   0,
    seedsGraduated:      0,
    geoEntryEvents:      0,
    geoExitEvents:       0,
    fingerprintsScanned: 0,
    errors:              [],
  };

  // ── 1. Seed default competitor domains in DB ─────────────────────────────
  for (const { domain, label } of DEFAULT_COMPETITOR_DOMAINS) {
    const existing = await db.competitorDomain.findUnique({ where: { domain } });
    if (!existing) {
      await db.competitorDomain.create({ data: { domain, label, isActive: true } });
    }
  }

  const activeDomains = await db.competitorDomain.findMany({ where: { isActive: true } });
  if (activeDomains.length === 0) {
    result.errors.push("No active competitor domains configured.");
    return result;
  }
  const trackedDomains = new Set<string>(activeDomains.map((d: { domain: string }) => d.domain));

  // ── 2. Run SERP scans — keyword universe × top cities ────────────────────
  // We scan OUR keyword battleground (not "all keywords domain X buys").
  // This is more actionable than SEMrush: these are the exact keywords we
  // compete on, observed live.
  const kwtemplates = LOCKSMITH_KEYWORD_TEMPLATES.slice(0, KW_TEMPLATES_PER_RUN);
  const cities      = UK_INTEL_CITIES.slice(0, CITIES_PER_RUN);

  console.log(
    `[competitor-intel] Starting SERP scan: ` +
    `${kwtemplates.length} templates × ${cities.length} cities = ` +
    `${kwtemplates.length * cities.length} queries`,
  );

  // Expand keyword templates with city names
  const keywordsToScan = kwtemplates.flatMap((template) =>
    cities.map((c) => `${template} ${c.city}`),
  );

  let serpResults;
  try {
    serpResults = await serpClient.scanMultiGeo(kwtemplates, cities.map((c) => c.city));
    result.serpRequestsUsed = serpResults.requestsUsed;
    console.log(
      `[competitor-intel] SERP scan complete: ${serpResults.results.length} results, ` +
      `${serpResults.requestsUsed} requests used`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`SERP scan failed: ${msg}`);
    // Continue with empty SERP results so fingerprinting still runs
    serpResults = {
      results: [],
      byKeyword: new Map(),
      byDomain: new Map(),
      requestsUsed: 0,
    };
  }

  // Filter SERP results to only include our tracked competitor domains
  const filteredSerpResults = serpResults.results.map((r) => ({
    ...r,
    ads: r.ads.filter((ad) => trackedDomains.has(ad.domain)),
  }));

  // ── 3. Fingerprint each competitor domain ────────────────────────────────
  console.log(`[competitor-intel] Fingerprinting ${activeDomains.length} competitor domains...`);
  const fingerprints = await fingerprintClient.fingerprintAll(
    activeDomains.map((d: { domain: string }) => d.domain),
  );
  result.fingerprintsScanned = fingerprints.size;
  console.log(`[competitor-intel] Fingerprint scan complete.`);

  // ── 4. Merge SERP + fingerprint → IntelKeyword list ─────────────────────
  const mergedKeywords = mergeIntelKeywords(
    filteredSerpResults,
    fingerprints,
    [],    // priors (could pull from DB — future enhancement)
    new Map(), // cpcMap (will be filled by scout via Keyword Planner)
    new Map(), // volumeMap
  );

  result.keywordsDiscovered = mergedKeywords.length;
  result.dualConfirmedKws   = mergedKeywords.filter((k) => k.dualConfirmed).length;

  console.log(
    `[competitor-intel] Keywords merged: ${mergedKeywords.length} total, ` +
    `${result.dualConfirmedKws} dual-confirmed`,
  );

  // ── 5. Process each merged keyword per competitor domain ─────────────────
  for (const competitorDomain of activeDomains) {
    const { domain, id: domainId } = competitorDomain;

    try {
      // Keywords where THIS domain appeared in SERP ads
      const domainSerpKws = mergedKeywords.filter((k) =>
        k.serpDomains.includes(domain),
      );
      // Keywords where THIS domain's fingerprint contains the term
      const domainFpKws = mergedKeywords.filter((k) =>
        k.fingerprintDomains.includes(domain),
      );
      // All keywords relevant to this domain
      const domainKws = new Map<string, typeof mergedKeywords[0]>();
      for (const kw of [...domainSerpKws, ...domainFpKws]) {
        domainKws.set(kw.keyword.toLowerCase().trim(), kw);
      }

      const activeKeywordsThisScan = new Set(domainKws.keys());

      // ── 5a. Persist each keyword ─────────────────────────────────────────
      for (const [norm, kw] of domainKws) {
        const gate = runQualityGate(
          kw.keyword,
          kw.cpcGbp,
          kw.competitionIndex,
          kw.dualConfirmed,
        );

        if (gate.passes) result.qualityGatePassed++;

        const serpConfirmed       = kw.serpDomains.includes(domain);
        const fingerprintConfirmed = kw.fingerprintDomains.includes(domain);

        const existing = await db.competitorKeyword.findFirst({
          where: { domainId, keyword: norm, countryCode: "GB" },
        });

        if (existing) {
          await db.competitorKeyword.update({
            where: { id: existing.id },
            data: {
              cpcGbp:            kw.cpcGbp || existing.cpcGbp,
              monthlyClicks:     kw.monthlyClicks || existing.monthlyClicks,
              avgPosition:       kw.avgPosition || existing.avgPosition,
              competitionIndex:  kw.competitionIndex || existing.competitionIndex,
              // DB columns mapped: seenInSemrush → serpConfirmed, seenInSpyFu → fingerprintConfirmed
              seenInSemrush:     serpConfirmed,
              seenInSpyFu:       fingerprintConfirmed,
              dualSource:        kw.dualConfirmed,
              passedQualityGate: gate.passes,
              isActive:          true,
              lastConfirmedAt:   new Date(),
            },
          });
        } else {
          await db.competitorKeyword.create({
            data: {
              domainId,
              keyword:           norm,
              countryCode:       "GB",
              cpcGbp:            kw.cpcGbp,
              monthlyClicks:     kw.monthlyClicks,
              avgPosition:       kw.avgPosition,
              competitionIndex:  kw.competitionIndex,
              seenInSemrush:     serpConfirmed,
              seenInSpyFu:       fingerprintConfirmed,
              dualSource:        kw.dualConfirmed,
              passedQualityGate: gate.passes,
              isActive:          true,
              lastConfirmedAt:   new Date(),
            },
          });
        }

        // Graduate to seed bank
        if (gate.passes) {
          const confidence = kw.dualConfirmed ? "Dual-confirmed (SERP + fingerprint)" : "Single-source";
          await addSeed(norm, {
            category: "competitor",
            source:   `competitor-intel:${domain}`,
            notes:    `${confidence} competitor keyword. ` +
                      `Seen in ${kw.geoCount} cities, ${kw.competitorCount} competitors bidding. ` +
                      (kw.cpcGbp > 0
                        ? `CPC £${kw.cpcGbp.toFixed(2)}, ${kw.monthlyClicks} clicks/mo est.`
                        : "CPC unknown — will price via Planner.") +
                      (gate.profitPerClick !== undefined
                        ? ` Est. profit/click £${gate.profitPerClick.toFixed(2)}.`
                        : ""),
          });
          result.seedsGraduated++;
        }

        // ── 5b. Geo attribution ─────────────────────────────────────────────
        // Prefer the geos the SERP scan actually observed (kw.geos) — these
        // are the city values from SerpScanResult.geo, populated by
        // scanMultiGeo(). Fall back to keyword-text matching for the older
        // city-suffixed pattern ("emergency locksmith manchester").
        const observedGeos = kw.geos
          .map((g) => UK_CITY_PATTERNS.find(({ pattern }) => pattern.test(g)))
          .filter((g): g is { pattern: RegExp; geoId: string; name: string } => !!g)
          .map(({ geoId, name }) => ({ geoId, name }));
        const geos = observedGeos.length > 0 ? observedGeos : detectGeos(kw.keyword);
        for (const geo of geos) {
          const existingGeo = await db.competitorGeoSignal.findFirst({
            where: { domainId, geoId: geo.geoId },
          });

          const posWeight     = kw.avgPosition > 0 ? 1 / kw.avgPosition : 0.25;
          const scoreIncrement = posWeight * (kw.dualConfirmed ? 1.0 : 0.5);

          if (existingGeo) {
            const prevScore = existingGeo.presenceScore ?? 0;
            const newScore  = Math.min(1, prevScore + scoreIncrement * 0.1);
            const delta     = newScore - prevScore;

            let trend = "STABLE";
            if (delta > 0.15)       { trend = "ENTERING"; result.geoEntryEvents++; }
            else if (delta < -0.15) { trend = "EXITING";  result.geoExitEvents++;  }

            await db.competitorGeoSignal.update({
              where: { id: existingGeo.id },
              data: {
                presenceScore:         newScore,
                previousPresenceScore: prevScore,
                trend,
                activeKeywordCount:    { increment: 1 },
                lastUpdatedAt:         new Date(),
              },
            });
          } else {
            await db.competitorGeoSignal.create({
              data: {
                domainId,
                geoId:             geo.geoId,
                geoName:           geo.name,
                presenceScore:     scoreIncrement * 0.1,
                activeKeywordCount: 1,
                trend:             "NEW",
                lastUpdatedAt:     new Date(),
              },
            });
            result.geoEntryEvents++;
          }
        }
      }

      // ── 5c. Mark dropped keywords ─────────────────────────────────────────
      const prevActive = await db.competitorKeyword.findMany({
        where: { domainId, isActive: true },
        select: { id: true, keyword: true },
      });
      const droppedIds = prevActive
        .filter((k: { id: string; keyword: string }) => !activeKeywordsThisScan.has(k.keyword))
        .map((k: { id: string }) => k.id);

      if (droppedIds.length > 0) {
        await db.competitorKeyword.updateMany({
          where: { id: { in: droppedIds } },
          data:  { isActive: false, droppedAt: new Date() },
        });
      }

      // ── 5d. Persist ad copy from SERP results ─────────────────────────────
      for (const serpResult of filteredSerpResults) {
        for (const ad of serpResult.ads) {
          if (ad.domain !== domain || !ad.headline) continue;
          const triggerKw = serpResult.keyword.toLowerCase().trim();

          const existing = await db.competitorAdCopy.findFirst({
            where: { domainId, triggerKeyword: triggerKw, headline1: ad.headline },
          });
          if (!existing) {
            await db.competitorAdCopy.create({
              data: {
                domainId,
                triggerKeyword: triggerKw,
                headline1:      ad.headline,
                description1:   ad.description || undefined,
                displayPath1:   ad.displayUrl?.split("/")?.[1],
                source:         "serp-live",
                lastSeenAt:     new Date(),
                isActive:       true,
              },
            });
          } else {
            await db.competitorAdCopy.update({
              where: { id: existing.id },
              data:  { lastSeenAt: new Date(), isActive: true },
            });
          }
        }
      }

      // ── 5e. Update domain overview ────────────────────────────────────────
      // Estimate monthly spend from SERP presence: keywords × avg CPC × CTR
      const domainKwArr = [...domainKws.values()];
      const estMonthlySpend = domainKwArr.reduce((sum, kw) => {
        return sum + (kw.cpcGbp > 0 ? kw.cpcGbp * kw.monthlyClicks : 0);
      }, 0);

      await db.competitorDomain.update({
        where: { id: domainId },
        data:  {
          estimatedMonthlySpendGbp: estMonthlySpend > 0 ? estMonthlySpend : undefined,
          lastScannedAt:            new Date(),
        },
      });

      result.domainsScanned++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to process ${domain}: ${msg}`);
    }
  }

  console.log(
    `[competitor-intel] Run complete. ` +
    `Domains: ${result.domainsScanned}, ` +
    `Keywords: ${result.keywordsDiscovered}, ` +
    `Dual-confirmed: ${result.dualConfirmedKws}, ` +
    `Seeds graduated: ${result.seedsGraduated}`,
  );

  return result;
}

// ── Read helpers (used by opportunity scout) ──────────────────────────────────

/**
 * Return all dual-confirmed, quality-gate-passing competitor keywords.
 * Used by the opportunity scout to seed its Planner calls with high-confidence
 * competitor terms — replaces the old generateKeywordIdeasFromSite loop.
 */
export async function getDualSourceCompetitorSeeds(limit = 30): Promise<string[]> {
  const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows = await db.competitorKeyword.findMany({
    where:   { dualSource: true, passedQualityGate: true, isActive: true },
    orderBy: { monthlyClicks: "desc" },
    take:    limit,
    select:  { keyword: true },
  });
  return rows.map((r: { keyword: string }) => r.keyword);
}

/**
 * Return competitor geo competition factor for a specific geoId.
 * Scout uses this to adjust opportunity scores:
 *   - EXITING competitor → +8% boost per domain (reduced auction pressure)
 *   - ENTERING competitor → -5% caution flag per domain
 */
export async function getCompetitorGeoFactor(
  geoId: string,
): Promise<{ factor: number; entryCount: number; exitCount: number }> {
  const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const signals = await db.competitorGeoSignal.findMany({
    where:  { geoId },
    select: { trend: true, presenceScore: true },
  });

  const entryCount = signals.filter(
    (s: { trend: string }) => s.trend === "ENTERING" || s.trend === "NEW",
  ).length;
  const exitCount = signals.filter(
    (s: { trend: string }) => s.trend === "EXITING",
  ).length;

  const factor = Math.max(0.5, Math.min(1.5,
    1.0 + exitCount * 0.08 - entryCount * 0.05,
  ));

  return { factor, entryCount, exitCount };
}
