"use client";

/**
 * Control-plane health dashboard.
 *
 * Shows agent health, the last 24h of pipeline decisions (incl. would-reject
 * rate per action/code while in shadow mode), active locks, and the approval
 * queue with approve/reject actions. Read from /api/admin/agents/control-plane.
 */

import { useCallback, useEffect, useState } from "react";

interface AgentHealth {
  name: string;
  displayName: string;
  status: string;
  heartbeatEnabled: boolean;
  lastHeartbeat: string | null;
  nextHeartbeat: string | null;
  lastHeartbeatAgeMins: number | null;
  budgetUsedUsd: number;
  budgetRemainingUsd: number;
}

interface Approval {
  id: string;
  actionType: string;
  reason: string;
  actionDetails: string;
  createdAt: string;
}

interface Snapshot {
  generatedAt: string;
  enforcement: { alerts: boolean; dispatch: boolean; approvals: boolean };
  agents: AgentHealth[];
  decisions24h: {
    total: number;
    shadow: number;
    enforced: number;
    wouldReject: number;
    byDecision: Record<string, number>;
    byRejectCode: Record<string, number>;
    byAction: Record<string, { total: number; reject: number }>;
  };
  approvals: { pendingCount: number; pending: Approval[] };
  locks: Array<{ agent: string; nodeId: string; expiresAt: string }>;
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-slate-400"}`} />
      {label}: {on ? "ENFORCE" : "shadow"}
    </span>
  );
}

export default function ControlPlaneDashboard() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/agents/control-plane", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function resolve(approvalId: string, decision: "approved" | "rejected") {
    setBusy(approvalId);
    try {
      await fetch("/api/admin/agents/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ approvalId, decision }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="p-6 text-slate-500">Loading control plane…</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!data) return null;

  const d = data.decisions24h;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Agent Control Plane</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Pill on={data.enforcement.alerts} label="Alerts" />
          <Pill on={data.enforcement.dispatch} label="Dispatch" />
          <Pill on={data.enforcement.approvals} label="Approvals" />
          <button onClick={load} className="text-xs px-2 py-1 border border-slate-300 rounded-lg hover:bg-slate-50">Refresh</button>
        </div>
      </div>

      {/* Decisions 24h */}
      <section className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-sm text-slate-900 mb-3">Pipeline decisions (last 24h)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <Stat label="Total" value={d.total} />
          <Stat label="Would-reject" value={d.wouldReject} accent="amber" />
          <Stat label="Shadow" value={d.shadow} />
          <Stat label="Enforced" value={d.enforced} />
        </div>
        {Object.keys(d.byRejectCode).length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-slate-600 mb-1">Reject reasons</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(d.byRejectCode).map(([code, n]) => (
                <span key={code} className="text-xs bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">{code}: {n}</span>
              ))}
            </div>
          </div>
        )}
        {Object.keys(d.byAction).length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 text-xs"><th className="py-1">Action</th><th>Total</th><th>Reject</th><th>Reject %</th></tr></thead>
              <tbody>
                {Object.entries(d.byAction).map(([action, s]) => (
                  <tr key={action} className="border-t border-slate-100">
                    <td className="py-1 font-mono text-xs">{action}</td>
                    <td>{s.total}</td>
                    <td>{s.reject}</td>
                    <td>{s.total ? Math.round((s.reject / s.total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Approval queue */}
      <section className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-sm text-slate-900 mb-3">Approval queue ({data.approvals.pendingCount})</h2>
        {data.approvals.pending.length === 0 ? (
          <div className="text-sm text-slate-500">Nothing waiting for approval.</div>
        ) : (
          <div className="space-y-2">
            {data.approvals.pending.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 border border-slate-200 rounded-lg p-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-slate-900">{a.actionType}</div>
                  <div className="text-xs text-slate-500">{a.reason}</div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">{a.actionDetails}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button disabled={busy === a.id} onClick={() => resolve(a.id, "approved")} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white disabled:opacity-50">Approve</button>
                  <button disabled={busy === a.id} onClick={() => resolve(a.id, "rejected")} className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Agent health */}
      <section className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
        <h2 className="font-semibold text-sm text-slate-900 mb-3">Agent health</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500 text-xs"><th className="py-1">Agent</th><th>Status</th><th>Last heartbeat</th><th>Budget left</th></tr></thead>
          <tbody>
            {data.agents.map((a) => (
              <tr key={a.name} className="border-t border-slate-100">
                <td className="py-1">{a.displayName || a.name}</td>
                <td>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${a.status === "active" ? "bg-emerald-100 text-emerald-700" : a.status === "paused" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{a.status}</span>
                </td>
                <td className={a.lastHeartbeatAgeMins != null && a.lastHeartbeatAgeMins > 120 ? "text-amber-600" : ""}>
                  {a.lastHeartbeatAgeMins != null ? `${a.lastHeartbeatAgeMins}m ago` : "never"}
                </td>
                <td>£{a.budgetRemainingUsd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.locks.length > 0 && (
          <div className="mt-3 text-xs text-slate-500">Active locks: {data.locks.map((l) => `${l.agent}@${l.nodeId}`).join(", ")}</div>
        )}
      </section>

      <div className="text-[11px] text-slate-400">Snapshot: {new Date(data.generatedAt).toLocaleString("en-GB")}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "amber" }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className={`text-2xl font-semibold ${accent === "amber" ? "text-amber-600" : "text-slate-900"}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
