/**
 * /admin/data-ownership — Phase 1 Data Ownership Dashboard.
 *
 * Shows every outbound and inbound HTTP exchange between LockSafe and
 * third-party vendors (Google Ads, Stripe, Meta, etc.). Phase 1 is
 * deliberately bare-bones: vendor chips, filter bar, paginated table,
 * single-event drawer. Phases 2–6 layer SSE, the Sankey field-flow
 * view, anomaly detection, and per-vendor schema catalogs on top.
 */

"use client";

import { useEffect, useMemo, useState } from "react";

interface EventRow {
  id:            string;
  createdAt:     string;
  vendor:        string;
  direction:     "outbound" | "inbound";
  endpoint:      string;
  method:        string;
  status:        number | null;
  requestBytes:  number | null;
  responseBytes: number | null;
  latencyMs:     number | null;
  identifiersShared:   Record<string, string> | null;
  identifiersReceived: Record<string, string> | null;
  fieldsShared:        Record<string, string> | null;
  fieldsReceived:      Record<string, string> | null;
  callerRoute:   string | null;
  errorMessage:  string | null;
}

const FIELD_CATEGORY_COLOR: Record<string, string> = {
  PII:        "bg-red-100 text-red-900",
  identifier: "bg-yellow-100 text-yellow-900",
  monetary:   "bg-emerald-100 text-emerald-900",
  geo:        "bg-blue-100 text-blue-900",
  behavioral: "bg-purple-100 text-purple-900",
  aggregate:  "bg-gray-100 text-gray-900",
  other:      "bg-neutral-100 text-neutral-700",
};

function fieldChips(fields: Record<string, string> | null): { label: string; cat: string }[] {
  if (!fields) return [];
  // Summarise by category — show counts instead of individual fields.
  const counts = new Map<string, number>();
  for (const cat of Object.values(fields)) counts.set(cat, (counts.get(cat) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => ({ label: `${cat} ×${n}`, cat }));
}

interface SummaryRow {
  vendor:    string;
  direction: string;
  _count:    { _all: number };
  _sum:      { requestBytes: number | null; responseBytes: number | null };
}

interface FeedResponse {
  items:      EventRow[];
  nextCursor: string | null;
  summary:    SummaryRow[];
}

const VENDOR_COLORS: Record<string, string> = {
  "google-ads":   "bg-blue-100 text-blue-900",
  "google-ga4":   "bg-blue-50  text-blue-800",
  "google-oauth": "bg-indigo-50 text-indigo-800",
  meta:           "bg-sky-100 text-sky-900",
  stripe:         "bg-purple-100 text-purple-900",
  resend:         "bg-pink-100 text-pink-900",
  twilio:         "bg-red-100 text-red-900",
  zadarma:        "bg-orange-100 text-orange-900",
  retell:         "bg-amber-100 text-amber-900",
  mapbox:         "bg-emerald-100 text-emerald-900",
  openai:         "bg-gray-100 text-gray-900",
  ollama:         "bg-gray-50 text-gray-700",
  telegram:       "bg-cyan-100 text-cyan-900",
  "vercel-blob":  "bg-neutral-100 text-neutral-900",
  other:          "bg-yellow-100 text-yellow-900",
};

function fmtBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { hour12: false });
}

export default function DataOwnershipPage() {
  const [data,      setData]      = useState<FeedResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [filters,   setFilters]   = useState({ vendor: "", direction: "", endpoint: "", since: "" });
  const [selected,  setSelected]  = useState<EventRow | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [drillDown, setDrillDown] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.vendor)    qs.set("vendor",    filters.vendor);
      if (filters.direction) qs.set("direction", filters.direction);
      if (filters.endpoint)  qs.set("endpoint",  filters.endpoint);
      if (filters.since)     qs.set("since",     filters.since);
      qs.set("limit", "100");
      const r = await fetch(`/api/admin/vendor-audit/events?${qs}`, {
        credentials: "include",
        cache:       "no-store",
      });
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  const openDrillDown = async (row: EventRow) => {
    setSelected(row);
    setDrillDown(null);
    try {
      const r = await fetch(`/api/admin/vendor-audit/events/${row.id}`, {
        credentials: "include",
      });
      if (r.ok) setDrillDown(await r.json());
    } catch { /* ignore */ }
  };

  const vendorTotals = useMemo(() => {
    const m = new Map<string, { count: number; out: number; in: number }>();
    for (const s of data?.summary ?? []) {
      const e = m.get(s.vendor) ?? { count: 0, out: 0, in: 0 };
      e.count += s._count._all;
      e.out   += s._sum.requestBytes  ?? 0;
      e.in    += s._sum.responseBytes ?? 0;
      m.set(s.vendor, e);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [data?.summary]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Data Ownership Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Every outbound and inbound HTTP exchange between LockSafe and
          third-party vendors. What data leaves the platform, what comes
          back, and from whom. Phase 1: Google Ads + Stripe wired. More
          vendors landing in Phase 2.
        </p>
      </div>

      {/* Vendor chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {vendorTotals.length === 0 && !loading && (
          <p className="text-sm text-gray-500">
            No vendor events yet. Make a real API call (publish a Google Ads
            campaign, accept a Stripe payment, etc.) and they'll show up here.
          </p>
        )}
        {vendorTotals.map(([vendor, t]) => (
          <button
            key={vendor}
            onClick={() => setFilters((f) => ({ ...f, vendor: f.vendor === vendor ? "" : vendor }))}
            className={`px-3 py-1.5 text-xs rounded-full border ${
              VENDOR_COLORS[vendor] ?? "bg-gray-100 text-gray-900"
            } ${filters.vendor === vendor ? "ring-2 ring-offset-1 ring-blue-500" : ""}`}
          >
            <span className="font-mono font-semibold">{vendor}</span>
            <span className="ml-2">{t.count} events</span>
            <span className="ml-2 text-[10px] opacity-70">
              ↑{fmtBytes(t.out)} ↓{fmtBytes(t.in)}
            </span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <select
          value={filters.direction}
          onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All directions</option>
          <option value="outbound">Outbound (we → vendor)</option>
          <option value="inbound">Inbound (vendor → us)</option>
        </select>
        <input
          type="text"
          placeholder="Endpoint contains…"
          value={filters.endpoint}
          onChange={(e) => setFilters((f) => ({ ...f, endpoint: e.target.value }))}
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={filters.since}
          onChange={(e) => setFilters((f) => ({ ...f, since: e.target.value }))}
          className="border rounded px-2 py-1 text-sm"
        />
        <button
          onClick={() => setFilters({ vendor: "", direction: "", endpoint: "", since: "" })}
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
        >
          Clear filters
        </button>
      </div>

      {loading && <p>Loading…</p>}

      {/* Events table */}
      {data && data.items.length === 0 && !loading && (
        <p className="text-sm text-gray-500 py-12 text-center border rounded">
          No events match these filters.
        </p>
      )}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-2">Time</th>
                <th className="p-2">Vendor</th>
                <th className="p-2">Direction</th>
                <th className="p-2">Endpoint</th>
                <th className="p-2 text-right">Status</th>
                <th className="p-2 text-right">Out</th>
                <th className="p-2 text-right">In</th>
                <th className="p-2 text-right">Latency</th>
                <th className="p-2">Fields shared</th>
                <th className="p-2">Identifiers</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const ids = {
                  ...(row.identifiersShared   ?? {}),
                  ...(row.identifiersReceived ?? {}),
                };
                const idStr = Object.entries(ids).slice(0, 3)
                  .map(([k, v]) => `${k}=${String(v).slice(0, 12)}${String(v).length > 12 ? "…" : ""}`)
                  .join(" ");
                return (
                  <tr
                    key={row.id}
                    className={`border-t hover:bg-blue-50 cursor-pointer ${
                      row.errorMessage ? "bg-red-50" : ""
                    }`}
                    onClick={() => openDrillDown(row)}
                  >
                    <td className="p-2 font-mono">{fmtTime(row.createdAt)}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${VENDOR_COLORS[row.vendor] ?? ""}`}>
                        {row.vendor}
                      </span>
                    </td>
                    <td className="p-2">
                      {row.direction === "outbound" ? "→ out" : "← in"}
                    </td>
                    <td className="p-2 font-mono truncate max-w-md">{row.endpoint}</td>
                    <td className="p-2 text-right">{row.status ?? "—"}</td>
                    <td className="p-2 text-right">{fmtBytes(row.requestBytes)}</td>
                    <td className="p-2 text-right">{fmtBytes(row.responseBytes)}</td>
                    <td className="p-2 text-right">{row.latencyMs != null ? `${row.latencyMs}ms` : "—"}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {fieldChips(row.fieldsShared).map((c) => (
                          <span
                            key={c.cat}
                            className={`text-[9px] px-1.5 py-0.5 rounded ${FIELD_CATEGORY_COLOR[c.cat] ?? ""}`}
                            title={`${c.cat} fields shared with vendor`}
                          >
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 font-mono text-[10px] truncate max-w-xs">{idStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drill-down drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-50 flex justify-end"
          onClick={() => { setSelected(null); setDrillDown(null); }}
        >
          <div
            className="bg-white w-full max-w-2xl h-full overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`px-2 py-1 text-xs rounded ${VENDOR_COLORS[selected.vendor] ?? ""}`}>
                  {selected.vendor}
                </span>
                <h2 className="text-lg font-bold mt-2">{selected.method} {selected.endpoint}</h2>
                <p className="text-xs text-gray-500 font-mono">{fmtTime(selected.createdAt)}</p>
              </div>
              <button
                onClick={() => { setSelected(null); setDrillDown(null); }}
                className="text-gray-400 hover:text-gray-700 text-xl"
              >×</button>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-sm mb-6">
              <div><dt className="text-gray-500">Direction</dt><dd>{selected.direction}</dd></div>
              <div><dt className="text-gray-500">Status</dt><dd>{selected.status ?? "—"}</dd></div>
              <div><dt className="text-gray-500">Request bytes</dt><dd>{fmtBytes(selected.requestBytes)}</dd></div>
              <div><dt className="text-gray-500">Response bytes</dt><dd>{fmtBytes(selected.responseBytes)}</dd></div>
              <div><dt className="text-gray-500">Latency</dt><dd>{selected.latencyMs != null ? `${selected.latencyMs}ms` : "—"}</dd></div>
              <div><dt className="text-gray-500">Caller</dt><dd className="font-mono text-xs">{selected.callerRoute ?? "—"}</dd></div>
            </dl>

            {selected.errorMessage && (
              <div className="mb-4 p-3 bg-red-50 text-red-900 rounded text-xs">
                <strong>Error:</strong> {selected.errorMessage}
              </div>
            )}

            <Section title="Identifiers shared (we → vendor)" data={selected.identifiersShared} />
            <Section title="Identifiers received (vendor → us)" data={selected.identifiersReceived} />

            <FieldFlow title="Fields we shared with vendor"   fields={selected.fieldsShared} />
            <FieldFlow title="Fields vendor returned to us"   fields={selected.fieldsReceived} />

            {drillDown?.requestSample && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-1">Request payload</h3>
                <pre className="text-[10px] bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto max-h-64">{drillDown.requestSample}</pre>
              </div>
            )}
            {drillDown?.responseSample && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-1">Response payload</h3>
                <pre className="text-[10px] bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto max-h-64">{drillDown.responseSample}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldFlow({ title, fields }: { title: string; fields: Record<string, string> | null }) {
  if (!fields || Object.keys(fields).length === 0) return null;
  // Group field names by category for a cleaner read.
  const byCat = new Map<string, string[]>();
  for (const [name, cat] of Object.entries(fields)) {
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(name);
  }
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <div className="space-y-1">
        {Array.from(byCat.entries()).sort().map(([cat, names]) => (
          <div key={cat} className="flex items-start gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${FIELD_CATEGORY_COLOR[cat] ?? ""}`}>
              {cat}
            </span>
            <span className="text-[11px] text-gray-700 font-mono break-all">
              {names.sort().join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, data }: { title: string; data: Record<string, string> | null }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <dl className="text-xs grid grid-cols-[max-content_1fr] gap-x-2 gap-y-1 font-mono">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-500">{k}:</dt>
            <dd className="break-all">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
