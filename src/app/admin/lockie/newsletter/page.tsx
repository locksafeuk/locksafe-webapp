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
  channelMode?: "auto" | "whatsapp_only" | "sms_only";
  channelOverrideApplied?: boolean;
  channelOverrideReason?: string;
  isTemplateSend?: boolean;
  templateName?: string;
  templateVariablesSample?: string[];
  total: number;
  skipped: number;
  preview: string;
  recipients: string[];
}

interface LiveResult {
  dryRun: false;
  audience: AudienceKey;
  channelMode?: "auto" | "whatsapp_only" | "sms_only";
  channelOverrideApplied?: boolean;
  total: number;
  skipped: number;
  sent: { whatsapp: number; sms: number; failed: number };
}

interface TemplateStatusRow {
  envKey: string;
  templateName?: string;
  sid: string | null;
  status?: string;
  category?: string;
  rejectionReason?: string;
  error?: string;
}

interface TemplateStatusResponse {
  success: true;
  templates: TemplateStatusRow[];
  totals: { total: number; approved: number; pending: number; rejected: number; error: number };
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
  const [useTemplate, setUseTemplate] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string>("app_update_nudge_v1");
  const [templateVars, setTemplateVars] = useState<string>("{name}\n1.0.7");
  const [busy, setBusy] = useState(false);
  const [dryResult, setDryResult] = useState<DryRunResult | null>(null);
  const [liveResult, setLiveResult] = useState<LiveResult | BlockedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateStatus, setTemplateStatus] = useState<TemplateStatusResponse | null>(null);

  const charCount = message.trim().length;
  const charsValid = charCount >= 10 && charCount <= 1500;

  const post = async (dryRun: boolean, force = false) => {
    setBusy(true);
    setError(null);
    if (dryRun) setLiveResult(null);
    try {
      const parsedVars = templateVars
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const r = await fetch("/api/admin/lockie/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          audience,
          message,
          channel,
          dryRun,
          force,
          ...(useTemplate
            ? { templateName, templateVariables: parsedVars }
            : {}),
        }),
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

  const checkTemplateStatus = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/lockie/template-status", {
        credentials: "include",
      });
      const data = (await r.json()) as TemplateStatusResponse | { error: string };
      if (!r.ok || "error" in data) {
        setError(("error" in data && data.error) || `HTTP ${r.status}`);
      } else {
        setTemplateStatus(data);
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

          {/* §40 (2026-06-24) — Meta-approved WhatsApp template send mode */}
          <div className="border-t pt-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useTemplate}
                onChange={(e) => setUseTemplate(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="font-medium text-slate-800">Use Meta-approved WhatsApp template</span>
                <span className="block text-slate-500 text-xs mt-0.5">
                  Required for cold audiences. Bypasses the 24h-window restriction. The
                  message above becomes the SMS-fallback body / preview.
                </span>
              </span>
            </label>

            {useTemplate && (
              <div className="mt-3 space-y-3 bg-amber-50 border border-amber-200 rounded-md p-3">
                <div>
                  <Label htmlFor="templateName">Template name (Twilio Content)</Label>
                  <input
                    id="templateName"
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                    placeholder="app_update_nudge_v1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Maps to env <code className="bg-slate-100 px-1">TWILIO_CONTENT_SID_{templateName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}</code>
                  </p>
                </div>
                <div>
                  <Label htmlFor="templateVars">Template variables — one per line (maps to {`{{1}}, {{2}}…`})</Label>
                  <textarea
                    id="templateVars"
                    rows={3}
                    value={templateVars}
                    onChange={(e) => setTemplateVars(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                    placeholder="{name}&#10;1.0.7"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Use <code className="bg-slate-100 px-1">{`{name}`}</code> placeholder
                    for per-recipient substitution. Other values are sent literally.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={checkTemplateStatus}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="size-3 animate-spin" /> : null}
                    <span className="ml-1">Check approval status (all templates)</span>
                  </Button>
                </div>

                {templateStatus && (
                  <div className="mt-3 bg-white border rounded p-2 text-xs">
                    <div className="font-semibold mb-1">
                      Template status — {templateStatus.totals.approved} approved · {templateStatus.totals.pending} pending · {templateStatus.totals.rejected} rejected
                    </div>
                    <ul className="space-y-1">
                      {templateStatus.templates.map((t) => (
                        <li key={t.envKey} className="flex items-center justify-between gap-2">
                          <span className="font-mono truncate">{t.templateName ?? t.envKey}</span>
                          <span
                            className={
                              t.status === "approved"
                                ? "px-2 py-0.5 rounded bg-emerald-100 text-emerald-800"
                                : t.status === "rejected"
                                ? "px-2 py-0.5 rounded bg-red-100 text-red-800"
                                : "px-2 py-0.5 rounded bg-amber-100 text-amber-800"
                            }
                          >
                            {t.status ?? t.error ?? "?"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
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
