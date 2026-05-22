"use client";

/**
 * Admin · Google Ads · Opportunity Scout
 *
 * Surfaces the latest weekly scout output:
 *   • Coverage tab — cities where we already have locksmiths, ranked by
 *     score (volume / (CPC × competition)). Action: spin a draft.
 *   • Recruit-Here tab — cities with strong demand but ZERO locksmiths.
 *     Action: link to recruitment outreach (manual for now).
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tier = "LOW" | "MEDIUM" | "HIGH";
type Status = "NEW" | "REVIEWED" | "DRAFTED" | "DISMISSED";
type Kind = "COVERAGE" | "RECRUIT";

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

export default function OpportunityScoutPage() {
  const [data, setData] = useState<ScanResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<Kind>("COVERAGE");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

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

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const rows = useMemo(() => {
    if (!data) return [];
    return tab === "COVERAGE" ? data.coverage : data.recruit;
  }, [data, tab]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Opportunity Scout</h1>
          <p className="text-sm text-gray-600 mt-1">
            Weekly UK-wide scan for cheap, under-served Google Ads markets.
            Score = monthly searches ÷ (CPC × competition).
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
          <p className="text-sm mt-1">Try running a scan.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">City</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-right">Median CPC</th>
                <th className="px-3 py-2 text-center">Competition</th>
                <th className="px-3 py-2 text-right">Monthly searches</th>
                <th className="px-3 py-2 text-right">Locksmiths</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((opp) => (
                <Fragment key={opp.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
                        className="text-blue-600 hover:underline text-left"
                      >
                        {opp.geoLabel}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold">
                      {opp.score.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      £{opp.medianCpcGbp.toFixed(2)}
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
                      {opp.kind === "COVERAGE" && opp.status !== "DRAFTED" && opp.status !== "DISMISSED" && (
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
                      {opp.status !== "DISMISSED" && (
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
                      <td colSpan={8} className="px-6 py-4">
                        <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2">
                          Top keywords (geo {opp.geoTargetId})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {opp.topKeywords.slice(0, 10).map((k) => (
                            <div
                              key={k.text}
                              className="flex justify-between text-xs bg-white rounded px-2 py-1 border"
                            >
                              <span className="font-mono">{k.text}</span>
                              <span className="text-gray-500">
                                {k.monthlySearches.toLocaleString()} · £{k.cpcGbp.toFixed(2)} · idx{" "}
                                {k.competitionIndex}
                              </span>
                            </div>
                          ))}
                        </div>
                        {opp.agentNotes && (
                          <p className="mt-3 text-xs text-gray-600 italic">{opp.agentNotes}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
