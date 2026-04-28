"use client";

import { useEffect, useState, useCallback } from "react";

interface Policy {
  id?: string;
  platform: string;
  autonomyEnabled: boolean;
  maxDailySpend: number;
  maxMonthlySpend: number;
  maxCampaignDailyBudget: number;
  minCampaignDailyBudget: number;
  autoApproveMaxBudget: number;
  maxWeeklyAutoApproveSpend: number;
  pauseRoasThreshold: number;
  pauseGraceDays: number;
  minImpressionsForPause: number;
  notifyOnAutoAction: boolean;
  notes?: string | null;
  updatedAt?: string;
}

const DEFAULTS: Omit<Policy, "platform"> = {
  autonomyEnabled: false,
  maxDailySpend: 15,
  maxMonthlySpend: 300,
  maxCampaignDailyBudget: 10,
  minCampaignDailyBudget: 2,
  autoApproveMaxBudget: 10,
  maxWeeklyAutoApproveSpend: 50,
  pauseRoasThreshold: 0.5,
  pauseGraceDays: 3,
  minImpressionsForPause: 500,
  notifyOnAutoAction: true,
};

const PLATFORMS = ["global", "google", "meta"] as const;

function withDefaults(platform: string, p?: Policy): Policy {
  return { platform, ...DEFAULTS, ...(p ?? {}) };
}

export default function MarketingPolicyPage() {
  const [policies, setPolicies] = useState<Record<string, Policy>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/agents/policy");
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, Policy> = {};
        for (const p of data.policies as Policy[]) map[p.platform] = p;
        for (const platform of PLATFORMS) {
          if (!map[platform]) map[platform] = withDefaults(platform);
        }
        setPolicies(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function update(platform: string, patch: Partial<Policy>) {
    setPolicies((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], ...patch },
    }));
  }

  async function save(platform: string) {
    setBusy(platform);
    setMessage(null);
    try {
      const p = policies[platform];
      const res = await fetch("/api/admin/agents/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage({ kind: "ok", text: `${platform} saved` });
      await refresh();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  async function killSwitch() {
    if (
      !confirm(
        "Kill switch: disable autonomy across global, google and meta. Active campaigns will NOT be paused — only further auto-actions are blocked. Continue?",
      )
    )
      return;
    setBusy("kill");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/agents/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "global", killAll: true, notes: "UI kill switch" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kill switch failed");
      setMessage({ kind: "ok", text: "Autonomy disabled across all platforms." });
      await refresh();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing autonomy policy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hard caps and kill switches for the CMO agent. The "global" row is a master kill switch — when its{" "}
          <code>autonomyEnabled</code> is false, every per-platform autonomy is blocked regardless of platform settings.
        </p>
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

      <div className="rounded border border-red-300 bg-red-50 p-4 space-y-2">
        <h2 className="font-semibold text-red-900">Emergency kill switch</h2>
        <p className="text-sm text-red-900">
          Disable autonomy on every platform immediately. Manual admin actions are unaffected. This does NOT pause active campaigns —
          go to <a href="/admin/integrations/google-ads/drafts" className="underline">Google Ads drafts</a> to pause individual ones.
        </p>
        <button
          type="button"
          disabled={busy === "kill"}
          onClick={killSwitch}
          className="rounded bg-red-600 px-4 py-2 text-white text-sm hover:bg-red-700 disabled:opacity-50"
        >
          Stop everything
        </button>
      </div>

      {PLATFORMS.map((platform) => {
        const p = policies[platform];
        if (!p) return null;
        return (
          <section key={platform} className="rounded border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold uppercase">{platform}</h2>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.autonomyEnabled}
                  onChange={(e) => update(platform, { autonomyEnabled: e.target.checked })}
                />
                Autonomy enabled
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Field label="Max daily spend (£)" value={p.maxDailySpend} onChange={(v) => update(platform, { maxDailySpend: v })} />
              <Field
                label="Max monthly spend (£)"
                value={p.maxMonthlySpend}
                onChange={(v) => update(platform, { maxMonthlySpend: v })}
              />
              <Field
                label="Max per-campaign daily (£)"
                value={p.maxCampaignDailyBudget}
                onChange={(v) => update(platform, { maxCampaignDailyBudget: v })}
              />
              <Field
                label="Min per-campaign daily (£)"
                value={p.minCampaignDailyBudget}
                onChange={(v) => update(platform, { minCampaignDailyBudget: v })}
              />
              <Field
                label="Auto-approve max (£/day)"
                value={p.autoApproveMaxBudget}
                onChange={(v) => update(platform, { autoApproveMaxBudget: v })}
              />
              <Field
                label="Auto-approve weekly cap (£)"
                value={p.maxWeeklyAutoApproveSpend}
                onChange={(v) => update(platform, { maxWeeklyAutoApproveSpend: v })}
              />
              <Field
                label="Pause ROAS threshold"
                value={p.pauseRoasThreshold}
                step={0.1}
                onChange={(v) => update(platform, { pauseRoasThreshold: v })}
              />
              <Field
                label="Pause grace days"
                value={p.pauseGraceDays}
                step={1}
                onChange={(v) => update(platform, { pauseGraceDays: Math.round(v) })}
              />
              <Field
                label="Min impressions to pause"
                value={p.minImpressionsForPause}
                step={50}
                onChange={(v) => update(platform, { minImpressionsForPause: Math.round(v) })}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.notifyOnAutoAction}
                  onChange={(e) => update(platform, { notifyOnAutoAction: e.target.checked })}
                />
                Notify on auto-action (Telegram)
              </label>
            </div>

            <button
              type="button"
              disabled={busy === platform}
              onClick={() => save(platform)}
              className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Save {platform}
            </button>
          </section>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input
        type="number"
        step={step ?? 0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border px-2 py-1"
      />
    </label>
  );
}
