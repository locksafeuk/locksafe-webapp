/**
 * /admin/google-ads/coverage — visualise §16 coverage health.
 *
 * Three blocks:
 *   1. UK coverage map — eligible (green) / singletons (yellow) / empty (red)
 *   2. Per-live-campaign §16 status — every PUBLISHED+enabled campaign with
 *      its geo target and whether the coverage gate still holds
 *   3. "Run drift check now" — fires the same logic as the daily cron and
 *      surfaces any auto-fixes / alerts
 */

"use client";

import { useEffect, useState } from "react";

interface CityEntry {
  cityName:       string;
  geoId?:         string;
  locksmithCount?: number;
}
interface CampaignStatus {
  id:               string;
  name:             string;
  dailyBudget:      number;
  geoTargets:       string[];
  finalUrl:         string | null;
  googleCampaignId: string | null;
  coverageOk:       boolean;
  breachReason:     string | null;
}
interface CoverageResp {
  runAt: string;
  map: {
    totalCities:    number;
    eligibleCount:  number;
    singletonCount: number;
    emptyCount:     number;
    eligible:       CityEntry[];
    singletons:     CityEntry[];
    empty:          CityEntry[];
  };
  campaigns: {
    total:       number;
    breachCount: number;
    perCampaign: CampaignStatus[];
  };
}
interface DriftResp {
  startedAt:  string;
  finishedAt: string;
  statusDrift:   { fixedCount: number; fixed: Array<{ id: string; name: string; budget: number; googleStatus: string }>; error: string | null };
  coverageDrift: { breachCount: number; breaches: Array<{ id: string; name: string; reason: string }>; error: string | null };
  eligibilitySnapshot: { eligibleCount?: number; eligibleCities?: string[] } | { error: string };
  alertsFired:   string[];
}

export default function CoveragePage() {
  const [data,    setData]    = useState<CoverageResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [drift,   setDrift]   = useState<DriftResp | null>(null);
  const [driftRunning, setDriftRunning] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/google-ads/coverage", {
        credentials: "include",
        cache:       "no-store",
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      setData(await r.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runDriftCheck = async () => {
    if (!confirm(
      "Run the drift check now? It will (a) auto-stamp pausedAt on any " +
      "draft Google has paused, (b) re-verify §16 coverage on every live " +
      "campaign, (c) Telegram-alert on any breach. Safe to re-run.",
    )) return;
    setDriftRunning(true);
    setDrift(null);
    try {
      const r = await fetch("/api/admin/google-ads/coverage", {
        method:      "POST",
        credentials: "include",
      });
      setDrift(await r.json());
      await load();
    } finally {
      setDriftRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Coverage map (§16)</h1>
          <p className="text-sm text-gray-600 mt-1">
            UK city coverage under the §16 rule (≥2 active locksmiths within
            10 miles). Eligible cities can host Google Ads campaigns.
            Singletons are one-locksmith-away from eligibility. Recruitment
            is the highest-leverage growth move.
          </p>
        </div>
        <button
          onClick={runDriftCheck}
          disabled={driftRunning}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {driftRunning ? "Running…" : "Run drift check now"}
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {data && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <Stat label="Cities scanned"   value={data.map.totalCities}    color="gray" />
            <Stat label="Eligible (≥2)"    value={data.map.eligibleCount}  color="emerald" />
            <Stat label="Singletons (1)"   value={data.map.singletonCount} color="yellow" />
            <Stat label="Zero coverage"    value={data.map.emptyCount}     color="red" />
          </div>

          {/* Eligible cities */}
          <Section title="Eligible cities" subtitle="Coverage gate ≥2 locksmiths × 10mi. New drafts can target any of these." color="emerald">
            <div className="flex flex-wrap gap-1.5">
              {data.map.eligible.map((c) => (
                <span key={c.geoId} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-900 rounded font-mono">
                  {c.cityName} <span className="opacity-60">×{c.locksmithCount}</span>
                </span>
              ))}
              {data.map.eligible.length === 0 && (
                <p className="text-sm text-gray-500">No eligible cities — recruit a 2nd locksmith in a singleton city to unlock.</p>
              )}
            </div>
          </Section>

          {/* Singletons */}
          <Section
            title={`Singletons — one locksmith away from eligible (${data.map.singletonCount})`}
            subtitle="The highest-leverage recruitment targets. Adding ONE locksmith in any of these unlocks the entire market."
            color="yellow"
          >
            <div className="flex flex-wrap gap-1.5">
              {data.map.singletons.map((c) => (
                <span key={c.geoId} className="px-2 py-1 text-xs bg-yellow-100 text-yellow-900 rounded font-mono">
                  {c.cityName}
                </span>
              ))}
            </div>
          </Section>

          {/* Zero coverage — collapsed by default since there's many */}
          <Section
            title={`Zero coverage cities (${data.map.emptyCount})`}
            subtitle="No locksmiths in range. Recruit 2 to make eligible. Not surfaced to the autonomous draft path."
            color="red"
            collapsedByDefault
          >
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {data.map.empty.map((c) => (
                <span key={c.cityName} className="px-2 py-0.5 text-[10px] bg-red-50 text-red-800 rounded">
                  {c.cityName}
                </span>
              ))}
            </div>
          </Section>

          {/* Per-campaign coverage status */}
          <Section
            title={`Live campaigns — §16 status (${data.campaigns.total} live, ${data.campaigns.breachCount} breached)`}
            subtitle="Coverage re-evaluated NOW against current active locksmiths. Breaches mean the campaign is spending into cities we can no longer fulfil."
            color={data.campaigns.breachCount > 0 ? "red" : "emerald"}
          >
            {data.campaigns.total === 0 && (
              <p className="text-sm text-gray-500">No live campaigns. All are paused or unpublished.</p>
            )}
            {data.campaigns.total > 0 && (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr className="text-left">
                      <th className="p-2">Campaign</th>
                      <th className="p-2 text-right">£/day</th>
                      <th className="p-2">Geo targets</th>
                      <th className="p-2">Coverage</th>
                      <th className="p-2">Breach reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.perCampaign.map((c) => (
                      <tr key={c.id} className={`border-t ${c.coverageOk ? "" : "bg-red-50"}`}>
                        <td className="p-2 font-mono">{c.name}</td>
                        <td className="p-2 text-right">£{c.dailyBudget}</td>
                        <td className="p-2 font-mono text-[10px] max-w-xs truncate">{c.geoTargets.join(", ")}</td>
                        <td className="p-2">{c.coverageOk ? "✅ OK" : "❌ BREACH"}</td>
                        <td className="p-2 text-[11px]">{c.breachReason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {drift && (
            <Section title="Last drift-check result" color="gray">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">Status drift auto-fixed</h4>
                  <p className="text-xs text-gray-600 mb-1">Drafts paused on Google but PUBLISHED in DB — pausedAt stamped now.</p>
                  {drift.statusDrift.fixedCount === 0 && <p className="text-sm text-gray-500">None.</p>}
                  <ul className="text-xs space-y-1">
                    {drift.statusDrift.fixed.map((d) => (
                      <li key={d.id}>• {d.name} (£{d.budget}/day, Google={d.googleStatus})</li>
                    ))}
                  </ul>
                  {drift.statusDrift.error && <p className="text-xs text-red-600 mt-1">Error: {drift.statusDrift.error}</p>}
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Coverage breaches found</h4>
                  <p className="text-xs text-gray-600 mb-1">Live campaigns now below the §16 floor.</p>
                  {drift.coverageDrift.breachCount === 0 && <p className="text-sm text-gray-500">None.</p>}
                  <ul className="text-xs space-y-1">
                    {drift.coverageDrift.breaches.map((b) => (
                      <li key={b.id}>• {b.name} — {b.reason}</li>
                    ))}
                  </ul>
                  {drift.coverageDrift.error && <p className="text-xs text-red-600 mt-1">Error: {drift.coverageDrift.error}</p>}
                </div>
              </div>
              <p className="text-[10px] mt-2 text-gray-500">
                {drift.alertsFired.length} Telegram alerts fired · Ran at {new Date(drift.startedAt).toLocaleString("en-GB")}
              </p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  const c: Record<string, string> = {
    gray:    "bg-gray-50 text-gray-900",
    emerald: "bg-emerald-50 text-emerald-900",
    yellow:  "bg-yellow-50 text-yellow-900",
    red:     "bg-red-50 text-red-900",
  };
  return (
    <div className={`border rounded p-3 ${c[color] ?? ""}`}>
      <div className="text-[10px] uppercase opacity-70">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Section({ title, subtitle, color, children, collapsedByDefault }: {
  title: string;
  subtitle?: string;
  color: string;
  children: React.ReactNode;
  collapsedByDefault?: boolean;
}) {
  const [open, setOpen] = useState(!collapsedByDefault);
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-200",
    yellow:  "border-yellow-200",
    red:     "border-red-200",
    gray:    "border-gray-200",
  };
  return (
    <div className={`mb-6 border rounded ${colorMap[color] ?? ""}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-3 hover:bg-gray-50"
      >
        <div className="flex justify-between items-baseline">
          <h2 className="text-base font-semibold">{title}</h2>
          <span className="text-[10px] text-gray-500">{open ? "▲" : "▼"}</span>
        </div>
        {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
      </button>
      {open && <div className="p-3 pt-0">{children}</div>}
    </div>
  );
}
