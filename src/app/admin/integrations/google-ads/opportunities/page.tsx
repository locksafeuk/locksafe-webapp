"use client";

/**
 * Admin · Google Ads · Opportunity Scout
 *
 * Surfaces the latest weekly scout output:
 *   • Coverage tab — cities where we already have locksmiths, ranked by
 *     expected monthly gross profit (£) from the profit-potential model.
 *   • Recruit-Here tab — cities with strong demand but ZERO locksmiths.
 *
 * Scoring model (v2 — profit-potential):
 *   profitPerClick = convRate × £175 jobValue - cpcGbp
 *   expectedMonthlyProfit = Σ(searches × profitPerClick) × supply × modifiers
 *   convRate priors: LOW 7% · MEDIUM 12% · HIGH 15%
 *   Overridden by real campaign conv data when ≥50 clicks available.
 *
 * Features:
 *   - Score = expected monthly gross profit (£), not cheapness
 *   - Est. CPA and conv rate per city
 *   - After-hours gap badge — competitors day-parting → 24/7 structural advantage
 *   - Impression share from live campaigns
 *   - "Cheap Cities" toggle — filters to CPC < £3.00, not HIGH, not London
 *   - CPC bias warning (⚠) when agentNotes.cpaBias > 1.3 (running hotter than predicted)
 *   - Hide cities that already have a PUBLISHED campaign (saturation filter)
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tier = "LOW" | "MEDIUM" | "HIGH";
type Status = "NEW" | "REVIEWED" | "DRAFTED" | "DISMISSED";
type Kind = "COVERAGE" | "RECRUIT";

// London geo IDs (client-side copy — kept in sync with google-ads-opportunities.ts)
const LONDON_GEO_IDS = new Set([
  "1006450","9041107","1006453","1006459","1006456","9198373","9041110",
  "9198785","9198858","9198805","9208638","9046056","9046054",
  "1006465","1006466","1006467","1006470","1006471",
  "1006468","1006469","9046053","9046051","9046052","9198371","9046055",
  "1006472","9198370","9198369","1006473","1006474",
  "9046050","9198374","9198372",
]);

interface AgentNotes {
  // CPA reflection (from live campaign feedback)
  cpaBias?: number;
  convRateBias?: number;
  actualCpcGbp?: number;
  predictedCpcGbp?: number;
  actualConvRate?: number;
  sampleDays?: number;
  sampledAt?: string;
  // Profit model outputs
  expectedMonthlyProfitGbp?: number;
  estimatedConvRate?: number;
  estimatedCpaGbp?: number;
  emergencyIntentFraction?: number;
  // Operational confidence
  operationalEfficiencyFactor?: number;
  /** False when factor is a 1.0 default (no operational data), not verified 100% efficiency. */
  modelConfidenceVerified?: boolean;
  // Competitive signals
  ourImpressionShare?: number | null;
  afterHoursGap?: boolean;
  // Fallback / geo flags
  usingFallbackCpc?: boolean;
  competitorDomains?: string[];
  nearLondonPenalty?: boolean;
  winterBoost?: boolean;
}

interface OpportunityRow {
  id: string;
  kind: Kind;
  geoTargetId: string;
  geoLabel: string;
  computedAt: string;
  score: number;
  medianCpcGbp: number;
  medianCompetitionIndex: number;
  competitionTier: Tier;
  totalMonthlySearches: number;
  topKeywords: Array<{
    text: string;
    monthlySearches: number;
    cpcGbp: number;
    competitionIndex: number;
    profitPerClick?: number;
    monthlyProfitGbp?: number;
    isEmergencyIntent?: boolean;
    /** 0.05–1.0: geo-local stability weight applied to this keyword's profit estimate */
    stabilityWeight?: number;
    /** Consecutive scans with profit > 0: 0–1=🆕, 2–3=⚡, 4+=✓ */
    consecutiveSurvivalCount?: number;
    score: number;
  }>;
  locksmithCount: number;
  locksmithIds: string[];
  supplyRatio: number;
  status: Status;
  draftId: string | null;
  agentNotes: string | null;
}

interface ScanResp {
  coverage: OpportunityRow[];
  recruit: OpportunityRow[];
  // Published city geo IDs — used to mark saturated cities
  publishedGeoIds?: string[];
  computedAt: string | null;
}

const TIER_COLORS: Record<Tier, string> = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-red-100 text-red-800",
};

const STATUS_COLORS: Record<Status, string> = {
  NEW: "bg-blue-100 text-blue-900",
  REVIEWED: "bg-gray-100 text-gray-700",
  DRAFTED: "bg-green-100 text-green-900",
  DISMISSED: "bg-gray-100 text-gray-500 line-through",
};

function parseAgentNotes(raw: string | null): AgentNotes {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default function OpportunityScoutPage() {
  const [data, setData] = useState<ScanResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<Kind>("COVERAGE");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [cheapCitiesOnly, setCheapCitiesOnly] = useState(false);
  const [hideSaturated, setHideSaturated] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/google-ads/opportunities", { cache: "no-store" });
      if (r.ok) {
        setData(await r.json());
      } else {
        setBanner({ kind: "err", msg: `Load failed: ${r.status}` });
      }
    } catch (e) {
      setBanner({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const runScan = async () => {
    if (!confirm("Run a fresh Opportunity Scout scan now? This calls Google Keyword Planner and may take 1-2 minutes.")) return;
    setScanning(true);
    setBanner(null);
    try {
      const r = await fetch("/api/admin/google-ads/opportunities/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipAutoDraft: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Status ${r.status}`);
      setBanner({
        kind: "ok",
        msg: `Scan complete: ${j.coverageScored ?? 0} coverage + ${j.recruitScored ?? 0} recruit opportunities. ${j.failures?.length ?? 0} failures.`,
      });
      await refresh();
    } catch (e) {
      setBanner({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setScanning(false);
    }
  };

  const draftOpportunity = async (opp: OpportunityRow) => {
    if (!confirm(`Generate a draft campaign for ${opp.geoLabel}? This will pick the best-rated covering locksmith and create a PENDING_APPROVAL draft.`)) return;
    setActionBusy(opp.id);
    setBanner(null);
    try {
      const r = await fetch(`/api/admin/google-ads/opportunities/${opp.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Status ${r.status}`);
      setBanner({
        kind: "ok",
        msg: `Draft created for ${j.cityLabel} (anchor: ${j.locksmithName}). ${j.keywordCount} keywords.`,
      });
      await refresh();
    } catch (e) {
      setBanner({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setActionBusy(null);
    }
  };

  const dismissOpportunity = async (opp: OpportunityRow) => {
    if (!confirm(`Dismiss opportunity for ${opp.geoLabel}?`)) return;
    setActionBusy(opp.id);
    setBanner(null);
    try {
      const r = await fetch(`/api/admin/google-ads/opportunities/${opp.id}/draft`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Status ${r.status}`);
      await refresh();
    } catch (e) {
      setBanner({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setActionBusy(null);
    }
  };

  const publishedGeoIds = useMemo(
    () => new Set(data?.publishedGeoIds ?? []),
    [data],
  );

  const rows = useMemo(() => {
    if (!data) return [];
    let source = tab === "COVERAGE" ? data.coverage : data.recruit;

    if (cheapCitiesOnly) {
      source = source.filter(
        (o) =>
          o.medianCpcGbp < 3.00 &&
          o.competitionTier !== "HIGH" &&
          !LONDON_GEO_IDS.has(o.geoTargetId),
      );
    }

    if (hideSaturated && tab === "COVERAGE") {
      source = source.filter((o) => !publishedGeoIds.has(o.geoTargetId));
    }

    return source;
  }, [data, tab, cheapCitiesOnly, hideSaturated, publishedGeoIds]);

  const isLondon = (geoId: string) => LONDON_GEO_IDS.has(geoId);
  const estClicksPerDay = (medianCpc: number) =>
    medianCpc > 0 ? Math.floor(10 / medianCpc) : 0;

  /** Keyword stability badge: based on consecutiveSurvivalCount or stabilityWeight. */
  const stabilityBadge = (kw: { stabilityWeight?: number; consecutiveSurvivalCount?: number }) => {
    const count = kw.consecutiveSurvivalCount ?? 0;
    const weight = kw.stabilityWeight ?? 0.25;
    if (count === 0 && weight <= 0.25) return { icon: "🆕", label: "New — 1st scan, heavily discounted", cls: "text-gray-400" };
    if (count <= 2 || weight < 0.6)    return { icon: "⚡", label: `${count} scans — building history`, cls: "text-yellow-600" };
    return { icon: "✓", label: `${count} consecutive profitable scans — stable`, cls: "text-green-600" };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Opportunity Scout</h1>
          <p className="text-sm text-gray-600 mt-1">
            Weekly UK-wide scan for under-served Google Ads markets.
            Ranked by <strong>expected monthly gross profit</strong>: conv rate × £175 job value − CPC,
            adjusted for supply, seasonality, and real campaign feedback.
          </p>
          {data?.computedAt && (
            <p className="text-xs text-gray-500 mt-1">
              Last scan: {new Date(data.computedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/integrations/google-ads/drafts"
            className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
          >
            ← Drafts
          </Link>
          <button
            onClick={runScan}
            disabled={scanning}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Run scan now"}
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3 rounded text-sm ${
            banner.kind === "ok" ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
          }`}
        >
          {banner.msg}
        </div>
      )}

      {/* Fallback CPC warning — shown when all data is using industry estimates */}
      {!loading && rows.length > 0 && rows.every((o) => parseAgentNotes(o.agentNotes).usingFallbackCpc) && (
        <div className="p-3 rounded text-sm bg-amber-50 border border-amber-300 text-amber-900">
          <strong>⚠ CPC estimates are based on industry benchmarks</strong>, not live Keyword Planner bids.
          This happens when your Google Ads developer token is in test mode (not yet production-approved)
          or when the account lacks sufficient auction history for these geos.
          CPCs shown reflect realistic UK locksmith ranges (LOW £1.20 · MEDIUM £2.80 · HIGH £5.00)
          but may differ from actual auction prices.
          {" "}<a href="https://developers.google.com/google-ads/api/docs/get-started/dev-token" target="_blank" rel="noopener" className="underline">Apply for production token →</a>
        </div>
      )}

      {/* Competitor domains panel — shown when auction insights are available */}
      {!loading && (() => {
        const allDomains = rows.flatMap((o) => parseAgentNotes(o.agentNotes).competitorDomains ?? []);
        const unique = [...new Set(allDomains)].slice(0, 8);
        if (!unique.length) return null;
        return (
          <div className="p-3 rounded text-sm bg-blue-50 border border-blue-200">
            <span className="font-semibold text-blue-900">Competitors in your auctions: </span>
            <span className="text-blue-800">{unique.join(" · ")}</span>
            <span className="text-blue-600 text-xs ml-2">(from Google Auction Insights)</span>
          </div>
        );
      })()}

      {/* Filter bar */}
      <div className="flex gap-4 items-center text-sm flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={cheapCitiesOnly}
            onChange={(e) => setCheapCitiesOnly(e.target.checked)}
            className="rounded"
          />
          <span className="font-medium text-green-800">Cheap Cities only</span>
          <span className="text-xs text-gray-500">(CPC &lt; £3.00, LOW/MEDIUM, non-London)</span>
        </label>
        {tab === "COVERAGE" && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideSaturated}
              onChange={(e) => setHideSaturated(e.target.checked)}
              className="rounded"
            />
            <span className="font-medium">Hide published cities</span>
            <span className="text-xs text-gray-500">(already have a live campaign)</span>
          </label>
        )}
      </div>

      <div className="flex gap-1 border-b">
        {(["COVERAGE", "RECRUIT"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === k
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {k === "COVERAGE" ? "Coverage" : "Recruit-Here"}{" "}
            <span className="ml-1 text-xs text-gray-500">
              ({data ? (k === "COVERAGE" ? data.coverage.length : data.recruit.length) : 0})
            </span>
          </button>
        ))}
      </div>

      {tab === "RECRUIT" && (
        <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded p-3">
          These cities have strong locksmith demand but <strong>no onboarded locksmiths yet</strong>.
          Use this list to prioritise recruitment outreach. Drafts can't be auto-generated until at
          least one locksmith joins.
        </p>
      )}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded">
          <p>No opportunities found.</p>
          <p className="text-sm mt-1">
            {cheapCitiesOnly ? "Try turning off the Cheap Cities filter." : "Try running a scan."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">City</th>
                <th className="px-3 py-2 text-right" title="Expected gross monthly profit at median CPC (£175 job value, tier-based conv rates)">
                  Est. Profit/mo
                </th>
                <th className="px-3 py-2 text-right" title="Estimated cost per acquisition at median CPC">
                  Est. CPA
                </th>
                <th className="px-3 py-2 text-right">Median CPC</th>
                <th className="px-3 py-2 text-right" title="Estimated clicks/day at £10 budget">
                  ~Clicks/day
                </th>
                <th className="px-3 py-2 text-center">Competition</th>
                <th className="px-3 py-2 text-right">Monthly searches</th>
                <th className="px-3 py-2 text-right">Locksmiths</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((opp) => {
                const london = isLondon(opp.geoTargetId);
                const notes = parseAgentNotes(opp.agentNotes);
                const highBias = notes.cpaBias && notes.cpaBias > 1.3;
                const isSaturated = publishedGeoIds.has(opp.geoTargetId);
                // Profit from agentNotes (preferred) or fall back to score
                const profitGbp = notes.expectedMonthlyProfitGbp ?? opp.score;
                const cpaGbp = notes.estimatedCpaGbp;
                const convRate = notes.estimatedConvRate;
                const afterHoursGap = notes.afterHoursGap;
                const impressionShare = notes.ourImpressionShare;
                // Operational confidence: false = no platform data yet (1.0 default, optimistic)
                const opFactor = notes.operationalEfficiencyFactor ?? 1.0;
                const modelVerified = notes.modelConfidenceVerified ?? false;
                const rowClass = london
                  ? "bg-gray-50 opacity-60"
                  : isSaturated
                  ? "bg-green-50"
                  : "hover:bg-gray-50";

                return (
                  <Fragment key={opp.id}>
                    <tr className={rowClass}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
                            className={`hover:underline text-left ${london ? "text-gray-400" : "text-blue-600"}`}
                          >
                            {opp.geoLabel}
                          </button>
                          {london && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                              Manual only
                            </span>
                          )}
                          {isSaturated && !london && (
                            <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded">
                              Live ✓
                            </span>
                          )}
                          {highBias && (
                            <span
                              className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded"
                              title={`Actual CPC £${notes.actualCpcGbp?.toFixed(2)} vs predicted £${notes.predictedCpcGbp?.toFixed(2)} — running ${((notes.cpaBias ?? 1) * 100 - 100).toFixed(0)}% hotter`}
                            >
                              ⚠ CPC hotter
                            </span>
                          )}
                          {afterHoursGap && (
                            <span
                              className="text-xs bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded"
                              title="After-hours gap detected — competitors day-parting significantly. 24/7 platform advantage."
                            >
                              🌙 After-hours
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        <span
                          className={profitGbp >= 500 ? "text-green-700" : profitGbp >= 100 ? "text-gray-900" : "text-gray-500"}
                          title={convRate ? `Conv rate: ${(convRate * 100).toFixed(1)}%${!modelVerified ? " · Operational data not yet available — estimate is optimistic" : ""}` : undefined}
                        >
                          £{profitGbp.toFixed(0)}
                        </span>
                        {!modelVerified && (
                          <span
                            className="ml-1 text-xs text-gray-400"
                            title="Model confidence: unverified — no operational data (spam rate, dispatch success, etc.) yet available for this city. Estimate assumes ideal conditions."
                          >
                            ~
                          </span>
                        )}
                        {modelVerified && opFactor < 0.85 && (
                          <span
                            className="ml-1 text-xs text-orange-500"
                            title={`Operational efficiency: ${(opFactor * 100).toFixed(0)}% — platform data shows meaningful losses to spam/dispatch/cancellations`}
                          >
                            ×{opFactor.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm">
                        {cpaGbp != null ? (
                          <span
                            className={cpaGbp <= 40 ? "text-green-700" : cpaGbp <= 80 ? "text-gray-700" : "text-orange-700"}
                            title="Estimated cost per acquisition at median CPC"
                          >
                            £{cpaGbp.toFixed(0)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        £{opp.medianCpcGbp.toFixed(2)}
                        {(() => {
                          const n = parseAgentNotes(opp.agentNotes);
                          if (n.usingFallbackCpc) {
                            return <span className="ml-1 text-amber-600 text-xs" title="Estimated — Keyword Planner returned 0 bids (test token)">~est</span>;
                          }
                          if (opp.medianCpcGbp < 2.0) {
                            return <span className="ml-1 text-green-600 text-xs">✓</span>;
                          }
                          return null;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">
                        {estClicksPerDay(opp.medianCpcGbp)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${TIER_COLORS[opp.competitionTier]}`}>
                          {opp.competitionTier}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {opp.totalMonthlySearches.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{opp.locksmithCount}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[opp.status]}`}>
                          {opp.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        {!london && opp.kind === "COVERAGE" && opp.status !== "DRAFTED" && opp.status !== "DISMISSED" && (
                          <button
                            onClick={() => draftOpportunity(opp)}
                            disabled={actionBusy === opp.id}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {actionBusy === opp.id ? "…" : "Generate draft"}
                          </button>
                        )}
                        {opp.status === "DRAFTED" && opp.draftId && (
                          <Link
                            href={`/admin/integrations/google-ads/drafts/${opp.draftId}`}
                            className="px-2 py-1 text-xs bg-green-100 text-green-900 rounded hover:bg-green-200"
                          >
                            View draft
                          </Link>
                        )}
                        {opp.status !== "DISMISSED" && !london && (
                          <button
                            onClick={() => dismissOpportunity(opp)}
                            disabled={actionBusy === opp.id}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === opp.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="flex gap-8 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">
                                Top keywords (geo {opp.geoTargetId})
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {opp.topKeywords.slice(0, 10).map((k) => {
                                  const sb = stabilityBadge(k);
                                  return (
                                    <div
                                      key={k.text}
                                      className="flex justify-between text-xs bg-white rounded px-2 py-1 border"
                                    >
                                      <span className="font-mono flex items-center gap-1">
                                        {k.isEmergencyIntent && <span title="Emergency intent">🚨</span>}
                                        <span className={sb.cls} title={sb.label}>{sb.icon}</span>
                                        {k.text}
                                      </span>
                                      <span className="text-gray-500 text-right">
                                        {k.monthlySearches.toLocaleString()} · £{k.cpcGbp.toFixed(2)}
                                        {k.profitPerClick != null && (
                                          <span
                                            className={k.profitPerClick > 0 ? " text-green-600 font-semibold" : " text-red-500"}
                                            title={`Raw profit/click · stability weight: ${k.stabilityWeight?.toFixed(2) ?? "0.25"}`}
                                          >
                                            {" "}·{" "}
                                            {k.profitPerClick >= 0 ? "+" : ""}£{k.profitPerClick.toFixed(2)}/click
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex flex-col gap-4 shrink-0 w-64">
                              {/* Profit model summary */}
                              <div>
                                <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">
                                  Profit model
                                </h4>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Est. monthly profit</span>
                                    <span className="font-mono font-bold text-green-700">£{profitGbp.toFixed(0)}</span>
                                  </div>
                                  {cpaGbp != null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Est. CPA</span>
                                      <span className={`font-mono ${cpaGbp <= 40 ? "text-green-700" : cpaGbp <= 80 ? "text-gray-700" : "text-orange-700"}`}>
                                        £{cpaGbp.toFixed(0)}
                                      </span>
                                    </div>
                                  )}
                                  {convRate != null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Conv rate used</span>
                                      <span className="font-mono">{(convRate * 100).toFixed(1)}%
                                        {notes.actualConvRate != null && (
                                          <span className="text-green-600 ml-1">(live data)</span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {notes.emergencyIntentFraction != null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Emergency intent</span>
                                      <span className="font-mono">{(notes.emergencyIntentFraction * 100).toFixed(0)}% of keywords</span>
                                    </div>
                                  )}
                                  {impressionShare != null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Our impression share</span>
                                      <span className="font-mono">{(impressionShare * 100).toFixed(1)}%</span>
                                    </div>
                                  )}
                                  {afterHoursGap && (
                                    <div className="mt-1 rounded bg-indigo-50 border border-indigo-200 p-1.5 text-indigo-800">
                                      🌙 <strong>After-hours gap</strong> — competitors reduce IS after 20:00.
                                      24/7 platform has structural advantage here.
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Operational efficiency panel */}
                              <div>
                                <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">
                                  Operational confidence
                                </h4>
                                {!modelVerified ? (
                                  <div className="rounded bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-800">
                                    <strong>No operational data yet.</strong>
                                    <br />
                                    Est. profit assumes ideal conditions (no spam leads, 100% dispatch success, 0% cancellations).
                                    Connect platform job data to get a realistic discount.
                                    <br />
                                    <span className="text-yellow-600 text-xs mt-1 block">
                                      Fields needed: spam lead rate, missed call rate, dispatch success rate, cancellation rate, refund rate.
                                    </span>
                                  </div>
                                ) : (
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Operational factor</span>
                                      <span className={`font-mono font-bold ${opFactor >= 0.85 ? "text-green-700" : opFactor >= 0.65 ? "text-orange-600" : "text-red-600"}`}>
                                        {(opFactor * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <p className="text-gray-400 text-xs">
                                      Actual realised profit ≈ £{(profitGbp).toFixed(0)} (already applied above).
                                      Pre-discount gross: £{opFactor > 0 ? (profitGbp / opFactor).toFixed(0) : "—"}.
                                    </p>
                                  </div>
                                )}
                              </div>

                              {notes.usingFallbackCpc && (
                                <div className="rounded bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                                  <strong>Estimated CPC</strong><br />
                                  Keyword Planner returned 0 bids — showing industry benchmarks instead.
                                  Activate a production developer token to get live auction prices.
                                </div>
                              )}
                              {(notes.competitorDomains ?? []).length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold uppercase text-gray-600 mb-1">
                                    Auction co-occurrence
                                  </h4>
                                  <p className="text-xs text-gray-500 mb-1">
                                    Domains appearing in the same auction slots (Auction Insights).
                                    Not the same as their keyword list or bid strategy.
                                  </p>
                                  <ul className="space-y-0.5">
                                    {(notes.competitorDomains ?? []).slice(0, 6).map((d) => (
                                      <li key={d} className="text-xs text-blue-700 font-mono truncate">{d}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {notes.cpaBias && (
                                <div>
                                  <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">
                                    Live campaign feedback
                                  </h4>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Predicted CPC</span>
                                      <span className="font-mono">£{notes.predictedCpcGbp?.toFixed(2) ?? "—"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Actual CPC</span>
                                      <span className={`font-mono font-bold ${(notes.cpaBias ?? 1) > 1.1 ? "text-orange-600" : "text-green-700"}`}>
                                        £{notes.actualCpcGbp?.toFixed(2) ?? "—"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">CPA bias</span>
                                      <span className={`font-mono ${(notes.cpaBias ?? 1) > 1.1 ? "text-orange-600" : "text-green-700"}`}>
                                        {notes.cpaBias?.toFixed(2)}×
                                      </span>
                                    </div>
                                    {notes.convRateBias != null && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Conv rate bias</span>
                                        <span className={`font-mono ${(notes.convRateBias ?? 1) > 1.0 ? "text-green-600" : "text-orange-600"}`}>
                                          {notes.convRateBias?.toFixed(2)}×
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Sample days</span>
                                      <span className="font-mono">{notes.sampleDays ?? "—"}</span>
                                    </div>
                                    {notes.sampledAt && (
                                      <p className="text-gray-400 text-xs mt-1">
                                        Sampled {new Date(notes.sampledAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          {london && (
                            <p className="mt-3 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                              🚫 London borough — national chain competition (£5–15/click). Campaigns here must be created manually after deliberate admin decision.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
        <span><strong>Est. Profit/mo ~</strong> = optimistic estimate (no operational data) · <strong>×0.XX</strong> = efficiency discount applied</span>
        <span><strong>Est. CPA</strong> = median CPC ÷ conv rate · green ≤£40 · orange &gt;£80</span>
        <span>🆕 = keyword first scan (heavily discounted) · ⚡ = building history · ✓ = stable (4+ scans)</span>
        <span>🌙 After-hours = competitors day-part after 20:00, 24/7 platform advantage</span>
        <span>🚨 = emergency intent keyword</span>
        <span>~est CPC = industry benchmark (test token) · ⚠ CPC hotter = running &gt;30% above prediction</span>
        <span>Live ✓ = published campaign · ~Clicks/day = £10/day budget estimate</span>
      </div>
    </div>
  );
}
