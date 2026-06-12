/**
 * /admin/google-ads/preflight — one call, one verdict.
 *
 * Run before launching any new Google Ads campaign. Surfaces every
 * playbook requirement (§16 coverage, §17 spend cap, §20 call asset,
 * §21 call-conversion primary, §22 master negatives, PRESENCE_ONLY
 * targeting, env vars) as a green / red checklist. If anything is
 * red, don't spend.
 */

"use client";

import { useState } from "react";

interface Check {
  name:    string;
  pass:    boolean;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
}
interface Result {
  ok:      boolean;
  summary: string;
  checks:  Check[];
  runAt:   string;
}

export default function PreflightPage() {
  const [result,  setResult]  = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [expand,  setExpand]  = useState<Record<number, boolean>>({});

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const qs = draftId ? `?draftId=${encodeURIComponent(draftId)}` : "";
      const r = await fetch(`/api/admin/google-ads/preflight${qs}`, {
        credentials: "include",
        cache:       "no-store",
      });
      setResult(await r.json());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Google Ads pre-flight</h1>
        <p className="text-sm text-gray-600 mt-1">
          Run before spending another pound. Every playbook rule (§16 coverage,
          §17 spend cap, §20 call asset, §21 call-conversion primary,
          §22 master negatives, PRESENCE_ONLY) checked in one pass.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={draftId}
          onChange={(e) => setDraftId(e.target.value)}
          placeholder="Optional: draftId for per-draft checks"
          className="flex-1 border rounded px-3 py-2 text-sm font-mono"
        />
        <button
          onClick={run}
          disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Running…" : "Run pre-flight"}
        </button>
      </div>

      {result && (
        <>
          <div
            className={`p-4 rounded mb-4 ${
              result.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
            }`}
          >
            <div className="text-xl font-bold">{result.ok ? "✅ GO" : "🛑 STOP"}</div>
            <div className="text-sm">{result.summary}</div>
            <div className="text-[10px] font-mono mt-1 opacity-70">{result.runAt}</div>
          </div>

          <ol className="space-y-2">
            {result.checks.map((c, i) => (
              <li
                key={i}
                className={`border rounded ${
                  c.pass ? "border-emerald-200" : "border-red-300 bg-red-50"
                }`}
              >
                <button
                  onClick={() => setExpand((e) => ({ ...e, [i]: !e[i] }))}
                  className="w-full text-left p-3 flex items-start gap-3"
                >
                  <span className="text-lg">{c.pass ? "✅" : "❌"}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs text-gray-700 mt-0.5">{c.message}</div>
                  </div>
                  {c.details && (
                    <span className="text-[10px] text-gray-500">{expand[i] ? "▲" : "▼"}</span>
                  )}
                </button>
                {expand[i] && c.details && (
                  <pre className="text-[10px] bg-gray-900 text-gray-100 p-3 m-3 rounded overflow-x-auto">
                    {JSON.stringify(c.details, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
