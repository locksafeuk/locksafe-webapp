"use client";

/**
 * Admin · Agents · Reflections
 *
 * Read-only feed of `AgentReflection` rows produced by the daily reflection
 * cron. Filterable by agent and outcome. Click a row to see the LLM narrative
 * + lessons.
 */

import { useCallback, useEffect, useState } from "react";

type Outcome = "WIN" | "LOSS" | "INCONCLUSIVE" | "NEUTRAL";
type VerdictTone = "green" | "amber" | "red" | "blue" | "grey";

interface Verdict {
  code: string;
  label: string;
  rationale: string;
  tone: VerdictTone;
}

interface LiveState {
  campaignId: string | null;
  label: string | null; // SERVING | DORMANT | PAUSED | REMOVED | UNKNOWN
  campaignStatus: string | null;
  spend: number | null;
  conversions: number | null;
  clicks: number | null;
  lastVerifiedAt: string | null;
}

interface Reflection {
  id: string;
  agentName: string;
  subjectType: string;
  subjectId: string;
  windowDays: number;
  outcome: Outcome;
  metric: string;
  expectedValue: number | null;
  actualValue: number | null;
  delta: number | null;
  confidence: number;
  narrative: string | null;
  lessons: string[];
  computedAt: string;
  verdict?: Verdict;
  live?: LiveState;
}

// Vivid, clearly-distinguishable badges (was washed-out *-100 tints).
const OUTCOME_COLORS: Record<Outcome, string> = {
  WIN: "bg-green-600 text-white",
  LOSS: "bg-red-600 text-white",
  INCONCLUSIVE: "bg-gray-400 text-white",
  NEUTRAL: "bg-blue-600 text-white",
};

// Verdict pill colours by tone.
const VERDICT_COLORS: Record<VerdictTone, string> = {
  green: "bg-green-600 text-white",
  amber: "bg-amber-500 text-black",
  red: "bg-red-600 text-white",
  blue: "bg-blue-600 text-white",
  grey: "bg-gray-400 text-white",
};

// Live serving-state colours.
const LIVE_COLORS: Record<string, string> = {
  SERVING: "bg-green-600 text-white",
  DORMANT: "bg-yellow-400 text-black",
  PAUSED: "bg-orange-500 text-white",
  REMOVED: "bg-red-600 text-white",
  UNKNOWN: "bg-gray-300 text-gray-800",
};

export default function ReflectionsPage() {
  const [items, setItems] = useState<Reflection[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [verdictCounts, setVerdictCounts] = useState<Record<string, number>>({});
  const [liveError, setLiveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [selected, setSelected] = useState<Reflection | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (agent) qs.set("agent", agent);
      if (outcome) qs.set("outcome", outcome);
      qs.set("limit", "100");
      const r = await fetch(`/api/admin/agents/reflections?${qs}`, { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        setItems(data.reflections ?? []);
        setCounts(data.counts ?? {});
        setVerdictCounts(data.verdictCounts ?? {});
        setLiveError(data.liveError ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [agent, outcome]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agent Reflections</h1>
          <p className="text-sm text-gray-600">
            Self-learning grades on past decisions. Daily cron at 05:00 UTC.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {(["WIN", "LOSS", "INCONCLUSIVE", "NEUTRAL"] as Outcome[]).map((o) => (
            <span key={o} className={`px-2 py-1 rounded ${OUTCOME_COLORS[o]}`}>
              {o}: {counts[o] ?? 0}
            </span>
          ))}
        </div>
      </div>

      {/* Action summary — what the verdicts are telling us to do. */}
      <div className="flex flex-wrap gap-2 text-sm mb-4">
        {([
          ["CONTINUE", "Continue", "bg-green-600 text-white"],
          ["OPTIMISE", "Optimise", "bg-amber-500 text-black"],
          ["CHANGE_STRATEGY", "Change strategy", "bg-red-600 text-white"],
          ["KEEP_WATCHING", "Keep watching", "bg-blue-600 text-white"],
          ["ARCHIVE", "Archive", "bg-gray-400 text-white"],
        ] as const).map(([code, label, cls]) => (
          <span key={code} className={`px-2.5 py-1 rounded font-medium ${cls}`}>
            {label}: {verdictCounts[code] ?? 0}
          </span>
        ))}
      </div>

      {liveError && (
        <div className="mb-4 px-3 py-2 rounded bg-orange-50 border border-orange-300 text-xs text-orange-800">
          Live Google Ads state unavailable ({liveError}). Verdicts below are
          computed from the last synced grade data.
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          className="px-3 py-2 border rounded text-sm"
          placeholder="Filter by agent name..."
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
        />
        <select
          className="px-3 py-2 border rounded text-sm"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          aria-label="Filter by outcome"
        >
          <option value="">All outcomes</option>
          <option value="WIN">WIN</option>
          <option value="LOSS">LOSS</option>
          <option value="INCONCLUSIVE">INCONCLUSIVE</option>
          <option value="NEUTRAL">NEUTRAL</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 bg-gray-900 text-white rounded text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No reflections yet. The cron runs daily at 05:00 UTC.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Live</th>
                  <th className="px-3 py-2">Outcome</th>
                  <th className="px-3 py-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`border-t cursor-pointer hover:bg-blue-50 ${
                      selected?.id === r.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                      {new Date(r.computedAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.agentName}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {r.subjectType}:{r.subjectId.slice(-6)}
                    </td>
                    <td className="px-3 py-2">
                      {r.live?.label ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${LIVE_COLORS[r.live.label] ?? LIVE_COLORS.UNKNOWN}`}>
                          {r.live.label}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${OUTCOME_COLORS[r.outcome]}`}>
                        {r.outcome}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.verdict ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${VERDICT_COLORS[r.verdict.tone]}`}>
                          {r.verdict.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded shadow p-4">
          {selected ? (
            <div>
              <h3 className="font-semibold mb-2">{selected.agentName}</h3>
              <p className="text-xs text-gray-500 mb-2">
                {selected.subjectType} · {selected.metric} · window {selected.windowDays}d
              </p>

              {/* Recommendation — the deterministic "what should we do" verdict. */}
              {selected.verdict && (
                <div className="mb-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${VERDICT_COLORS[selected.verdict.tone]}`}>
                      {selected.verdict.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">
                      Recommendation
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{selected.verdict.rationale}</p>
                </div>
              )}

              {/* Live Google Ads state — is the grade still backed by reality? */}
              {selected.live && (
                <div className="mb-3 text-xs">
                  <h4 className="font-semibold uppercase text-gray-600 mb-1">Live Google Ads</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.live.label ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${LIVE_COLORS[selected.live.label] ?? LIVE_COLORS.UNKNOWN}`}>
                        {selected.live.label}
                      </span>
                    ) : (
                      <span className="text-gray-400">no linked campaign</span>
                    )}
                    {selected.live.spend != null && (
                      <span className="text-gray-700">
                        £{selected.live.spend.toFixed(2)} spend · {selected.live.conversions ?? 0} conv · {selected.live.clicks ?? 0} clicks
                      </span>
                    )}
                  </div>
                  {selected.live.lastVerifiedAt && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Synced {new Date(selected.live.lastVerifiedAt).toLocaleString("en-GB")}
                    </p>
                  )}
                </div>
              )}

              <div className="text-xs space-y-1 mb-3">
                <div>
                  Expected:{" "}
                  <span className="font-mono">
                    {selected.expectedValue?.toFixed(3) ?? "—"}
                  </span>
                </div>
                <div>
                  Actual:{" "}
                  <span className="font-mono">
                    {selected.actualValue?.toFixed(3) ?? "—"}
                  </span>
                </div>
                <div>
                  Confidence:{" "}
                  <span className="font-mono">{selected.confidence.toFixed(2)}</span>
                </div>
              </div>
              {selected.narrative && (
                <div className="mb-3">
                  <h4 className="text-xs font-semibold uppercase text-gray-600 mb-1">
                    Narrative
                  </h4>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {selected.narrative}
                  </p>
                </div>
              )}
              {selected.lessons.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-gray-600 mb-1">
                    Lessons ({selected.lessons.length})
                  </h4>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    {selected.lessons.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">Select a reflection.</div>
          )}
        </div>
      </div>
    </div>
  );
}
