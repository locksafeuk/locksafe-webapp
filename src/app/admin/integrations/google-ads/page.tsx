"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface GoogleAdsAccountRow {
  id: string;
  customerId: string;
  loginCustomerId: string | null;
  name: string;
  currency: string;
  timezone: string;
  isActive: boolean;
  lastSyncAt: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
}

interface SyncStatus {
  isConfigured: boolean;
  accountsConnected: number;
  lastSyncAt: string | null;
  totalSpend: number;
  totalConversions: number;
}

export default function GoogleAdsIntegrationPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <GoogleAdsIntegrationPageInner />
    </Suspense>
  );
}

function GoogleAdsIntegrationPageInner() {
  const params = useSearchParams();
  const connected = params.get("connected") === "1";
  const errorParam = params.get("error");

  const [accounts, setAccounts] = useState<GoogleAdsAccountRow[]>([]);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsRes, statusRes] = await Promise.all([
        fetch("/api/admin/google-ads/accounts"),
        fetch("/api/cron/sync-google-ads-performance"),
      ]);
      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.accounts ?? []);
      }
      if (statusRes.ok) {
        setStatus(await statusRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function disconnect(id: string) {
    if (!confirm("Disconnect this Google Ads account? Historical metrics will be retained.")) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/google-ads/accounts?id=${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Google Ads Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Google Ads / MCC account so the CMO agent can pull performance metrics. Phase 1 is read-only — no campaigns will be created or modified.
        </p>
        <p className="text-sm mt-2">
          <a href="/admin/integrations/google-ads/drafts" className="text-blue-600 hover:underline">
            → View AI-generated campaign drafts (Phase 2)
          </a>
        </p>
      </div>

      {connected && (
        <div className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">
          Connected successfully. Metrics will sync within 6 hours.
        </div>
      )}
      {errorParam && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          OAuth error: {errorParam}
        </div>
      )}

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Connection</h2>
        <a
          href="/api/admin/google-ads/oauth/start"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {accounts.length > 0 ? "Re-authorise Google Ads" : "Connect Google Ads"}
        </a>
        <p className="text-xs text-muted-foreground">
          Requires <code>GOOGLE_ADS_DEVELOPER_TOKEN</code>, <code>GOOGLE_ADS_OAUTH_CLIENT_ID</code>, <code>GOOGLE_ADS_OAUTH_CLIENT_SECRET</code>, <code>GOOGLE_ADS_LOGIN_CUSTOMER_ID</code>, <code>GOOGLE_ADS_OAUTH_REDIRECT_URI</code>.
        </p>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Sync status</h2>
        {!status ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Configured</dt>
            <dd>{status.isConfigured ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Accounts</dt>
            <dd>{status.accountsConnected}</dd>
            <dt className="text-muted-foreground">Last sync</dt>
            <dd>{status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "Never"}</dd>
            <dt className="text-muted-foreground">Spend (30d)</dt>
            <dd>£{status.totalSpend.toFixed(2)}</dd>
            <dt className="text-muted-foreground">Conversions (30d)</dt>
            <dd>{status.totalConversions}</dd>
          </dl>
        )}
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Connected accounts</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts connected yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Customer ID</th>
                <th className="py-2">MCC</th>
                <th className="py-2">Active</th>
                <th className="py-2">Last sync</th>
                <th className="py-2">Token expires</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{a.customerId}</td>
                  <td className="py-2">{a.loginCustomerId ?? "—"}</td>
                  <td className="py-2">{a.isActive ? "Yes" : "No"}</td>
                  <td className="py-2">{a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString() : "Never"}</td>
                  <td className="py-2">{a.tokenExpiresAt ? new Date(a.tokenExpiresAt).toLocaleString() : "—"}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      disabled={busy || !a.isActive}
                      onClick={() => disconnect(a.id)}
                      className="rounded border px-2 py-1 text-xs hover:bg-red-50 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
