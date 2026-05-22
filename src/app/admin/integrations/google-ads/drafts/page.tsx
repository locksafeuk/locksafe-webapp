"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DraftRow {
  id: string;
  status: string;
  name: string;
  dailyBudget: number;
  biddingStrategy: string;
  googleCampaignId: string | null;
  totalSpend: number;
  totalConversions: number;
  publishedAt: string | null;
  publishError: string | null;
  createdAt: string;
}

const STATUSES = [
  "ALL",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PUBLISHING",
  "PUBLISHED",
  "PAUSED",
  "FAILED",
] as const;

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-900",
  APPROVED: "bg-blue-100 text-blue-900",
  REJECTED: "bg-gray-100 text-gray-700",
  PUBLISHING: "bg-purple-100 text-purple-900",
  PUBLISHED: "bg-green-100 text-green-900",
  PAUSED: "bg-orange-100 text-orange-900",
  FAILED: "bg-red-100 text-red-900",
  DRAFT: "bg-gray-100 text-gray-700",
};

export default function GoogleAdsDraftsListPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("ALL");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{
    message: string;
    coverageSummary?: string[];
    activeLocksmithCount?: number;
    draftId?: string;
    error?: string;
  } | null>(null);

  // Per-locksmith generator state
  const [eligible, setEligible] = useState<Array<{
    id: string;
    name: string;
    companyName: string | null;
    baseAddress: string | null;
    rating: number;
    totalJobs: number;
  }>>([]);
  const [selectedLocksmithId, setSelectedLocksmithId] = useState<string>("");
  const [perLockBudget, setPerLockBudget] = useState<number>(10);
  const [generatingPerLock, setGeneratingPerLock] = useState(false);
  const [perLockResult, setPerLockResult] = useState<{
    message: string;
    draftId?: string;
    cityLabel?: string | null;
    usedLearnings?: boolean;
    keywordCount?: number;
    negativeKeywordCount?: number;
    error?: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const url =
        filter === "ALL"
          ? "/api/admin/google-ads/drafts"
          : `/api/admin/google-ads/drafts?status=${filter}`;
      const res = await fetch(url, { signal: controller.signal }).catch(
        (err) => ({ ok: false, status: 0, _err: err } as unknown as Response),
      );
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts ?? []);
      } else {
        setDrafts([]);
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Load eligible locksmiths once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/google-ads/drafts/from-locksmith");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.locksmiths)) {
          setEligible(data.locksmiths);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerateForLocksmith = useCallback(async () => {
    if (!selectedLocksmithId) {
      setPerLockResult({ message: "Pick a locksmith first", error: "no-locksmith" });
      return;
    }
    setGeneratingPerLock(true);
    setPerLockResult(null);
    try {
      const res = await fetch("/api/admin/google-ads/drafts/from-locksmith", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locksmithId: selectedLocksmithId,
          dailyBudget: perLockBudget,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPerLockResult({ message: data.error ?? "Unknown error", error: data.error });
      } else {
        setPerLockResult({
          message: data.message,
          draftId: data.draftId,
          cityLabel: data.cityLabel,
          usedLearnings: data.usedLearnings,
          keywordCount: data.keywordCount,
          negativeKeywordCount: data.negativeKeywordCount,
        });
        await refresh();
        if (data.draftId) {
          router.push(`/admin/integrations/google-ads/drafts/${data.draftId}`);
        }
      }
    } catch (err) {
      setPerLockResult({ message: String(err), error: String(err) });
    } finally {
      setGeneratingPerLock(false);
    }
  }, [selectedLocksmithId, perLockBudget, refresh, router]);

  const handleCreateFromCoverage = useCallback(async () => {
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await fetch("/api/admin/google-ads/campaign-from-coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateResult({ message: data.error ?? "Unknown error", error: data.error });
      } else {
        setCreateResult({
          message: data.message,
          coverageSummary: data.coverageSummary,
          activeLocksmithCount: data.activeLocksmithCount,
          draftId: data.draftId,
        });
        await refresh();
        if (data.action === "created" && data.draftId) {
          router.push(`/admin/integrations/google-ads/drafts/${data.draftId}`);
        }
      }
    } catch (err) {
      setCreateResult({ message: String(err), error: String(err) });
    } finally {
      setCreating(false);
    }
  }, [refresh, router]);

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Google Ads Drafts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Campaign drafts generated by the CMO agent or created from locksmith coverage. Approve → Publish to push a PAUSED campaign to Google Ads.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/integrations/google-ads/opportunities"
            className="rounded border border-amber-500 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
            title="Find cheap, under-served UK markets"
          >
            🎯 Opportunity Scout
          </Link>
          <Link
            href="/admin/integrations/google-ads/drafts/new"
            className="rounded border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            + Create Custom Draft
          </Link>
          <button
            type="button"
            onClick={handleCreateFromCoverage}
            disabled={creating}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? "Generating…" : "Generate Coverage Campaign"}
          </button>
        </div>
      </div>

      {createResult && (
        <div
          className={`rounded border p-3 text-sm ${
            createResult.error
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-green-300 bg-green-50 text-green-800"
          }`}
        >
          <p>{createResult.message}</p>
          {createResult.coverageSummary && createResult.coverageSummary.length > 0 && (
            <p className="mt-1 text-xs">
              Coverage areas ({createResult.activeLocksmithCount} locksmith
              {createResult.activeLocksmithCount !== 1 ? "s" : ""}):{" "}
              {createResult.coverageSummary.join(", ")}
            </p>
          )}
          {createResult.draftId && !createResult.error && (
            <Link
              href={`/admin/integrations/google-ads/drafts/${createResult.draftId}`}
              className="mt-1 inline-block text-xs underline"
            >
              Review draft →
            </Link>
          )}
        </div>
      )}

      {/* ── Per-locksmith generator (uses Google Ads learnings) ─────────── */}
      <div className="rounded border border-emerald-300 bg-emerald-50/40 p-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-emerald-900">
            Generate draft from a locksmith
          </h2>
          <p className="text-xs text-emerald-900/80 mt-0.5">
            Pulls historical keywords, search-term winners, blocked terms and best-performing ad copy
            from the connected Google Ads account, then tailors a fresh draft to one onboarded locksmith's
            city. Falls back to the baseline keyword set when no learnings exist yet.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-medium text-emerald-900 mb-1">
              Locksmith ({eligible.length} eligible)
            </label>
            <select
              aria-label="Select locksmith for draft"
              value={selectedLocksmithId}
              onChange={(e) => setSelectedLocksmithId(e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
              disabled={generatingPerLock || eligible.length === 0}
            >
              <option value="">— pick a locksmith —</option>
              {eligible.map((l) => (
                <option key={l.id} value={l.id}>
                  {(l.companyName || l.name)}
                  {l.baseAddress ? ` · ${l.baseAddress.split(",").slice(-2, -1)[0]?.trim() || l.baseAddress}` : ""}
                  {l.totalJobs > 0 ? ` · ${l.totalJobs} jobs · ${l.rating.toFixed(1)}★` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-emerald-900 mb-1">£/day</label>
            <input
              aria-label="Daily budget in GBP"
              placeholder="10"
              type="number"
              min={1}
              max={100}
              value={perLockBudget}
              onChange={(e) => setPerLockBudget(Math.max(1, Math.min(100, Number(e.target.value) || 10)))}
              className="w-24 rounded border px-2 py-1.5 text-sm"
              disabled={generatingPerLock}
            />
          </div>
          <button
            type="button"
            onClick={handleGenerateForLocksmith}
            disabled={generatingPerLock || !selectedLocksmithId}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {generatingPerLock ? "Generating…" : "Generate draft"}
          </button>
        </div>
        {perLockResult && (
          <div
            className={`rounded border p-2 text-xs ${
              perLockResult.error
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-emerald-300 bg-white text-emerald-900"
            }`}
          >
            <p>{perLockResult.message}</p>
            {!perLockResult.error && (
              <p className="mt-1">
                {perLockResult.usedLearnings ? "✓ Used historical learnings · " : "ℹ No prior learnings — baseline only · "}
                {perLockResult.cityLabel ? `Geo: ${perLockResult.cityLabel} · ` : "Geo: UK · "}
                {perLockResult.keywordCount} keywords · {perLockResult.negativeKeywordCount} negatives
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded border px-3 py-1 text-xs ${
              filter === s ? "bg-blue-600 text-white" : "hover:bg-gray-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drafts in this filter.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Name</th>
              <th className="py-2">Status</th>
              <th className="py-2">Daily £</th>
              <th className="py-2">Bidding</th>
              <th className="py-2">Spend</th>
              <th className="py-2">Conv</th>
              <th className="py-2">Created</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id} className="border-b">
                <td className="py-2">{d.name}</td>
                <td className="py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[d.status] ?? "bg-gray-100"}`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="py-2">£{d.dailyBudget.toFixed(2)}</td>
                <td className="py-2 text-xs">{d.biddingStrategy}</td>
                <td className="py-2">£{d.totalSpend.toFixed(2)}</td>
                <td className="py-2">{d.totalConversions}</td>
                <td className="py-2 text-xs">{new Date(d.createdAt).toLocaleString()}</td>
                <td className="py-2">
                  <Link
                    href={`/admin/integrations/google-ads/drafts/${d.id}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
