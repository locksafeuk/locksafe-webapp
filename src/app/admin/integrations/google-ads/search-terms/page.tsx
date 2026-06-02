"use client";

/**
 * Admin → Google Ads → Search Terms
 *
 * Shows search terms from the last 30 days with spend / conversion data.
 * Allows adding wasted terms as negatives directly from the table.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface SearchTermRow {
  term: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  costMicros: number;
  conversions: number;
  campaignId: string;
  campaignName: string;
  campaignResourceName?: string;
}

function fmtCost(micros: number): string {
  return `£${(micros / 1_000_000).toFixed(2)}`;
}
function fmtCtr(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SearchTermsPage() {
  const [terms, setTerms] = useState<SearchTermRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [addingTerm, setAddingTerm] = useState<string | null>(null);
  const [addedTerms, setAddedTerms] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/admin/google-ads/search-terms");
      const data = await res.json();
      if (!res.ok) { setApiError(data.error || "Failed to load"); return; }
      if (data.apiError) setApiError(data.apiError);
      setTerms(data.terms ?? []);
      setAsOf(data.asOf ?? null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Unique campaigns for filter
  const campaigns = Array.from(new Map(terms.map((t) => [t.campaignId, t.campaignName])).entries());

  const filtered = campaignFilter === "all"
    ? terms
    : terms.filter((t) => t.campaignId === campaignFilter);

  // Collect published campaign IDs for add-negative
  const allCampaignIds = [...new Set(terms.map((t) => t.campaignId))];

  async function addNegative(term: string) {
    setAddingTerm(term);
    setAddError(null);
    const targetIds = campaignFilter === "all" ? allCampaignIds : [campaignFilter];
    try {
      const res = await fetch("/api/admin/google-ads/search-terms/add-negative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, campaignIds: targetIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAddedTerms((prev) => new Set([...prev, term]));
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add negative");
    } finally {
      setAddingTerm(null);
    }
  }

  function rowColor(row: SearchTermRow): string {
    if (row.conversions > 0) return "bg-green-50";
    if (row.costMicros > 2_000_000) return "bg-red-50"; // > £2 with no conversions
    return "";
  }

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Search Terms Report</h1>
          <p className="text-sm text-gray-500">Last 30 days · impressions {">"}5</p>
        </div>
        <div className="flex items-center gap-3">
          {asOf && <span className="text-xs text-gray-400">Last updated {timeAgo(asOf)}</span>}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <Link href="/admin/integrations/google-ads/drafts" className="text-sm text-blue-600 hover:underline">
            ← Drafts
          </Link>
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-4 text-sm border-b pb-2">
        <Link href="/admin/integrations/google-ads/drafts" className="text-gray-500 hover:text-gray-900">Drafts</Link>
        <span className="font-medium border-b-2 border-blue-600 pb-1">Search Terms</span>
        <Link href="/admin/integrations/google-ads/performance" className="text-gray-500 hover:text-gray-900">Performance</Link>
        <Link href="/admin/integrations/google-ads/negative-lists" className="text-gray-500 hover:text-gray-900">Negative Lists</Link>
      </div>

      {apiError && (
        <div className="rounded border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          {apiError.includes("NOT_AUTHENTICATED") || apiError.includes("PERMISSION_DENIED")
            ? "Google Ads API not yet authorised. Connect via OAuth in the Integration settings."
            : apiError}
        </div>
      )}

      {addError && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{addError}</div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm">
          <span className="mr-2 text-gray-600">Campaign:</span>
          <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="rounded border px-2 py-1 text-sm">
            <option value="all">All campaigns</option>
            {campaigns.map(([id, nm]) => <option key={id} value={id}>{nm}</option>)}
          </select>
        </label>
        <span className="text-xs text-gray-500">{filtered.length} terms</span>
      </div>

      <div className="text-xs text-gray-500 flex gap-4">
        <span><span className="inline-block w-3 h-3 rounded bg-green-100 mr-1" />Has conversions</span>
        <span><span className="inline-block w-3 h-3 rounded bg-red-100 mr-1" />High cost + 0 conversions (wasted)</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading search terms…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          {terms.length === 0 ? "No search term data yet. Data appears after campaigns have been running for a few days." : "No terms match the current filter."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="py-2 pr-3">Search Term</th>
                <th className="py-2 pr-3 text-right">Impr.</th>
                <th className="py-2 pr-3 text-right">Clicks</th>
                <th className="py-2 pr-3 text-right">CTR</th>
                <th className="py-2 pr-3 text-right">Conv.</th>
                <th className="py-2 pr-3 text-right">Cost</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => {
                const isAdding = addingTerm === row.term;
                const isAdded = addedTerms.has(row.term);
                return (
                  <tr key={`${row.term}-${row.campaignId}`} className={rowColor(row)}>
                    <td className="py-2 pr-3 font-mono text-xs max-w-xs truncate">{row.term}</td>
                    <td className="py-2 pr-3 text-right text-xs">{row.impressions.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-xs">{row.clicks.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-xs">{fmtCtr(row.ctr)}</td>
                    <td className="py-2 pr-3 text-right text-xs">{row.conversions}</td>
                    <td className="py-2 pr-3 text-right text-xs font-medium">{fmtCost(row.costMicros)}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block rounded-full px-1.5 py-0.5 text-xs ${row.status === "ADDED" ? "bg-blue-100 text-blue-700" : row.status === "EXCLUDED" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-gray-500 max-w-xs truncate">{row.campaignName}</td>
                    <td className="py-2">
                      {isAdded ? (
                        <span className="text-xs text-green-600 font-medium">Added</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addNegative(row.term)}
                          disabled={isAdding || row.status === "EXCLUDED"}
                          className="rounded border px-2 py-0.5 text-xs hover:bg-red-50 disabled:opacity-40"
                        >
                          {isAdding ? "Adding…" : "Add Negative"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
