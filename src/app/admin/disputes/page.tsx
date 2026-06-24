"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  FileText,
  Send,
  StickyNote,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface DisputeRow {
  id: string;
  stripeDisputeId: string;
  stripeChargeId: string;
  stripePaymentIntentId: string | null;
  jobId: string;
  amount: number;
  reason: string;
  status: string;
  dueBy: string | null;
  hasGpsData: boolean;
  hasPhotos: boolean;
  hasSignature: boolean;
  hasReport: boolean;
  submittedAt: string | null;
  submittedBy: string | null;
  notes: string | null;
  outcome: string | null;
  createdAt: string;
  job: {
    jobNumber: string;
    customer: { name: string } | null;
    locksmith: { name: string } | null;
  } | null;
}

interface Stats {
  total: number;
  needsResponse: number;
  underReview: number;
  won: number;
  lost: number;
  totalExposed: number;
}

const STATUS_CONFIG: Record<string, { label: string; colour: string; icon: React.ElementType }> = {
  needs_response: { label: "Needs Response", colour: "bg-red-100 text-red-800", icon: AlertTriangle },
  warning_needs_response: { label: "Warning — Respond", colour: "bg-orange-100 text-orange-800", icon: AlertTriangle },
  under_review: { label: "Under Review", colour: "bg-yellow-100 text-yellow-800", icon: Clock },
  warning_under_review: { label: "Under Review", colour: "bg-yellow-100 text-yellow-800", icon: Clock },
  won: { label: "Won", colour: "bg-green-100 text-green-800", icon: CheckCircle2 },
  lost: { label: "Lost", colour: "bg-red-100 text-red-800", icon: XCircle },
  charge_refunded: { label: "Refunded", colour: "bg-gray-100 text-gray-600", icon: XCircle },
  warning_closed: { label: "Closed", colour: "bg-gray-100 text-gray-600", icon: CheckCircle2 },
};

const REASON_LABELS: Record<string, string> = {
  fraudulent: "Fraudulent",
  duplicate: "Duplicate charge",
  product_not_received: "Service not received",
  product_unacceptable: "Service unacceptable",
  unrecognized: "Unrecognized",
  credit_not_processed: "Credit not processed",
  general: "General",
};

function EvidenceBadge({ has, label }: { has: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
        has ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
      }`}
    >
      {has ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/disputes", { credentials: "include" });
      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      if (!res.ok) { console.error("[disputes] load failed:", res.status); return; }
      const data = await res.json();
      setDisputes(data.disputes ?? []);
      setStats(data.stats ?? null);
      const noteMap: Record<string, string> = {};
      for (const d of data.disputes ?? []) {
        if (d.notes) noteMap[d.id] = d.notes;
      }
      setNotes(noteMap);
    } catch (e) {
      console.error("[disputes] load error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const submitEvidence = async (disputeId: string) => {
    setSubmittingId(disputeId);
    try {
      const res = await fetch("/api/admin/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_evidence", disputeId }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error ?? "Failed to submit");
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const previewEvidence = async (disputeId: string) => {
    setPreviewId(disputeId);
    const res = await fetch("/api/admin/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview_evidence", disputeId }),
    });
    const data = await res.json();
    if (data.evidence) {
      setPreviewText(JSON.stringify(data.evidence, null, 2));
    }
  };

  const saveNotes = async (disputeId: string) => {
    await fetch("/api/admin/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_notes", disputeId, notes: notes[disputeId] ?? "" }),
    });
  };

  const filtered = filter === "all" ? disputes : disputes.filter((d) => d.status === filter);

  const daysUntilDue = (dueBy: string | null) => {
    if (!dueBy) return null;
    const diff = Math.ceil((new Date(dueBy).getTime() - Date.now()) / 86400000);
    return diff;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <AdminSidebar>
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disputes & Chargebacks</h1>
        <p className="text-sm text-gray-500 mt-1">Manage Stripe chargebacks with auto-compiled evidence</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Needs response", value: stats.needsResponse, colour: "text-red-600 bg-red-50", urgent: true },
            { label: "Under review", value: stats.underReview, colour: "text-yellow-600 bg-yellow-50", urgent: false },
            { label: "Won", value: stats.won, colour: "text-green-600 bg-green-50", urgent: false },
            { label: "Lost", value: stats.lost, colour: "text-gray-600 bg-gray-50", urgent: false },
            { label: "Funds at risk", value: `£${stats.totalExposed.toFixed(2)}`, colour: "text-red-600 bg-red-50", urgent: false },
          ].map(({ label, value, colour, urgent }) => (
            <div
              key={label}
              className={`bg-white border rounded-xl p-4 ${urgent && stats.needsResponse > 0 ? "border-red-300 shadow-sm" : "border-gray-200"}`}
            >
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-xl font-bold mt-1 ${colour.split(" ")[0]}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "needs_response", "warning_needs_response", "under_review", "won", "lost"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === s ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Dispute list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <Shield className="w-10 h-10 text-green-400 mx-auto mb-2" />
            <p className="font-medium text-gray-700">No disputes to show</p>
            <p className="text-sm text-gray-400 mt-1">You&apos;re all clear in this category</p>
          </div>
        ) : (
          filtered.map((d) => {
            const statusCfg = STATUS_CONFIG[d.status] ?? { label: d.status, colour: "bg-gray-100 text-gray-600", icon: Clock };
            const StatusIcon = statusCfg.icon;
            const days = daysUntilDue(d.dueBy);
            const isExpanded = expandedId === d.id;
            const needsAction = ["needs_response", "warning_needs_response"].includes(d.status);

            return (
              <div
                key={d.id}
                className={`bg-white border rounded-xl overflow-hidden ${needsAction ? "border-red-300" : "border-gray-200"}`}
              >
                {/* Header row */}
                <div
                  className="p-4 flex items-start gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${statusCfg.colour}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">£{d.amount.toFixed(2)}</span>
                      <span className="text-sm text-gray-500">{REASON_LABELS[d.reason] ?? d.reason}</span>
                      {d.job && (
                        <span className="text-xs text-gray-400">Job #{d.job.jobNumber}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {d.job?.customer && <span>Customer: {d.job.customer.name}</span>}
                      {d.job?.locksmith && <span>Locksmith: {d.job.locksmith.name}</span>}
                      <span>Opened: {new Date(d.createdAt).toLocaleDateString("en-GB")}</span>
                      {days !== null && (
                        <span className={days <= 3 ? "text-red-600 font-medium" : ""}>
                          Response due: {days > 0 ? `${days} days` : "OVERDUE"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <EvidenceBadge has={d.hasGpsData} label="GPS" />
                      <EvidenceBadge has={d.hasPhotos} label="Photos" />
                      <EvidenceBadge has={d.hasSignature} label="Signature" />
                      <EvidenceBadge has={d.hasReport} label="PDF Report" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {needsAction && !d.submittedAt && (
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white gap-1"
                        onClick={(e) => { e.stopPropagation(); submitEvidence(d.id); }}
                        disabled={submittingId === d.id}
                      >
                        {submittingId === d.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        Submit Evidence
                      </Button>
                    )}
                    {d.submittedAt && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Submitted
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Stripe Dispute ID</p>
                        <p className="font-mono text-xs mt-0.5">{d.stripeDisputeId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Charge ID</p>
                        <p className="font-mono text-xs mt-0.5">{d.stripeChargeId}</p>
                      </div>
                      {d.submittedAt && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Submitted</p>
                          <p className="text-xs mt-0.5">{new Date(d.submittedAt).toLocaleString("en-GB")} by {d.submittedBy}</p>
                        </div>
                      )}
                      {d.outcome && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Outcome</p>
                          <p className={`text-xs mt-0.5 font-semibold ${d.outcome === "won" ? "text-green-600" : "text-red-600"}`}>
                            {d.outcome.toUpperCase()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => previewEvidence(d.id)}
                        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview Evidence
                      </button>
                      {!d.submittedAt && needsAction && (
                        <button
                          onClick={() => submitEvidence(d.id)}
                          disabled={submittingId === d.id}
                          className="flex items-center gap-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Submit to Stripe
                        </button>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                        <StickyNote className="w-3 h-3" /> Internal Notes
                      </label>
                      <textarea
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
                        placeholder="Add notes for this dispute..."
                        value={notes[d.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        onBlur={() => saveNotes(d.id)}
                      />
                    </div>

                    {/* Evidence preview */}
                    {previewId === d.id && previewText && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Evidence Preview (sent to Stripe)
                        </p>
                        <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-auto max-h-64">
                          {previewText}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
    </AdminSidebar>
  );
}
