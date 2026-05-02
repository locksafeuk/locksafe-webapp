"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Inbox, ShieldAlert } from "lucide-react";

interface Approval {
  id: string;
  agentId: string;
  agentName: string;
  actionType: string;
  actionDetails: string;
  reason: string;
  estimatedCost: number;
  createdAt: string;
}

function parseDetails(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString("en-GB");
}

export function ApprovalsClient() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agents/approvals", { cache: "no-store" });
      const json = (await res.json()) as { approvals?: Approval[] };
      setApprovals(json.approvals ?? []);
    } catch {
      setNotice({ kind: "err", text: "Failed to load approvals." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = useCallback(
    async (approval: Approval, approved: boolean) => {
      setBusy(approval.id);
      setNotice(null);
      try {
        const res = await fetch(`/api/agents/approvals/${approval.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ approved, resolution: approved ? "Approved by admin" : "Rejected by admin" }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || "Failed");
        }

        // For ad campaign approvals, immediately call publish so the campaign goes live.
        if (approved) {
          const details = parseDetails(approval.actionDetails);
          const targetType =
            (details.targetType as string | undefined) ??
            (approval.actionType.includes("ad_campaign") || approval.actionType.includes("catalog_campaign")
              ? "ad_campaign"
              : undefined);
          const campaignId = (details.campaignId as string | undefined) ?? (details.targetId as string | undefined);
          if (targetType === "ad_campaign" && campaignId) {
            const pubRes = await fetch(`/api/admin/ads/${campaignId}/publish`, { method: "POST" });
            if (!pubRes.ok) {
              const pj = (await pubRes.json().catch(() => ({}))) as { error?: string };
              setNotice({
                kind: "err",
                text: `Approved, but publish failed: ${pj.error || "unknown error"}. You can retry from /admin/ads.`,
              });
              await load();
              return;
            }
            setNotice({ kind: "ok", text: "Approved and published to Meta." });
            await load();
            return;
          }
        }

        setNotice({ kind: "ok", text: approved ? "Approved." : "Rejected." });
        await load();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Decision failed";
        setNotice({ kind: "err", text: msg });
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  return (
    <AdminSidebar>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <ShieldAlert className="size-6 text-orange-500" />
              Agent Approvals
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              AI-generated campaigns and high-risk actions wait here. Approving an ad campaign publishes it to Meta
              automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </header>

        {notice && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              notice.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notice.text}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
            <Inbox className="size-8 text-slate-400" />
            <p className="text-sm text-slate-500">No pending approvals. The CMO is quiet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {approvals.map((a) => {
              const details = parseDetails(a.actionDetails);
              const campaignId = (details.campaignId as string | undefined) ?? (details.targetId as string | undefined);
              const slugs = Array.isArray(details.slugs) ? (details.slugs as string[]) : [];
              const dailyBudget = typeof details.dailyBudget === "number" ? (details.dailyBudget as number) : undefined;
              const variants = typeof details.variants === "number" ? (details.variants as number) : undefined;
              const ads = typeof details.ads === "number" ? (details.ads as number) : undefined;
              return (
                <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {a.actionType}
                        </span>
                        <span className="text-xs text-slate-500">by {a.agentName}</span>
                        <span className="text-xs text-slate-400">· {formatRelative(a.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{a.reason}</p>

                      {(slugs.length > 0 || dailyBudget !== undefined || variants !== undefined) && (
                        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
                          {slugs.length > 0 && (
                            <div>
                              <dt className="text-slate-400">Services</dt>
                              <dd className="font-mono">{slugs.join(", ")}</dd>
                            </div>
                          )}
                          {dailyBudget !== undefined && (
                            <div>
                              <dt className="text-slate-400">Daily budget</dt>
                              <dd>£{dailyBudget.toFixed(2)}</dd>
                            </div>
                          )}
                          {variants !== undefined && (
                            <div>
                              <dt className="text-slate-400">DR variants</dt>
                              <dd>{variants}</dd>
                            </div>
                          )}
                          {ads !== undefined && (
                            <div>
                              <dt className="text-slate-400">Ads</dt>
                              <dd>{ads}</dd>
                            </div>
                          )}
                        </dl>
                      )}

                      {campaignId && (
                        <Link
                          href={`/admin/ads/${campaignId}`}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-orange-600 hover:underline"
                        >
                          View draft campaign <ExternalLink className="size-3" />
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy === a.id}
                        onClick={() => decide(a, false)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="size-4" /> Reject
                      </button>
                      <button
                        type="button"
                        disabled={busy === a.id}
                        onClick={() => decide(a, true)}
                        className="inline-flex items-center gap-1 rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        {busy === a.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        Approve & publish
                      </button>
                    </div>
                  </div>

                  <details className="mt-3 text-xs text-slate-500">
                    <summary className="cursor-pointer hover:text-slate-700">Raw details</summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-3 text-[11px] text-slate-700">
                      {JSON.stringify(details, null, 2)}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminSidebar>
  );
}
