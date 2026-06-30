"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface FunnelStage {
  stage: string;
  count: number;
  pctOfPrev: number | null;
  pctOfTop: number | null;
}
interface FunnelData {
  windowDays: number;
  capped: boolean;
  totalEvents: number;
  uniqueVisitors: number;
  funnel: FunnelStage[];
  topLandingPages: { path: string; views: number }[];
  conversionEvents: Record<string, number>;
  jobsInWindow: number;
  jobCreatedEvents: number;
  note: string | null;
}

export default function AdminFunnelPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/funnel?days=${days}`, { credentials: "include", cache: "no-store" });
      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      if (!res.ok) { setError(`Failed to load (${res.status})`); return; }
      setData(await res.json());
    } catch {
      setError("Network error loading funnel.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const maxCount = data ? Math.max(1, ...data.funnel.map((s) => s.count)) : 1;

  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Conversion Funnel</h1>
            <p className="text-sm text-slate-500">Page view → booking page → submit → job created</p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  days === d ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="text-slate-500">Loading…</div>}
        {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-4">{error}</div>}

        {data && !loading && (
          <>
            {data.note && (
              <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 p-3 text-sm">
                {data.note}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Stat label="Unique visitors" value={data.uniqueVisitors} />
              <Stat label="Jobs created" value={data.jobsInWindow} />
              <Stat label="Booking submits" value={data.funnel[2]?.count ?? 0} />
              <Stat label="Events tracked" value={data.totalEvents} />
            </div>

            {/* Funnel bars */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Funnel ({data.windowDays}d)</h2>
              <div className="space-y-3">
                {data.funnel.map((s, i) => (
                  <div key={s.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{s.stage}</span>
                      <span className="text-slate-900 font-semibold">
                        {s.count.toLocaleString()}
                        {i > 0 && s.pctOfPrev != null && (
                          <span className={`ml-2 text-xs ${s.pctOfPrev < 30 ? "text-red-600" : "text-slate-400"}`}>
                            {s.pctOfPrev}% of prev
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-6 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                        style={{ width: `${Math.max(1.5, (s.count / maxCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-4">
                A big drop between &quot;Reached booking page&quot; and &quot;Submitted&quot; = the form leaks. Between
                &quot;Page views&quot; and &quot;Reached booking&quot; = the landing CTA leaks.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Top landing pages */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Top pages by views</h2>
                {data.topLandingPages.length === 0 ? (
                  <p className="text-sm text-slate-400">No page views yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.topLandingPages.map((p) => (
                      <div key={p.path} className="flex justify-between text-sm">
                        <span className="text-slate-600 truncate mr-2 font-mono text-xs">{p.path}</span>
                        <span className="text-slate-900 font-semibold">{p.views}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Conversion events */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Conversion events</h2>
                {Object.keys(data.conversionEvents).length === 0 ? (
                  <p className="text-sm text-slate-400">None in window.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(data.conversionEvents).map(([t, n]) => (
                      <div key={t} className="flex justify-between text-sm">
                        <span className="text-slate-600 font-mono text-xs">{t}</span>
                        <span className="text-slate-900 font-semibold">{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminSidebar>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
      <div className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
