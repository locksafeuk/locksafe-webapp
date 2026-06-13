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
interface TimeRow {
  source:       string;
  n:            number;
  medianHours:  number;
  p75Hours:     number;
  p90Hours:     number;
  bucketLte1h:  number;
  bucketLte24h: number;
  bucketLte7d:  number;
  bucketLte30d: number;
  bucketGt30d:  number;
}
interface AiEngineRow {
  engine:              string;
  label:               string;
  firstTouchCustomers: number;
  lastTouchCustomers:  number;
  firstTouchJobs:      number;
  lastTouchJobs:       number;
  firstTouchRevenue:   number;
  lastTouchRevenue:    number;
}
interface AiAssistant {
  byEngine: AiEngineRow[];
  totals: {
    firstTouchCustomers: number;
    lastTouchCustomers:  number;
    firstTouchJobs:      number;
    lastTouchJobs:       number;
    firstTouchRevenue:   number;
    lastTouchRevenue:    number;
  };
}
interface Report {
  windowDays: number;
  totals: { customers: number; jobs: number; revenue: number };
  aiAssistant?: AiAssistant;
  bySource: BySourceRow[];
  crossChannel: CrossRow[];
  timeToPurchase: TimeRow[];
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  if (h < 168) return `${(h / 24).toFixed(1)}d`;
  if (h < 720) return `${(h / 24).toFixed(0)}d`;
  return `${(h / (24 * 30)).toFixed(1)}mo`;
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

          {/* ── AI Assistant channel (ChatGPT / Gemini / …) ── */}
          {report.aiAssistant && (
            <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50/60 p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-semibold text-amber-900">
                  🤖 AI Assistant channel
                </h2>
                <span className="text-xs text-amber-700">
                  first-touch (discovery) — the &quot;lean off Google Ads&quot; metric
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <Stat label="AI-referred customers" value={report.aiAssistant.totals.firstTouchCustomers} />
                <Stat label="AI-referred jobs" value={report.aiAssistant.totals.firstTouchJobs} />
                <Stat label="AI-referred revenue" value={`£${report.aiAssistant.totals.firstTouchRevenue.toFixed(2)}`} />
              </div>

              {report.aiAssistant.byEngine.length > 0 ? (
                <div className="overflow-x-auto border border-amber-200 rounded bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-100/60">
                      <tr className="text-left">
                        <th className="p-2">Engine</th>
                        <th className="p-2 text-right">FT customers</th>
                        <th className="p-2 text-right">FT jobs</th>
                        <th className="p-2 text-right">FT revenue</th>
                        <th className="p-2 text-right">LT revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.aiAssistant.byEngine.map((e) => (
                        <tr key={e.engine} className="border-t border-amber-100">
                          <td className="p-2 font-medium">{e.label}</td>
                          <td className="p-2 text-right">{e.firstTouchCustomers}</td>
                          <td className="p-2 text-right">{e.firstTouchJobs}</td>
                          <td className="p-2 text-right">£{e.firstTouchRevenue.toFixed(2)}</td>
                          <td className="p-2 text-right">£{e.lastTouchRevenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-amber-800">
                  No AI-referred sessions detected yet in this window. New ChatGPT/Gemini
                  click-throughs will appear here automatically.
                </p>
              )}

              <p className="text-[11px] text-amber-700 mt-3 leading-relaxed">
                Counts <strong>clicks</strong> from AI assistants (referrer = chatgpt.com,
                gemini.google.com, perplexity.ai, …). AI search is mostly <strong>zero-click</strong>,
                so this is a <strong>floor</strong>, not the full influence — many who read an AI
                answer call you directly (shows as &quot;direct&quot;). Gemini answers inside Google
                Search (AI Overviews) look like organic Google and can&apos;t be split out here.
                Pair with the citation tracker + &quot;how did you hear about us&quot; for the rest.
              </p>
            </div>
          )}

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

          <h2 className="text-lg font-semibold mt-8 mb-2">
            Time from first touch → booking
          </h2>
          <p className="text-sm text-gray-500 mb-3">
            How long it takes a customer to convert after their first known
            touch. Median + p75 + p90 by source. Short = high-intent traffic
            (emergency calls). Long = awareness journey (assist channels).
          </p>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="p-2">First-touch source</th>
                  <th className="p-2 text-right">Jobs</th>
                  <th className="p-2 text-right">Median</th>
                  <th className="p-2 text-right">p75</th>
                  <th className="p-2 text-right">p90</th>
                  <th className="p-2 text-right">≤1h</th>
                  <th className="p-2 text-right">≤24h</th>
                  <th className="p-2 text-right">≤7d</th>
                  <th className="p-2 text-right">≤30d</th>
                  <th className="p-2 text-right">&gt;30d</th>
                </tr>
              </thead>
              <tbody>
                {(report.timeToPurchase ?? []).map((r) => (
                  <tr key={r.source} className="border-t">
                    <td className="p-2 font-mono">{r.source}</td>
                    <td className="p-2 text-right">{r.n}</td>
                    <td className="p-2 text-right">{fmtHours(r.medianHours)}</td>
                    <td className="p-2 text-right">{fmtHours(r.p75Hours)}</td>
                    <td className="p-2 text-right">{fmtHours(r.p90Hours)}</td>
                    <td className="p-2 text-right">{r.bucketLte1h}</td>
                    <td className="p-2 text-right">{r.bucketLte24h}</td>
                    <td className="p-2 text-right">{r.bucketLte7d}</td>
                    <td className="p-2 text-right">{r.bucketLte30d}</td>
                    <td className="p-2 text-right">{r.bucketGt30d}</td>
                  </tr>
                ))}
                {(report.timeToPurchase ?? []).length === 0 && (
                  <tr><td colSpan={10} className="p-4 text-center text-gray-500">
                    No time-to-purchase data yet — run backfill to compute on existing jobs.
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
