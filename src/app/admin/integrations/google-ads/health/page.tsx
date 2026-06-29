"use client";

/**
 * Google Ads campaign health dashboard.
 *
 * One-glance triage: every live-ish campaign side by side with:
 *   • Locksafe status + Google Ads live state
 *   • Landing-page health (HEAD check)
 *   • Last 7 days impressions / clicks / spend / conversions
 *   • A coloured "label" (GREEN / YELLOW / ORANGE / RED / GREY) the
 *     operator can scan in 2 seconds
 *
 * The /api/admin/google-ads/health endpoint does the joining + live
 * GAQL queries on each load. No client-side polling — operator clicks
 * Refresh when they want a fresh snapshot.
 */

import { useEffect, useState, useCallback } from "react";

interface HealthRow {
  id:                 string;
  name:               string;
  locksafeStatus:     string;
  dailyBudget:        number;
  publishedAt:        string | null;
  daysSincePublished: number | null;
  finalUrl:           string | null;
  googleCampaignId:   string | null;
  live:               "SERVING" | "DORMANT" | "PAUSED" | "REMOVED" | "UNKNOWN";
  liveCampaignStatus: string | null;
  enabledAdGroups:    number;
  totalAdGroups:      number;
  enabledAds:         number;
  totalAds:           number;
  rolling: {
    impressions: number;
    clicks:      number;
    spend:       number;
    conversions: number;
  };
  landing: {
    status: "ok" | "broken" | "skipped" | "unknown";
    code:   number | null;
  };
  label: "GREEN" | "YELLOW" | "ORANGE" | "RED" | "GREY";
  note:  string;
}

interface HealthResponse {
  generatedAt: string;
  rollingDays: number;
  totals: {
    campaigns: number;
    green: number; yellow: number; orange: number; red: number; grey: number;
    totalSpend: number; totalConv: number;
  };
  rows: HealthRow[];
}

const LABEL_STYLES: Record<HealthRow["label"], string> = {
  GREEN:  "bg-green-600 text-white border-green-700",
  YELLOW: "bg-yellow-400 text-black border-yellow-500",
  ORANGE: "bg-orange-500 text-white border-orange-600",
  RED:    "bg-red-600 text-white border-red-700",
  GREY:   "bg-gray-400 text-white border-gray-500",
};

const LIVE_STYLES: Record<HealthRow["live"], string> = {
  SERVING: "bg-green-100 text-green-900",
  DORMANT: "bg-yellow-100 text-yellow-900",
  PAUSED:  "bg-orange-100 text-orange-900",
  REMOVED: "bg-red-100 text-red-900",
  UNKNOWN: "bg-gray-100 text-gray-700",
};

const LANDING_STYLES: Record<HealthRow["landing"]["status"], string> = {
  ok:      "text-green-700",
  broken:  "text-red-700 font-semibold",
  skipped: "text-gray-500",
  unknown: "text-gray-500",
};

export default function GoogleAdsHealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/google-ads/health", {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Google Ads — Campaign Health
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Real-time view across every live-ish campaign. Joins Locksafe DB,
            Google Ads GAQL, and landing-page health checks. Rolling 7-day window.
          </p>
          {data && (
            <p className="text-xs text-slate-500 mt-2">
              Generated: {new Date(data.generatedAt).toLocaleString()}
              {" · "}
              {data.totals.campaigns} campaigns
              {" · "}
              total spend £{data.totals.totalSpend.toFixed(2)}
              {" · "}
              {data.totals.totalConv.toFixed(1)} conversions
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-blue-300"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* ── Summary chips ─────────────────────────────────────────────── */}
      {data && (
        <div className="flex flex-wrap gap-2 mb-6">
          {(["green", "yellow", "orange", "red", "grey"] as const).map((color) => {
            const count = data.totals[color];
            if (count === 0) return null;
            const label = color.toUpperCase() as HealthRow["label"];
            return (
              <span
                key={color}
                className={`text-xs px-3 py-1 rounded-full border ${LABEL_STYLES[label]}`}
              >
                {label}: {count}
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && data.rows.length === 0 && !loading && (
        <div className="text-slate-500 text-center py-10">
          No live-ish campaigns found.
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Campaign</th>
                <th className="text-left px-3 py-2 font-medium">Days</th>
                <th className="text-left px-3 py-2 font-medium">Locksafe</th>
                <th className="text-left px-3 py-2 font-medium">Live</th>
                <th className="text-left px-3 py-2 font-medium">Ad groups</th>
                <th className="text-left px-3 py-2 font-medium">Ads</th>
                <th className="text-right px-3 py-2 font-medium">Impr</th>
                <th className="text-right px-3 py-2 font-medium">Clicks</th>
                <th className="text-right px-3 py-2 font-medium">Spend</th>
                <th className="text-right px-3 py-2 font-medium">Conv</th>
                <th className="text-left px-3 py-2 font-medium">Landing</th>
                <th className="text-left px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${LABEL_STYLES[r.label]}`}>
                      {r.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`/admin/integrations/google-ads/drafts/${r.id}`}
                      className="font-medium text-slate-900 hover:text-blue-700 hover:underline"
                    >
                      {r.name}
                    </a>
                    <div className="text-xs text-slate-500">£{r.dailyBudget.toFixed(2)}/day</div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.daysSincePublished ?? "?"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-slate-700">{r.locksafeStatus}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded ${LIVE_STYLES[r.live]}`}>
                      {r.live}
                    </span>
                    {r.liveCampaignStatus && r.liveCampaignStatus !== "ENABLED" && (
                      <div className="text-xs text-slate-500 mt-0.5">{r.liveCampaignStatus}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.enabledAdGroups}/{r.totalAdGroups}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.enabledAds}/{r.totalAds}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">{r.rolling.impressions}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{r.rolling.clicks}</td>
                  <td className="px-3 py-2 text-right text-slate-700">£{r.rolling.spend.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{r.rolling.conversions.toFixed(1)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs ${LANDING_STYLES[r.landing.status]}`}>
                      {r.landing.status}
                      {r.landing.code !== null && ` (${r.landing.code})`}
                    </span>
                    {r.finalUrl && (
                      <div className="text-xs text-slate-400 truncate max-w-[180px]" title={r.finalUrl}>
                        {r.finalUrl.replace(/^https?:\/\//, "")}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 max-w-[260px]">
                    {r.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <div className="mt-6 text-xs text-slate-500 space-y-1">
        <p>
          <strong>Labels:</strong>{" "}
          <span className="text-green-700">GREEN</span> serving + converting · {" "}
          <span className="text-yellow-700">YELLOW</span> serving without conv, or dormant · {" "}
          <span className="text-orange-700">ORANGE</span> paused or broken landing · {" "}
          <span className="text-red-700">RED</span> removed on Google Ads · {" "}
          <span className="text-gray-500">GREY</span> unknown
        </p>
        <p>
          <strong>Live states:</strong>{" "}
          SERVING = campaign + ad group + ad all enabled · {" "}
          DORMANT = campaign enabled but ad group or ad paused · {" "}
          PAUSED = campaign paused · {" "}
          REMOVED = deleted on Google Ads · {" "}
          UNKNOWN = ID not recognised
        </p>
      </div>
    </div>
  );
}
