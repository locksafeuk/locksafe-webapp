"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  RefreshCw,
  Shield,
  ShieldOff,
  Percent,
  Users,
} from "lucide-react";

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

interface LocksmithTierRow {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  commissionTier: string;
  commissionRate: number;
  commissionAssessmentRate: number;
  commissionTierReasons: string[];
  commissionTierUpdatedAt: string | null;
  commissionOverride: boolean;
}

interface AuctionRow {
  id: string;
  jobId: string;
  jobNumber: string;
  address: string;
  postcode: string;
  state: string;
  currentStep: number;
  currentRate: number;
  nextDropAt: string | null;
  notifiedCount: number;
  acceptedBy: string | null;
  acceptedRate: number | null;
  acceptedAt: string | null;
  createdAt: string;
}

// ───────────────────────────────────────────────────────────
// Helper
// ───────────────────────────────────────────────────────────

function tierBadge(tier: string) {
  if (tier === "PREMIUM")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
        <Shield className="h-3 w-3" /> PREMIUM
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
      STANDARD
    </span>
  );
}

function stateBadge(state: string) {
  const map: Record<string, string> = {
    RUNNING: "bg-blue-100 text-blue-700",
    ACCEPTED: "bg-green-100 text-green-700",
    EXPIRED: "bg-red-100 text-red-700",
    ADMIN_ASSIGNED: "bg-purple-100 text-purple-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${map[state] ?? "bg-slate-100 text-slate-600"}`}
    >
      {state}
    </span>
  );
}

function reasonLabel(reason: string) {
  const map: Record<string, string> = {
    high_earner: "High Earner",
    regular_area: "Regular Area",
    area_saturation: "Area Saturation",
  };
  return map[reason] ?? reason;
}

function countdown(nextDropAt: string | null): string {
  if (!nextDropAt) return "—";
  const diff = new Date(nextDropAt).getTime() - Date.now();
  if (diff <= 0) return "Due now";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

// ───────────────────────────────────────────────────────────
// Main Page
// ───────────────────────────────────────────────────────────

export default function CommissionTiersPage() {
  const [tab, setTab] = useState<"tiers" | "auctions">("tiers");

  // Tiers state
  const [tiers, setTiers] = useState<LocksmithTierRow[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [tiersError, setTiersError] = useState<string | null>(null);
  const [overrideLoading, setOverrideLoading] = useState<string | null>(null);

  // Auctions state
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [auctionsLoading, setAuctionsLoading] = useState(false);
  const [auctionsError, setAuctionsError] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState<string | null>(null);

  // Countdown refresh
  const [tick, setTick] = useState(0);

  // ── Data fetching ──────────────────────────────────────

  const fetchTiers = useCallback(async () => {
    setTiersLoading(true);
    setTiersError(null);
    try {
      const res = await fetch("/api/admin/commission-tiers");
      if (!res.ok) throw new Error("Failed to load tiers");
      const data = await res.json();
      setTiers(data.locksmiths ?? []);
    } catch (e) {
      setTiersError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setTiersLoading(false);
    }
  }, []);

  const fetchAuctions = useCallback(async () => {
    setAuctionsLoading(true);
    setAuctionsError(null);
    try {
      const res = await fetch("/api/admin/commission-tiers/auctions");
      if (!res.ok) throw new Error("Failed to load auctions");
      const data = await res.json();
      setAuctions(data.auctions ?? []);
    } catch (e) {
      setAuctionsError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setAuctionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  useEffect(() => {
    if (tab === "auctions") fetchAuctions();
  }, [tab, fetchAuctions]);

  // Tick every second for countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Actions ────────────────────────────────────────────

  async function toggleOverride(locksmithId: string, current: boolean) {
    setOverrideLoading(locksmithId);
    try {
      await fetch("/api/admin/commission-tiers/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithId, override: !current }),
      });
      await fetchTiers();
    } finally {
      setOverrideLoading(null);
    }
  }

  async function adminAssign(jobId: string, locksmithId: string) {
    setAssignLoading(jobId);
    try {
      await fetch("/api/admin/commission-tiers/assign-auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, locksmithId }),
      });
      await fetchAuctions();
    } finally {
      setAssignLoading(null);
    }
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Commission Tiers
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage dynamic commission rates and live job auctions
            </p>
          </div>
          <button
            onClick={() => (tab === "tiers" ? fetchTiers() : fetchAuctions())}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-200">
          {(["tiers", "auctions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 px-4 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "tiers" ? "Locksmith Tiers" : "Live Auctions"}
            </button>
          ))}
        </div>

        {/* ── Tiers Tab ── */}
        {tab === "tiers" && (
          <>
            {tiersLoading && (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}
            {tiersError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {tiersError}
              </div>
            )}
            {!tiersLoading && !tiersError && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Locksmith</th>
                      <th className="px-4 py-3 text-left">Tier</th>
                      <th className="px-4 py-3 text-left">Rates</th>
                      <th className="px-4 py-3 text-left">Triggers</th>
                      <th className="px-4 py-3 text-left">Changed</th>
                      <th className="px-4 py-3 text-left">Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tiers.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          No locksmiths found
                        </td>
                      </tr>
                    )}
                    {tiers.map((ls) => (
                      <tr key={ls.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {ls.name}
                          </div>
                          <div className="text-xs text-slate-500">{ls.email}</div>
                          {ls.companyName && (
                            <div className="text-xs text-slate-400">
                              {ls.companyName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{tierBadge(ls.commissionTier)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs">
                            <Percent className="h-3 w-3 text-slate-400" />
                            <span>
                              Assessment:{" "}
                              <strong>
                                {Math.round(ls.commissionAssessmentRate * 100)}%
                              </strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs mt-0.5">
                            <Percent className="h-3 w-3 text-slate-400" />
                            <span>
                              Work:{" "}
                              <strong>
                                {Math.round(ls.commissionRate * 100)}%
                              </strong>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {ls.commissionTierReasons.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {ls.commissionTierReasons.map((r) => (
                                <span
                                  key={r}
                                  className="rounded bg-orange-50 px-1.5 py-0.5 text-xs text-orange-700"
                                >
                                  {reasonLabel(r)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {ls.commissionTierUpdatedAt
                            ? new Date(
                                ls.commissionTierUpdatedAt,
                              ).toLocaleDateString("en-GB")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              toggleOverride(ls.id, ls.commissionOverride)
                            }
                            disabled={overrideLoading === ls.id}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                              ls.commissionOverride
                                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {ls.commissionOverride ? (
                              <>
                                <Shield className="h-3 w-3" /> Locked
                              </>
                            ) : (
                              <>
                                <ShieldOff className="h-3 w-3" /> Auto
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Auctions Tab ── */}
        {tab === "auctions" && (
          <>
            {auctionsLoading && (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}
            {auctionsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {auctionsError}
              </div>
            )}
            {!auctionsLoading && !auctionsError && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Job</th>
                      <th className="px-4 py-3 text-left">State</th>
                      <th className="px-4 py-3 text-left">Rate</th>
                      <th className="px-4 py-3 text-left">Step</th>
                      <th className="px-4 py-3 text-left">Next Drop</th>
                      <th className="px-4 py-3 text-left">Notified</th>
                      <th className="px-4 py-3 text-left">Accepted By</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auctions.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          No auctions found
                        </td>
                      </tr>
                    )}
                    {auctions.map((auction) => (
                      <tr key={auction.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/jobs?search=${auction.jobNumber}`}
                            className="font-medium text-slate-900 hover:text-orange-600"
                          >
                            #{auction.jobNumber}
                          </Link>
                          <div className="text-xs text-slate-500">
                            {auction.address}
                          </div>
                          <div className="text-xs text-slate-400">
                            {auction.postcode}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {stateBadge(auction.state)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-orange-600">
                          {Math.round(auction.currentRate * 100)}%
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {auction.currentStep + 1}/4
                        </td>
                        <td className="px-4 py-3 text-slate-500 tabular-nums">
                          {auction.state === "RUNNING"
                            ? countdown(auction.nextDropAt)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Users className="h-3 w-3" />
                            {auction.notifiedCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {auction.acceptedBy ?? "—"}
                          {auction.acceptedRate != null && (
                            <span className="ml-1 text-slate-400">
                              ({Math.round(auction.acceptedRate * 100)}%)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {auction.state === "EXPIRED" && (
                            <AdminAssignButton
                              jobId={auction.jobId}
                              loading={assignLoading === auction.jobId}
                              onAssign={adminAssign}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AdminSidebar>
  );
}

// ── Sub-components ──────────────────────────────────────────

function AdminAssignButton({
  jobId,
  loading,
  onAssign,
}: {
  jobId: string;
  loading: boolean;
  onAssign: (jobId: string, locksmithId: string) => void;
}) {
  const [locksmithId, setLocksmithId] = useState("");
  const [locksmiths, setLocksmiths] = useState<
    { id: string; name: string }[]
  >([]);
  const [loaded, setLoaded] = useState(false);

  async function loadLocksmiths() {
    if (loaded) return;
    const res = await fetch("/api/admin/locksmiths?verified=true&active=true&limit=50");
    if (res.ok) {
      const data = await res.json();
      setLocksmiths(data.locksmiths ?? []);
    }
    setLoaded(true);
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        onFocus={loadLocksmiths}
        value={locksmithId}
        onChange={(e) => setLocksmithId(e.target.value)}
        className="rounded border border-slate-200 px-2 py-1 text-xs w-40"
      >
        <option value="">Select locksmith…</option>
        {locksmiths.map((ls) => (
          <option key={ls.id} value={ls.id}>
            {ls.name}
          </option>
        ))}
      </select>
      <button
        disabled={!locksmithId || loading}
        onClick={() => onAssign(jobId, locksmithId)}
        className="rounded bg-orange-500 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-40"
      >
        {loading ? "Assigning…" : "Assign at 25%"}
      </button>
    </div>
  );
}
