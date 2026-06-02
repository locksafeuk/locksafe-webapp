"use client";

/**
 * Admin → Google Ads → Performance Dashboard
 *
 * Summary cards + per-campaign table with CPA colour coding.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CampaignPerf } from "@/app/api/admin/google-ads/performance/route";

interface Summary {
  totalSpend: number;
  totalClicks: number;
  totalConversions: number;
  avgCpa: number;
  totalRoas?: number;
}

interface PerfData {
  campaigns: CampaignPerf[];
  summary: Summary;
  asOf: string;
  apiError?: string;
  noAccount?: boolean;
}

function fmtGbp(n: number): string { return `£${n.toFixed(2)}`; }
function fmtCtr(n: number): string { return `${(n * 100).toFixed(1)}%`; }
function fmtIs(n: number): string { return n > 0 ? `${(n * 100).toFixed(0)}%` : "—"; }
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function CpaColor({ cpa }: { cpa: number }) {
  const cls = cpa === 0
    ? "text-gray-400"
    : cpa < 30
    ? "text-green-700 font-medium"
    : cpa < 60
    ? "text-orange-600 font-medium"
    : "text-red-600 font-bold";
  return <span className={cls}>{cpa === 0 ? "—" : fmtGbp(cpa)}</span>;
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border p-4 space-y-1">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function PerformancePage() {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/google-ads/performance?days=${days}`);
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Performance Dashboard</h1>
          <p className="text-sm text-gray-500">Campaign metrics · last {days} days</p>
        </div>
        <div className="flex items-center gap-3">
          {data?.asOf && <span className="text-xs text-gray-400">Updated {timeAgo(data.asOf)}</span>}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded border px-2 py-1 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="button" onClick={load} disabled={loading} className="rounded border px-3 py-1.5 text-sm disabled:opacity-50">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Nav */}
      <div className="flex gap-4 text-sm border-b pb-2">
        <Link href="/admin/integrations/google-ads/drafts" className="text-gray-500 hover:text-gray-900">Drafts</Link>
        <Link href="/admin/integrations/google-ads/search-terms" className="text-gray-500 hover:text-gray-900">Search Terms</Link>
        <span className="font-medium border-b-2 border-blue-600 pb-1">Performance</span>
        <Link href="/admin/integrations/google-ads/negative-lists" className="text-gray-500 hover:text-gray-900">Negative Lists</Link>
      </div>

      {data?.apiError && (
        <div className="rounded border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          {data.apiError.includes("NOT_AUTHENTICATED") || data.apiError.includes("PERMISSION_DENIED")
            ? "Google Ads API not yet authorised. Connect via OAuth in the Integration settings."
            : data.apiError}
        </div>
      )}

      {data?.noAccount && (
        <div className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          No Google Ads account connected.{" "}
          <Link href="/admin/integrations/google-ads" className="underline">Connect one here.</Link>
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Total Spend" value={fmtGbp(data.summary.totalSpend)} sub={`last ${days}d`} />
          <SummaryCard label="Total Clicks" value={data.summary.totalClicks.toLocaleString()} />
          <SummaryCard label="Conversions" value={data.summary.totalConversions.toLocaleString()} />
          <SummaryCard
            label="Avg CPA"
            value={data.summary.avgCpa > 0 ? fmtGbp(data.summary.avgCpa) : "—"}
            sub={data.summary.avgCpa > 0 ? (data.summary.avgCpa < 30 ? "Good" : data.summary.avgCpa < 60 ? "Moderate" : "High") : "No conversions yet"}
          />
          <SummaryCard
            label="Total ROAS"
            value={data.summary.totalRoas && data.summary.totalRoas > 0 ? `${data.summary.totalRoas.toFixed(2)}x` : "—"}
          />
        </div>
      )}

      {/* CPA legend */}
      <div className="text-xs text-gray-500 flex gap-4">
        <span><span className="text-green-700 font-medium">Green CPA</span> = &lt;£30</span>
        <span><span className="text-orange-600 font-medium">Orange CPA</span> = £30–60</span>
        <span><span className="text-red-600 font-bold">Red CPA</span> = &gt;£60</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading campaign data…</p>
      ) : !data || data.campaigns.length === 0 ? (
        <div className="rounded border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
          No campaign data yet. This is normal if your Google Ads developer token is pending approval or no campaigns have spent budget in the selected period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Spend</th>
                <th className="py-2 pr-3 text-right">Impr.</th>
                <th className="py-2 pr-3 text-right">Clicks</th>
                <th className="py-2 pr-3 text-right">CTR</th>
                <th className="py-2 pr-3 text-right">Conv.</th>
                <th className="py-2 pr-3 text-right">CPA</th>
                <th className="py-2 pr-3 text-right">ROAS</th>
                <th className="py-2 text-right">Impr. Share</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.campaigns.map((c) => {
                const spend = c.costMicros / 1_000_000;
                const cpa = c.conversions > 0 ? spend / c.conversions : 0;
                const roas = spend > 0 ? c.conversionsValue / spend : 0;
                return (
                  <tr key={c.campaignId}>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{c.campaignName}</span>
                      {c.draftId && (
                        <Link href={`/admin/integrations/google-ads/drafts/${c.draftId}`} className="block text-xs text-blue-500 hover:underline">
                          View draft
                        </Link>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-1.5 py-0.5 text-xs ${c.status === "ENABLED" ? "bg-green-100 text-green-700" : c.status === "PAUSED" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">{fmtGbp(spend)}</td>
                    <td className="py-2 pr-3 text-right text-xs">{c.impressions.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-xs">{c.clicks.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-xs">{fmtCtr(c.ctr)}</td>
                    <td className="py-2 pr-3 text-right">{c.conversions}</td>
                    <td className="py-2 pr-3 text-right"><CpaColor cpa={cpa} /></td>
                    <td className="py-2 pr-3 text-right text-xs">{roas > 0 ? `${roas.toFixed(2)}x` : "—"}</td>
                    <td className="py-2 text-right text-xs">{fmtIs(c.searchImpressionShare)}</td>
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
