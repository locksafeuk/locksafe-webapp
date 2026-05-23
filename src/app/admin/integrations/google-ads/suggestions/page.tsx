"use client";

import { useEffect, useState, useCallback } from "react";

interface Suggestion {
  id: string;
  type: string;
  campaignName: string | null;
  evidence: Record<string, unknown>;
  suggestedValue: Record<string, unknown>;
  currentValue: Record<string, unknown> | null;
  reasoning: string;
  confidence: number;
  status: string;
  rejectedReason: string | null;
  applyError: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  ADD_NEGATIVE_KEYWORD: { label: "Block keyword",    color: "bg-red-100 text-red-900",    icon: "⛔" },
  ADD_KEYWORD:          { label: "Add keyword",      color: "bg-green-100 text-green-900", icon: "+" },
  INCREASE_BUDGET:      { label: "Increase budget",  color: "bg-blue-100 text-blue-900",  icon: "↑" },
  DECREASE_BUDGET:      { label: "Decrease budget",  color: "bg-orange-100 text-orange-900", icon: "↓" },
  LOWER_BID:            { label: "Lower bid",        color: "bg-yellow-100 text-yellow-900", icon: "↓" },
  RAISE_BID:            { label: "Raise bid",        color: "bg-blue-100 text-blue-900",  icon: "↑" },
  PAUSE_CANDIDATE:      { label: "Review & pause?",  color: "bg-orange-100 text-orange-900", icon: "⏸" },
  SCALE_WINNER:         { label: "Scale winner",     color: "bg-green-100 text-green-900", icon: "🚀" },
  NEW_DRAFT_CITY:       { label: "New city draft",   color: "bg-purple-100 text-purple-900", icon: "📍" },
};

const REJECT_REASONS = [
  { value: "too_early",                label: "Too early — need more data" },
  { value: "disagree_with_data",       label: "Disagree with the data" },
  { value: "manual_override_planned",  label: "I'm handling this manually" },
  { value: "wrong_context",            label: "Wrong context" },
  { value: "already_handled",          label: "Already handled" },
  { value: "other",                    label: "Other" },
];

const FILTER_STATUSES = ["PENDING", "APPLIED", "REJECTED", "EXPIRED"] as const;

export default function GoogleAdsSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState<(typeof FILTER_STATUSES)[number]>("PENDING");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("too_early");
  const [toast, setToast] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/google-ads/suggestions?status=${filter}&limit=50`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setPendingCount(data.pendingCount ?? 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function showToast(id: string, msg: string, ok: boolean) {
    setToast({ id, msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleApprove(id: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/google-ads/suggestions/${id}/approve`, { method: "POST" });
      const data = await res.json();
      showToast(id, data.message ?? (data.success ? "Applied." : "Failed."), data.success);
      if (data.success) load();
    } catch {
      showToast(id, "Request failed.", false);
    } finally {
      setActing(null);
    }
  }

  async function handleReject(id: string) {
    setActing(id);
    try {
      await fetch(`/api/admin/google-ads/suggestions/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectOpen(null);
      load();
    } catch {
      showToast(id, "Reject request failed.", false);
    } finally {
      setActing(null);
    }
  }

  function confidenceBadge(c: number) {
    if (c >= 0.8) return <span className="text-xs font-semibold text-green-700">HIGH</span>;
    if (c >= 0.5) return <span className="text-xs font-semibold text-yellow-700">MED</span>;
    return <span className="text-xs font-semibold text-gray-500">LOW</span>;
  }

  function evidenceSummary(s: Suggestion): string {
    const e = s.evidence ?? {};
    const parts: string[] = [];
    if (e.totalSpend != null) parts.push(`£${Number(e.totalSpend).toFixed(2)} spent`);
    if (e.totalClicks != null) parts.push(`${e.totalClicks} clicks`);
    if (e.totalConversions != null) parts.push(`${e.totalConversions} conv`);
    if (e.days != null) parts.push(`${e.days}d`);
    if (e.avgRoas != null) parts.push(`ROAS ${Number(e.avgRoas).toFixed(1)}×`);
    if (e.utilisationRate != null) parts.push(`${(Number(e.utilisationRate) * 100).toFixed(0)}% budget used`);
    return parts.join(" · ") || "See reasoning";
  }

  function actionLabel(s: Suggestion): string {
    const v = s.suggestedValue ?? {};
    if (s.type === "ADD_NEGATIVE_KEYWORD") return `Block: "${v.keyword}"`;
    if (s.type === "ADD_KEYWORD") return `Add [${v.keyword}] (${v.matchType})`;
    if (s.type === "INCREASE_BUDGET" || s.type === "SCALE_WINNER") return `Budget → £${v.newDailyBudget}/day`;
    if (s.type === "DECREASE_BUDGET") return `Budget → £${v.newDailyBudget}/day`;
    if (s.type === "LOWER_BID") return `Max CPC → £${v.newMaxCpcGbp}`;
    if (s.type === "PAUSE_CANDIDATE") return "Flag for review";
    if (s.type === "NEW_DRAFT_CITY") return "Approve city draft";
    return JSON.stringify(v);
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Suggestions</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI observes campaigns · suggests actions · you approve or reject.
            No Google Ads change fires without your approval.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-900">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {FILTER_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              filter === s
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded text-sm font-medium ${toast.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {toast.msg}
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-sm">No {filter.toLowerCase()} suggestions.</p>
          {filter === "PENDING" && (
            <p className="text-xs mt-1">The AI will analyse campaigns after the next performance sync.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s) => {
            const meta = TYPE_LABELS[s.type] ?? { label: s.type, color: "bg-gray-100 text-gray-700", icon: "?" };
            const isActing = acting === s.id;

            return (
              <div key={s.id} className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: badge + campaign */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                      {confidenceBadge(s.confidence)}
                      {s.campaignName && (
                        <span className="text-xs text-gray-500 truncate max-w-[200px]">
                          {s.campaignName}
                        </span>
                      )}
                    </div>

                    {/* Action */}
                    <p className="text-sm font-semibold text-gray-900 mb-1">{actionLabel(s)}</p>

                    {/* Evidence */}
                    <p className="text-xs text-gray-500 mb-2">{evidenceSummary(s)}</p>

                    {/* Reasoning */}
                    <p className="text-sm text-gray-700 leading-relaxed">{s.reasoning}</p>

                    {/* Error / rejection note */}
                    {s.applyError && (
                      <p className="mt-2 text-xs text-red-600">Apply error: {s.applyError}</p>
                    )}
                    {s.rejectedReason && (
                      <p className="mt-2 text-xs text-gray-400">
                        Rejected: {REJECT_REASONS.find((r) => r.value === s.rejectedReason)?.label ?? s.rejectedReason}
                      </p>
                    )}
                  </div>

                  {/* Right: actions (PENDING only) */}
                  {s.status === "PENDING" && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(s.id)}
                        disabled={isActing}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded disabled:opacity-50 transition-colors"
                      >
                        {isActing ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => { setRejectOpen(s.id); setRejectReason("too_early"); }}
                        disabled={isActing}
                        className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {s.status === "APPLIED" && (
                    <span className="shrink-0 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">Applied</span>
                  )}
                  {s.status === "REJECTED" && (
                    <span className="shrink-0 text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded">Rejected</span>
                  )}
                </div>

                {/* Reject modal (inline) */}
                {rejectOpen === s.id && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Why are you rejecting this?</p>
                    <select
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3"
                    >
                      {REJECT_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(s.id)}
                        disabled={isActing}
                        className="px-4 py-2 bg-gray-800 text-white text-sm rounded hover:bg-gray-900 disabled:opacity-50"
                      >
                        Confirm reject
                      </button>
                      <button
                        onClick={() => setRejectOpen(null)}
                        className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
