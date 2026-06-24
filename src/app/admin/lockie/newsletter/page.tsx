"use client";

/**
 * Lockie Newsletter — admin composer page.
 *
 * Compose a one-shot broadcast to a chosen audience (locksmiths or
 * customers). Dry-run preview first, then live send (WhatsApp first with
 * SMS fallback). Quiet-hours guard at 09:00–20:00 UK enforced by the API.
 *
 * Pattern (2026-06-24, Piky's idea): turn one-off broadcasts into a
 * regular Friday-brief style newsletter so locksmiths re-engage with
 * platform updates. MVP: custom message + audience. Phase 2: scheduling,
 * weekly auto-generated content, customer streams.
 */

import { useMemo, useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Lightweight Label since shadcn Label isn't in this repo.
function Label(props: React.LabelHTMLAttributes<HTMLLabelElement> & { children?: React.ReactNode }) {
  const { className, ...rest } = props;
  return (
    <label
      {...rest}
      className={"text-sm font-medium text-slate-700 " + (className ?? "")}
    />
  );
}
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, Eye, AlertTriangle, Sparkles } from "lucide-react";

type AudienceKey =
  | "all_locksmiths"
  | "silent_locksmiths"
  | "online_locksmiths"
  | "app_installed"
  | "app_missing"
  | "all_customers"
  | "active_customers_30d";

const AUDIENCE_LABEL: Record<AudienceKey, string> = {
  all_locksmiths:        "All active locksmiths",
  silent_locksmiths:     "Silent locksmiths (online but no push token)",
  online_locksmiths:     "Currently online locksmiths",
  app_installed:         "Locksmiths with app installed",
  app_missing:           "Locksmiths without app",
  all_customers:         "All customers",
  active_customers_30d:  "Customers active in last 30 days",
};

const TEMPLATES: Array<{ name: string; audience: AudienceKey; message: string }> = [
  {
    name: "v1.0.6 nudge → silent locksmiths",
    audience: "silent_locksmiths",
    message:
      "Hi 👋 LockSafe v1.0.6 is now live with crash fixes + better notifications. " +
      "Please update the app from the store and open it once — that's all it takes " +
      "to start receiving job alerts again. " +
      "Update links: Android https://play.google.com/store/apps/details?id=uk.locksafe.app " +
      "or iPhone https://apps.apple.com/app/locksafe-locksmith-partner/id6762475008 . " +
      "Questions? Reply here or email support@locksafe.uk — The LockSafe Team",
  },
  {
    name: "Friday brief template (edit before send)",
    audience: "online_locksmiths",
    message:
      "Hi 👋 Friday brief from LockSafe:\n\n" +
      "📈 [This week's platform updates]\n" +
      "• [Feature 1]\n" +
      "• [Feature 2]\n\n" +
      "💼 [Jobs in your area this week]: X requests\n\n" +
      "🛠️ Tip: [one practical tip]\n\n" +
      "Have a great weekend — reply if anything's off. The LockSafe Team",
  },
  {
    name: "Customer thank-you / re-book",
    audience: "active_customers_30d",
    message:
      "Hi 👋 Thanks for choosing LockSafe recently. If you ever need another " +
      "locksmith — emergency or planned — we're here 24/7. Book in 60 seconds: " +
      "https://www.locksafe.uk . Reply STOP to opt out.",
  },
];

interface DryRunResult {
  dryRun: true;
  audience: AudienceKey;
  total: number;
  skipped: number;
  preview: string;
  recipients: string[];
}

interface LiveResult {
  dryRun: false;
  audience: AudienceKey;
  total: number;
  skipped: number;
  sent: { whatsapp: number; sms: number; failed: number };
}

interface BlockedResult {
  blocked: true;
  reason: string;
  ukHour: number;
}

type ApiResult = DryRunResult | LiveResult | BlockedResult | { error: string };

export default function LockieNewsletterPage() {
  const [audience, setAudience] = useState<AudienceKey>("silent_locksmiths");
  const [message, setMessage] = useState<string>(TEMPLATES[0].message);
  const [channel, setChannel] = useState<"auto" | "whatsapp_only" | "sms_only">("auto");
  const [busy, setBusy] = useState(false);
  const [dryResult, setDryResult] = useState<DryRunResult | null>(null);
  const [liveResult, setLiveResult] = useState<LiveResult | BlockedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const charCount = message.trim().length;
  const charsValid = charCount >= 10 && charCount <= 1500;

  const post = async (dryRun: boolean, force = false) => {
    setBusy(true);
    setError(null);
    if (dryRun) setLiveResult(null);
    try {
      const r = await fetch("/api/admin/lockie/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ audience, message, channel, dryRun, force }),
      });
      const data: ApiResult = await r.json();
      if (!r.ok || (data as { error?: string }).error) {
        setError((data as { error?: string }).error || `HTTP ${r.status}`);
      } else if ("blocked" in data && data.blocked) {
        setLiveResult(data);
      } else if ("dryRun" in data && data.dryRun) {
        setDryResult(data);
      } else if ("dryRun" in data && !data.dryRun) {
        setLiveResult(data as LiveResult);
        setDryResult(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = (t: typeof TEMPLATES[number]) => {
    setAudience(t.audience);
    setMessage(t.message);
    setDryResult(null);
    setLiveResult(null);
    setError(null);
  };

  const canSendLive = useMemo(
    () => Boolean(dryResult && dryResult.total > 0 && charsValid && !busy),
    [dryResult, charsValid, busy],
  );

  return (
    <AdminSidebar>
      <main className="p-4 md:p-6 max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="size-6 text-indigo-600" />
            Lockie Newsletter
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            Broadcast a custom message to a targeted audience. WhatsApp first,
            SMS fallback. Quiet-hours guard 09:00–20:00 UK. Default is dry-run —
            preview before you send.
          </p>
        </header>

        <section className="bg-white rounded-lg shadow-sm border p-5 mb-5">
          <Label className="text-xs uppercase tracking-wide text-slate-500">Templates</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {TEMPLATES.map((t) => (
              <Button
                key={t.name}
                variant="outline"
                size="sm"
                onClick={() => applyTemplate(t)}
                className="text-xs"
              >
                {t.name}
              </Button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm border p-5 mb-5 space-y-4">
          <div>
            <Label htmlFor="audience">Audience</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as AudienceKey)}>
              <SelectTrigger id="audience" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AUDIENCE_LABEL) as AudienceKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {AUDIENCE_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="channel">Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger id="channel" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (WhatsApp first, SMS fallback)</SelectItem>
                <SelectItem value="whatsapp_only">WhatsApp only</SelectItem>
                <SelectItem value="sms_only">SMS only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="message">Message</Label>
              <span
                className={
                  charsValid
                    ? "text-xs text-slate-500"
                    : "text-xs text-red-600 font-medium"
                }
              >
                {charCount} / 1500 (min 10)
              </span>
            </div>
            <Textarea
              id="message"
              rows={10}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 font-mono text-sm"
              placeholder="Compose your message…"
            />
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <Button
            onClick={() => post(true)}
            disabled={busy || !charsValid}
            variant="outline"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            <span className="ml-2">Dry-run preview</span>
          </Button>

          <Button
            onClick={() => {
              if (!canSendLive) return;
              const ok = confirm(
                `Send live to ${dryResult?.total} ${audience.replace(/_/g, " ")}? This cannot be undone.`,
              );
              if (ok) post(false);
            }}
            disabled={!canSendLive}
          >
            <Send className="size-4" />
            <span className="ml-2">
              Send LIVE
              {dryResult ? ` → ${dryResult.total}` : ""}
            </span>
          </Button>

          {liveResult && "blocked" in liveResult && (
            <Button onClick={() => post(false, true)} variant="destructive" disabled={busy}>
              Force send (override quiet hours)
            </Button>
          )}
        </section>

        {error && (
          <div className="mt-5 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {dryResult && (
          <section className="mt-5 bg-indigo-50 border border-indigo-200 rounded-lg p-5">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-indigo-900">
                Dry-run preview — {AUDIENCE_LABEL[dryResult.audience]}
              </h2>
              <Badge variant="secondary">
                {dryResult.total} recipient(s) · {dryResult.skipped} skipped (no phone)
              </Badge>
            </header>
            <pre className="bg-white border border-slate-200 rounded p-3 text-sm whitespace-pre-wrap mb-3">
              {dryResult.preview}
            </pre>
            <details className="text-xs">
              <summary className="cursor-pointer text-indigo-800 font-medium">
                Show all {dryResult.recipients.length} recipients
              </summary>
              <ul className="mt-2 space-y-0.5 max-h-64 overflow-auto bg-white border rounded p-2">
                {dryResult.recipients.map((r) => (
                  <li key={r} className="text-slate-700 font-mono">{r}</li>
                ))}
              </ul>
            </details>
          </section>
        )}

        {liveResult && "sent" in liveResult && (
          <section className="mt-5 bg-emerald-50 border border-emerald-300 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-emerald-900">
              ✅ Live send complete — {AUDIENCE_LABEL[liveResult.audience]}
            </h2>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Total" value={liveResult.total} />
              <Stat label="WhatsApp" value={liveResult.sent.whatsapp} />
              <Stat label="SMS fallback" value={liveResult.sent.sms} />
              <Stat label="Failed" value={liveResult.sent.failed} muted={liveResult.sent.failed === 0} />
            </div>
          </section>
        )}

        {liveResult && "blocked" in liveResult && liveResult.blocked && (
          <section className="mt-5 bg-amber-50 border border-amber-300 rounded-lg p-5 text-sm">
            <strong className="text-amber-900">⏸ Quiet hours — send blocked</strong>
            <p className="mt-1 text-amber-900">{liveResult.reason}</p>
          </section>
        )}
      </main>
    </AdminSidebar>
  );
}

function Stat({
  label,
  value,
  muted,
}: { label: string; value: number; muted?: boolean }) {
  return (
    <div
      className={
        "rounded border p-3 " + (muted ? "bg-slate-50 text-slate-500" : "bg-white text-slate-900")
      }
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
