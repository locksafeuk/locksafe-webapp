"use client";

/**
 * Admin · Google Ads · Keyword Seed Bank
 *
 * Lists the adaptive `KeywordSeed` collection that drives Opportunity Scout's
 * keyword discovery. Score climbs on WIN reflections, drops on LOSS — admins
 * can toggle isActive to force-exclude noisy terms or add manual seeds.
 */

import { useCallback, useEffect, useState } from "react";

interface Seed {
  id: string;
  keyword: string;
  category: string;
  score: number;
  winCount: number;
  lossCount: number;
  inconclusiveCount: number;
  usageCount: number;
  lastUsedAt: string | null;
  lastWinAt: string | null;
  isActive: boolean;
  notes: string | null;
}

export default function SeedBankPage() {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKw, setNewKw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/google-ads/seed-bank", { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        setSeeds(data.seeds);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addNew() {
    if (!newKw.trim()) return;
    setBusy("add");
    try {
      const r = await fetch("/api/admin/google-ads/seed-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKw.trim(), category: "manual" }),
      });
      if (r.ok) {
        setNewKw("");
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggle(id: string, isActive: boolean) {
    setBusy(id);
    try {
      const r = await fetch("/api/admin/google-ads/seed-bank", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      });
      if (r.ok) await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Keyword Seed Bank</h1>
      <p className="text-sm text-gray-600 mb-6">
        Adaptive seeds for Opportunity Scout. Score updates from reflection
        outcomes (WIN/LOSS).
      </p>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 px-3 py-2 border rounded text-sm"
          placeholder="Add a new seed keyword (e.g. car key replacement)…"
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNew()}
        />
        <button
          type="button"
          onClick={addNew}
          disabled={busy === "add" || !newKw.trim()}
          className="px-4 py-2 bg-gray-900 text-white rounded text-sm disabled:opacity-50"
        >
          {busy === "add" ? "Adding…" : "Add seed"}
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : seeds.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No seeds yet. Run <code>scripts/seed-keyword-bank.ts</code> to import baselines.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Keyword</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-right">W/L/I</th>
                <th className="px-3 py-2 text-right">Used</th>
                <th className="px-3 py-2">Last used</th>
                <th className="px-3 py-2 text-right">Active</th>
              </tr>
            </thead>
            <tbody>
              {seeds.map((s) => (
                <tr key={s.id} className={`border-t ${!s.isActive ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 font-medium">{s.keyword}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-gray-100">{s.category}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{s.score.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono">
                    <span className="text-green-700">{s.winCount}</span>/
                    <span className="text-red-700">{s.lossCount}</span>/
                    <span className="text-gray-500">{s.inconclusiveCount}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{s.usageCount}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggle(s.id, !s.isActive)}
                      disabled={busy === s.id}
                      className={`px-3 py-1 rounded text-xs ${
                        s.isActive
                          ? "bg-green-100 text-green-900"
                          : "bg-gray-100 text-gray-700"
                      } disabled:opacity-50`}
                    >
                      {busy === s.id ? "…" : s.isActive ? "Active" : "Disabled"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
