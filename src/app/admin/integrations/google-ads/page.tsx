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

interface ApiConfig {
  id: string;
  developerToken: string;
  oauthClientId: string;
  oauthClientSecret: string;
  loginCustomerId: string;
  redirectUri: string;
  updatedAt: string;
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
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Credentials form state
  const [form, setForm] = useState({
    developerToken: "",
    oauthClientId: "",
    oauthClientSecret: "",
    loginCustomerId: "",
    redirectUri: "",
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsRes, cfgRes] = await Promise.all([
        fetch("/api/admin/google-ads/accounts"),
        fetch("/api/admin/google-ads/config"),
      ]);
      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.accounts ?? []);
      }
      if (cfgRes.ok) {
        const data = await cfgRes.json();
        if (data.configured && data.config) {
          setApiConfig(data.config);
          setForm((prev) => ({
            ...prev,
            oauthClientId: data.config.oauthClientId || "",
            loginCustomerId: data.config.loginCustomerId || "",
            redirectUri: data.config.redirectUri || "",
          }));
        } else {
          setApiConfig(null);
          setConfigOpen(true);
          const origin = typeof window !== "undefined" ? window.location.origin : "https://locksafe.uk";
          setForm((prev) => ({
            ...prev,
            redirectUri: prev.redirectUri || `${origin}/api/admin/google-ads/oauth/callback`,
          }));
        }
      }
    } finally {
      setLoading(false);
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormSuccess(false);
    setFormSaving(true);
    try {
      const res = await fetch("/api/admin/google-ads/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Save failed");
        return;
      }
      setFormSuccess(true);
      await refresh();
      setConfigOpen(false);
    } finally {
      setFormSaving(false);
    }
  }

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

  const isConfigured = !!apiConfig;

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Google Ads Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your Google Ads API credentials, then connect via OAuth. The CMO agent will
          be able to pull metrics and publish approved campaign drafts.
        </p>
        <p className="text-sm mt-2">
          <a href="/admin/integrations/google-ads/drafts" className="text-blue-600 hover:underline">
            → View AI-generated campaign drafts
          </a>
        </p>
      </div>

      {connected && (
        <div className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">
          ✅ Google Ads connected successfully. Metrics will sync within 6 hours.
        </div>
      )}
      {errorParam && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          OAuth error: <strong>{decodeURIComponent(errorParam)}</strong>
        </div>
      )}

      {/* ── Step 1: API Credentials ───────────────────────────────────────── */}
      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
            <h2 className="font-semibold">API Credentials</h2>
            {isConfigured && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Configured</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setConfigOpen((o) => !o)}
            className="text-xs text-blue-600 hover:underline"
          >
            {configOpen ? "Collapse" : isConfigured ? "Edit" : "Set up"}
          </button>
        </div>

        {configLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !configOpen && isConfigured ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Developer Token</dt>
            <dd className="font-mono">{apiConfig.developerToken}</dd>
            <dt className="text-muted-foreground">OAuth Client ID</dt>
            <dd className="font-mono break-all">{apiConfig.oauthClientId}</dd>
            <dt className="text-muted-foreground">OAuth Client Secret</dt>
            <dd className="font-mono">{apiConfig.oauthClientSecret}</dd>
            <dt className="text-muted-foreground">MCC Customer ID</dt>
            <dd className="font-mono">{apiConfig.loginCustomerId}</dd>
            <dt className="text-muted-foreground">Redirect URI</dt>
            <dd className="font-mono break-all">{apiConfig.redirectUri}</dd>
          </dl>
        ) : configOpen ? (
          <form onSubmit={saveConfig} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Get these from{" "}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Google Cloud Console → Credentials
              </a>{" "}
              and the{" "}
              <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Google Ads API Centre
              </a>.
            </p>

            {(
              [
                { key: "developerToken",    label: "Developer Token",     placeholder: "xxxx-xxxx-xxxx",   type: "password", help: "From Google Ads → Tools → API Centre" },
                { key: "oauthClientId",     label: "OAuth Client ID",     placeholder: "123...apps.googleusercontent.com", type: "text", help: "OAuth 2.0 Client ID from Cloud Console" },
                { key: "oauthClientSecret", label: "OAuth Client Secret", placeholder: "GOCSPX-...",       type: "password", help: "OAuth 2.0 Client Secret from Cloud Console" },
                { key: "loginCustomerId",   label: "MCC / Customer ID",   placeholder: "1234567890",       type: "text",     help: "10-digit Google Ads Manager account ID (no dashes)" },
                { key: "redirectUri",       label: "Redirect URI",        placeholder: "https://locksafe.uk/api/admin/google-ads/oauth/callback", type: "text", help: "Must be added to the OAuth client's Authorised redirect URIs in Cloud Console" },
              ] as const
            ).map(({ key, label, placeholder, type, help }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">{label}</label>
                <input
                  type={type}
                  autoComplete="off"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-muted-foreground mt-0.5">{help}</p>
              </div>
            ))}

            {formError && (
              <p className="rounded bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">{formError}</p>
            )}
            {formSuccess && (
              <p className="rounded bg-green-50 border border-green-300 px-3 py-2 text-sm text-green-800">
                Credentials saved. You can now connect via OAuth below.
              </p>
            )}

            <button
              type="submit"
              disabled={formSaving}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {formSaving ? "Saving…" : "Save Credentials"}
            </button>
          </form>
        ) : null}
      </section>

      {/* ── Step 2: OAuth Connect ─────────────────────────────────────────── */}
      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
          <h2 className="font-semibold">Connect Account</h2>
          {accounts.some((a) => a.isActive) && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Connected</span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Click the button to authorise LockSafe to access your Google Ads account.
          {!isConfigured && <> <strong>Complete Step 1 first.</strong></>}
        </p>

        <a
          href={isConfigured ? "/api/admin/google-ads/oauth/start" : "#"}
          className={`inline-block rounded px-4 py-2 text-sm text-white transition-colors ${
            isConfigured
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed pointer-events-none"
          }`}
        >
          {accounts.some((a) => a.isActive) ? "Re-authorise Google Ads" : "Connect Google Ads"}
        </a>

        {isConfigured && (
          <p className="text-xs text-muted-foreground">
            Ensure <code className="font-mono bg-gray-100 px-1 rounded">{apiConfig?.redirectUri}</code> is
            listed as an Authorised Redirect URI in your Google Cloud OAuth client.
          </p>
        )}
      </section>

      {/* ── Connected accounts table ──────────────────────────────────────── */}
      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Connected Accounts</h2>
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
                <th className="py-2">Status</th>
                <th className="py-2">Last sync</th>
                <th className="py-2">Token expires</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2 font-mono text-xs">{a.customerId}</td>
                  <td className="py-2 font-mono text-xs">{a.loginCustomerId ?? "—"}</td>
                  <td className="py-2">
                    {a.isActive ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Active</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Stub</span>
                    )}
                  </td>
                  <td className="py-2 text-xs">{a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString() : "Never"}</td>
                  <td className="py-2 text-xs">{a.tokenExpiresAt ? new Date(a.tokenExpiresAt).toLocaleString() : "—"}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      disabled={busy}
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

      {/* ── Credential reference ─────────────────────────────────────────── */}
      <section className="rounded border bg-gray-50 p-4 space-y-2 text-sm">
        <h2 className="font-semibold text-gray-700">Where to find your credentials</h2>
        <ol className="list-decimal list-inside space-y-1 text-gray-600">
          <li>
            <strong>Developer Token</strong> — Google Ads → Tools &amp; Settings → Setup → API Centre.
            Apply for Basic access if shown as &quot;Test&quot;.
          </li>
          <li>
            <strong>OAuth Client ID &amp; Secret</strong> —{" "}
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              console.cloud.google.com → APIs &amp; Services → Credentials
            </a>{" "}
            → Create → OAuth 2.0 Client ID → Web application.
            Add the Redirect URI above to &quot;Authorised redirect URIs&quot;.
          </li>
          <li>
            <strong>MCC Customer ID</strong> — 10-digit number in the top bar of your Google Ads
            manager account (no dashes).
          </li>
        </ol>
      </section>
    </div>
  );
}
