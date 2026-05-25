"use client";

/**
 * Admin Locksmith Coverage page.
 *
 * Shows every (locksmith × postcode district) row with current weekly load
 * vs capacity, pause state, and inline edit for the fields ops cares about.
 *
 * Why this page exists: the ad-campaign gate refuses to launch campaigns
 * into uncovered districts. When that happens, ops needs a fast way to see
 * what's covered, what's paused, what's at capacity, and to fix the gap in
 * one click before retrying the campaign.
 */

import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { MapPin, AlertTriangle, CheckCircle, Pause, Play, Plus, Trash2, RefreshCw } from "lucide-react";

interface CoverageRow {
  id: string;
  locksmithId: string;
  locksmithName: string;
  locksmithActive: boolean;
  postcodeDistrict: string;
  city: string | null;
  region: string | null;
  weeklyCapacity: number;
  currentLoad: number;
  isPaused: boolean;
  pauseReason: string | null;
  pausedUntil: string | null;
  source: string;
  confidenceScore: number;
  lastConfirmedAt: string;
}

interface Locksmith {
  id: string;
  name: string;
}

export default function LocksmithCoveragePage() {
  const [rows, setRows] = useState<CoverageRow[]>([]);
  const [locksmiths, setLocksmiths] = useState<Locksmith[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paused" | "at_capacity" | "free">("all");
  const [searchDistrict, setSearchDistrict] = useState("");

  // Add-row form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocksmithId, setNewLocksmithId] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newCapacity, setNewCapacity] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [coverageRes, locksRes] = await Promise.all([
        fetch("/api/admin/locksmith-coverage"),
        fetch("/api/admin/locksmiths?status=active&limit=200"),
      ]);
      const coverageData = await coverageRes.json();
      const locksData = await locksRes.json();
      setRows(coverageData.coverages ?? []);
      setLocksmiths(
        (locksData.locksmiths ?? []).map((l: Locksmith) => ({ id: l.id, name: l.name })),
      );
    } catch (err) {
      console.error("Failed to load coverage:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (searchDistrict && !r.postcodeDistrict.toUpperCase().includes(searchDistrict.toUpperCase())) {
      return false;
    }
    if (filter === "paused")      return r.isPaused;
    if (filter === "at_capacity") return !r.isPaused && r.currentLoad >= r.weeklyCapacity;
    if (filter === "free")        return !r.isPaused && r.currentLoad < r.weeklyCapacity;
    return true;
  });

  // Group by city for visual scanning
  const grouped = filtered.reduce<Record<string, CoverageRow[]>>((acc, row) => {
    const key = row.city ?? "(no city set)";
    (acc[key] ??= []).push(row);
    return acc;
  }, {});

  const togglePause = async (row: CoverageRow) => {
    await fetch("/api/admin/locksmith-coverage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, isPaused: !row.isPaused }),
    });
    load();
  };

  const updateCapacity = async (row: CoverageRow, newCap: number) => {
    if (newCap === row.weeklyCapacity) return;
    await fetch("/api/admin/locksmith-coverage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, weeklyCapacity: newCap }),
    });
    load();
  };

  const remove = async (row: CoverageRow) => {
    if (!confirm(`Remove ${row.locksmithName}'s coverage for ${row.postcodeDistrict}?`)) return;
    await fetch(`/api/admin/locksmith-coverage?id=${row.id}`, { method: "DELETE" });
    load();
  };

  const addRow = async () => {
    if (!newLocksmithId || !newDistrict) return;
    setSubmitting(true);
    const res = await fetch("/api/admin/locksmith-coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locksmithId:      newLocksmithId,
        postcodeDistrict: newDistrict,
        city:             newCity || undefined,
        weeklyCapacity:   newCapacity,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to add coverage");
      return;
    }
    setNewDistrict(""); setNewCity(""); setNewCapacity(5);
    setShowAddForm(false);
    load();
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="h-7 w-7 text-orange-500" />
              Locksmith Coverage
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Where each onboarded locksmith works, and how much capacity they have per week.
              Ad campaigns are blocked from launching in districts with no free capacity.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg text-sm"
            >
              <Plus className="h-4 w-4" /> Add coverage
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total rows"   value={rows.length} />
          <StatCard label="Districts covered"
            value={new Set(rows.map((r) => r.postcodeDistrict)).size} />
          <StatCard label="Paused"
            value={rows.filter((r) => r.isPaused).length} tone="amber" />
          <StatCard label="At capacity"
            value={rows.filter((r) => !r.isPaused && r.currentLoad >= r.weeklyCapacity).length} tone="red" />
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="bg-white border border-orange-200 rounded-xl p-4 mb-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-3">Add coverage row</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <select value={newLocksmithId} onChange={(e) => setNewLocksmithId(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="">Select locksmith…</option>
                {locksmiths.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <input placeholder="District (e.g. RG1)" value={newDistrict}
                onChange={(e) => setNewDistrict(e.target.value.toUpperCase())}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <input placeholder="City (optional)" value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <input type="number" min={1} max={50} value={newCapacity}
                onChange={(e) => setNewCapacity(Number(e.target.value))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <button onClick={addRow} disabled={submitting || !newLocksmithId || !newDistrict}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-semibold rounded-lg text-sm">
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(["all", "free", "at_capacity", "paused"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}>
              {f.replace("_", " ")}
            </button>
          ))}
          <input placeholder="Filter by district…" value={searchDistrict}
            onChange={(e) => setSearchDistrict(e.target.value)}
            className="ml-auto px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-56" />
        </div>

        {/* Coverage table grouped by city */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([city, cityRows]) => (
              <div key={city} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-700 text-sm">
                    {city} <span className="text-slate-400 font-normal">({cityRows.length})</span>
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {cityRows.map((r) => (
                    <CoverageRowView key={r.id} row={r}
                      onTogglePause={() => togglePause(r)}
                      onCapacityChange={(n) => updateCapacity(r, n)}
                      onRemove={() => remove(r)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "amber" | "red" }) {
  const toneClass = tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function CoverageRowView({ row, onTogglePause, onCapacityChange, onRemove }: {
  row: CoverageRow;
  onTogglePause: () => void;
  onCapacityChange: (n: number) => void;
  onRemove: () => void;
}) {
  const [cap, setCap] = useState(row.weeklyCapacity);
  useEffect(() => setCap(row.weeklyCapacity), [row.weeklyCapacity]);

  const utilisation = row.weeklyCapacity === 0 ? 0 : row.currentLoad / row.weeklyCapacity;
  const utilClass = utilisation >= 1 ? "text-red-600 bg-red-50"
    : utilisation >= 0.75 ? "text-amber-600 bg-amber-50"
    : "text-green-700 bg-green-50";

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`px-2 py-1 rounded text-sm font-mono font-semibold ${row.isPaused ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"}`}>
          {row.postcodeDistrict}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{row.locksmithName}</div>
          <div className="text-xs text-slate-500">
            source: {row.source}
            {row.confidenceScore < 1 && ` · confidence ${(row.confidenceScore * 100).toFixed(0)}%`}
            {row.isPaused && row.pauseReason && ` · ${row.pauseReason}`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className={`text-sm font-medium px-2 py-1 rounded ${utilClass}`}>
          {row.currentLoad} / {row.weeklyCapacity} this week
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => { const n = Math.max(0, cap - 1); setCap(n); onCapacityChange(n); }}
            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600">−</button>
          <input type="number" value={cap} min={0} max={50}
            onChange={(e) => setCap(Number(e.target.value))}
            onBlur={() => onCapacityChange(cap)}
            className="w-12 text-center text-sm border border-slate-200 rounded px-1 py-0.5" />
          <button onClick={() => { const n = Math.min(50, cap + 1); setCap(n); onCapacityChange(n); }}
            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600">+</button>
        </div>

        <button onClick={onTogglePause}
          className={`p-1.5 rounded-lg ${row.isPaused ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}
          title={row.isPaused ? "Resume" : "Pause"}>
          {row.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <button onClick={onRemove}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-500"
          title="Remove coverage">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
      <h3 className="font-semibold text-slate-900 mb-1">No coverage rows yet</h3>
      <p className="text-slate-600 text-sm mb-4 max-w-md mx-auto">
        Ad campaigns require at least one onboarded locksmith with free capacity in the targeted
        postcode district. Add coverage manually, or run the backfill script to import from
        legacy locksmith data:
      </p>
      <code className="block text-xs bg-slate-900 text-green-400 rounded-lg p-3 mx-auto max-w-md text-left font-mono">
        npx ts-node --project tsconfig.scripts.json scripts/backfill-locksmith-coverage.ts
      </code>
    </div>
  );
}
