/**
 * /admin/attribution/touch-report — first-touch vs last-touch dashboard.
 *
 * Companion to the existing /admin/attribution page. Two reports:
 *   1. By source — first-touch and last-touch revenue per source.
 *   2. Cross-channel mix — first → last source transitions (assist
 *      reporting). "google → direct" means Google paid for the click
 *      but direct closed the sale.
 */

"use client";

import { useEffect, useState } from "react";

interface BySourceRow {
  source:              string;
  firstTouchCustomers: number;
  lastTouchCustomers:  number;
  firstTouchJobs:      number;
  lastTouchJobs:       number;
  firstTouchRevenue:   number;
  lastTouchRevenue:    number;
}
interface CrossRow {
  firstSource: string;
  lastSource:  string;
  count:       number;
  revenue:     number;
}
interface Report {
  windowDays: number;
  totals: { customers: number; jobs: number; revenue: number };
  bySource: BySourceRow[];
  crossChannel: CrossRow[];
}

export default function TouchReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const load = async (d: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/attribution/touch-report?days=${d}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (r.ok) setReport(await r.json());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(days); }, [days]);

  const runBackfill = async () => {
    if (!confirm(
      "Run backfill on existing Customers/Locksmiths/Jobs? Stamps first+last "
      + "touch from UserSession history. Idempotent — safe to re-run.",
    )) return;
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const r = await fetch("/api/admin/attribution/backfill", {
        method: "POST",
        credentials: "include",
      });
      const j = await r.json();
      setBackfillResult(JSON.stringify(j.results, null, 2));
      await load(days);
    } catch (err) {
      setBackfillResult(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Touch report — first vs last</h1>
          <p className="text-sm text-gray-600">
            How customers find us (first-touch) vs which channel they convert on
            (last-touch). Cross-channel mix shows assist credit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={runBackfill}
            disabled={backfilling}
            className="px-3 py-1 text-sm bg-yellow-100 text-yellow-900 rounded hover:bg-yellow-200 disabled:opacity-50"
          >
            {backfilling ? "Backfilling…" : "Backfill history"}
          </button>
        </div>
      </div>

      {loading && <p>Loading…</p>}

      {report && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Customers" value={report.totals.customers} />
            <Stat label="Jobs" value={report.totals.jobs} />
            <Stat label="Revenue" value={`£${report.totals.revenue.toFixed(2)}`} />
          </div>

          <h2 className="text-lg font-semibold mb-2">By source</h2>
          <p className="text-sm text-gray-500 mb-3">
            Same source can appear on both sides — e.g. google may credit £400
            last-touch but assist £700 first-touch (meaning Google is the
            awareness engine).
          </p>
          <div className="overflow-x-auto border rounded mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="p-2">Source</th>
                  <th className="p-2 text-right">FT customers</th>
                  <th className="p-2 text-right">LT customers</th>
                  <th className="p-2 text-right">FT jobs</th>
                  <th className="p-2 text-right">LT jobs</th>
                  <th className="p-2 text-right">FT revenue</th>
                  <th className="p-2 text-right">LT revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.bySource.map((r) => (
                  <tr key={r.source} className="border-t">
                    <td className="p-2 font-mono">{r.source}</td>
                    <td className="p-2 text-right">{r.firstTouchCustomers}</td>
                    <td className="p-2 text-right">{r.lastTouchCustomers}</td>
                    <td className="p-2 text-right">{r.firstTouchJobs}</td>
                    <td className="p-2 text-right">{r.lastTouchJobs}</td>
                    <td className="p-2 text-right">£{r.firstTouchRevenue.toFixed(2)}</td>
                    <td className="p-2 text-right">£{r.lastTouchRevenue.toFixed(2)}</td>
                  </tr>
                ))}
                {report.bySource.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-gray-500">
                    No attributed activity yet — run backfill or wait for fresh customers.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="text-lg font-semibold mb-2">Cross-channel — first → last</h2>
          <p className="text-sm text-gray-500 mb-3">
            Jobs where the customer&apos;s first touch differs from their last
            touch. Strong &quot;google → direct&quot; means Google Ads pays for
            the click but direct closes — CMO credits Google.
          </p>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="p-2">First touch</th>
                  <th className="p-2">Last touch</th>
                  <th className="p-2 text-right">Jobs</th>
                  <th className="p-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.crossChannel.map((r) => (
                  <tr key={`${r.firstSource}::${r.lastSource}`} className="border-t">
                    <td className="p-2 font-mono">{r.firstSource}</td>
                    <td className="p-2 font-mono">→ {r.lastSource}</td>
                    <td className="p-2 text-right">{r.count}</td>
                    <td className="p-2 text-right">£{r.revenue.toFixed(2)}</td>
                  </tr>
                ))}
                {report.crossChannel.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-gray-500">
                    No cross-channel jobs in window.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {backfillResult && (
            <div className="mt-6 p-3 bg-gray-100 rounded">
              <h3 className="text-sm font-semibold mb-1">Backfill result</h3>
              <pre className="text-xs whitespace-pre-wrap">{backfillResult}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border rounded p-4 bg-white">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
