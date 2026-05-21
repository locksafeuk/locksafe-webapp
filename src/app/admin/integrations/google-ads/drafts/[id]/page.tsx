"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface Keyword {
  text: string;
  matchType: string;
  reasoning?: string;
}

interface Draft {
  id: string;
  status: string;
  name: string;
  dailyBudget: number;
  biddingStrategy: string;
  targetCpa: number | null;
  channel: string;
  geoTargets: string[];
  languageTargets: string[];
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  keywords: Keyword[];
  negativeKeywords: string[];
  aiPrompt: string | null;
  aiReasoning: string | null;
  approvalId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  googleCampaignId: string | null;
  googleAdGroupId: string | null;
  googleAdId: string | null;
  totalSpend: number;
  totalConversions: number;
  totalRevenue: number;
  totalClicks: number;
  totalImpressions: number;
  publishError: string | null;
  publishedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  publishedSnapshot: unknown;
  snapshotAt: string | null;
  templateId: string | null;
}

export default function GoogleAdsDraftDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [resolution, setResolution] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/google-ads/drafts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDraft(data.draft);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function approve(approve: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/google-ads/drafts/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, resolution: resolution || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessage({ kind: "ok", text: approve ? "Approved" : "Rejected" });
      await refresh();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!confirm("Push this campaign to Google Ads (will be created PAUSED)?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/google-ads/drafts/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Publish failed");
      setMessage({ kind: "ok", text: `Published — campaign ${data.googleCampaignId}` });
      await refresh();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!confirm("Pause this live Google Ads campaign?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/google-ads/drafts/${id}/pause`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Pause failed");
      setMessage({ kind: "ok", text: "Paused" });
      await refresh();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function refreshSnapshot() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/google-ads/drafts/${id}/snapshot`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Snapshot failed");
      setMessage({ kind: "ok", text: "Live snapshot refreshed." });
      await refresh();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function saveAsTemplate() {
    const name = prompt(
      "Template name (used as the unique key — will overwrite if it already exists):",
      draft?.name ?? "",
    );
    if (!name) return;
    const description = prompt("Optional description for future automations:", "") || undefined;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/google-ads/drafts/${id}/save-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Save failed");
      setMessage({ kind: "ok", text: `Saved as template "${data.name}" (id ${data.templateId}).` });
      await refresh();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/google-ads/drafts/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/admin/integrations/google-ads/drafts");
      else {
        const data = await res.json();
        setMessage({ kind: "err", text: data.error || "Delete failed" });
        setBusy(false);
      }
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
      setBusy(false);
    }
  }

  if (loading || !draft) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  const canApprove = draft.status === "PENDING_APPROVAL" || draft.status === "DRAFT";
  const canPublish = draft.status === "APPROVED" && !draft.googleCampaignId;
  const canPause = draft.status === "PUBLISHED" && !!draft.googleCampaignId;
  const canDelete = !draft.googleCampaignId && draft.status !== "PUBLISHED";

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{draft.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Status: <strong>{draft.status}</strong> · Created {new Date(draft.createdAt).toLocaleString()}
          </p>
        </div>
        <Link
          href="/admin/integrations/google-ads/drafts"
          className="text-blue-600 hover:underline text-sm"
        >
          ← Back to drafts
        </Link>
      </div>

      {message && (
        <div
          className={`rounded border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-green-300 bg-green-50 text-green-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      )}

      {draft.publishError && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>Publish error:</strong> {draft.publishError}
        </div>
      )}

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">AI prompt + reasoning</h2>
        {draft.aiPrompt && (
          <div className="text-sm">
            <div className="text-muted-foreground text-xs">Prompt</div>
            <p className="whitespace-pre-wrap">{draft.aiPrompt}</p>
          </div>
        )}
        {draft.aiReasoning && (
          <div className="text-sm">
            <div className="text-muted-foreground text-xs">Reasoning</div>
            <p className="whitespace-pre-wrap">{draft.aiReasoning}</p>
          </div>
        )}
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Settings</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Daily budget</dt>
          <dd>£{draft.dailyBudget.toFixed(2)}</dd>
          <dt className="text-muted-foreground">Bidding strategy</dt>
          <dd>{draft.biddingStrategy}{draft.targetCpa ? ` · target CPA £${draft.targetCpa}` : ""}</dd>
          <dt className="text-muted-foreground">Channel</dt>
          <dd>{draft.channel}</dd>
          <dt className="text-muted-foreground">Geo targets</dt>
          <dd>{draft.geoTargets.join(", ") || "—"}</dd>
          <dt className="text-muted-foreground">Final URL</dt>
          <dd className="break-all">{draft.finalUrl}</dd>
        </dl>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Headlines ({draft.headlines.length})</h2>
        <ul className="text-sm space-y-1 list-disc pl-5">
          {draft.headlines.map((h, i) => (
            <li key={i}>{h} <span className="text-muted-foreground text-xs">({h.length}/30)</span></li>
          ))}
        </ul>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Descriptions ({draft.descriptions.length})</h2>
        <ul className="text-sm space-y-1 list-disc pl-5">
          {draft.descriptions.map((d, i) => (
            <li key={i}>{d} <span className="text-muted-foreground text-xs">({d.length}/90)</span></li>
          ))}
        </ul>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Keywords ({draft.keywords.length})</h2>
        <ul className="text-sm space-y-1">
          {draft.keywords.map((k, i) => (
            <li key={i}>
              <code className="rounded bg-gray-100 px-1">{k.matchType}</code> {k.text}
            </li>
          ))}
        </ul>
      </section>

      {draft.negativeKeywords.length > 0 && (
        <section className="rounded border p-4 space-y-3">
          <h2 className="font-semibold">Negative keywords ({draft.negativeKeywords.length})</h2>
          <p className="text-sm">{draft.negativeKeywords.join(", ")}</p>
        </section>
      )}

      {draft.googleCampaignId && (
        <section className="rounded border p-4 space-y-3">
          <h2 className="font-semibold">Live Google Ads</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Campaign ID</dt>
            <dd>{draft.googleCampaignId}</dd>
            <dt className="text-muted-foreground">Ad group ID</dt>
            <dd>{draft.googleAdGroupId}</dd>
            <dt className="text-muted-foreground">Ad ID</dt>
            <dd>{draft.googleAdId}</dd>
            <dt className="text-muted-foreground">Spend / Conversions / Revenue</dt>
            <dd>£{draft.totalSpend.toFixed(2)} · {draft.totalConversions} · £{draft.totalRevenue.toFixed(2)}</dd>
          </dl>
        </section>
      )}

      {draft.googleCampaignId && (
        <section className="rounded border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              Captured snapshot{" "}
              {draft.snapshotAt && (
                <span className="text-xs text-muted-foreground">
                  (last refreshed {new Date(draft.snapshotAt).toLocaleString()})
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={refreshSnapshot}
                disabled={busy}
                className="text-xs rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
              >
                Refresh snapshot
              </button>
              <button
                type="button"
                onClick={saveAsTemplate}
                disabled={busy}
                className="text-xs rounded bg-purple-600 px-2 py-1 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Save as automation template
              </button>
            </div>
          </div>
          {draft.templateId && (
            <p className="text-xs text-muted-foreground">
              Already linked to template id <code>{draft.templateId}</code>.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Full live state pulled back from Google Ads via GAQL. This is the
            source of truth re-used by future automated campaign creation.
          </p>
          {draft.publishedSnapshot ? (
            <details>
              <summary className="cursor-pointer text-sm text-blue-700 hover:underline">
                View raw snapshot JSON
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs">
                {JSON.stringify(draft.publishedSnapshot, null, 2)}
              </pre>
            </details>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No snapshot captured yet — click "Refresh snapshot" to pull one now.
            </p>
          )}
        </section>
      )}

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Actions</h2>
        {canApprove && (
          <div className="space-y-2">
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Optional notes (shown in approval log)"
              className="w-full rounded border px-2 py-1 text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => approve(true)}
                disabled={busy}
                className="rounded bg-green-600 px-4 py-2 text-white text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => approve(false)}
                disabled={busy}
                className="rounded border px-4 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        )}
        {canPublish && (
          <button
            type="button"
            onClick={publish}
            disabled={busy}
            className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Publish to Google Ads (PAUSED)
          </button>
        )}
        {canPause && (
          <button
            type="button"
            onClick={pause}
            disabled={busy}
            className="rounded bg-orange-600 px-4 py-2 text-white text-sm hover:bg-orange-700 disabled:opacity-50"
          >
            Pause live campaign
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={deleteDraft}
            disabled={busy}
            className="rounded border px-4 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
          >
            Delete draft
          </button>
        )}
      </section>
    </div>
  );
}
