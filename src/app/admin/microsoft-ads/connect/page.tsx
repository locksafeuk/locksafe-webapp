/**
 * /admin/microsoft-ads/connect — one-click OAuth consent for Microsoft
 * Advertising.
 *
 * The flow:
 *   1. Page loads → checks pre-flight envCheck via /api/admin/google-ads/preflight
 *   2. If MICROSOFT_ADS_CLIENT_ID/CLIENT_SECRET not set → show setup checklist
 *   3. If both set → "Connect to Microsoft" button enabled
 *   4. Click → POST /oauth-start → receives authorizeUrl → window.location = it
 *   5. Microsoft consent → redirects back to /oauth-callback (server-side)
 *   6. Callback exchanges code → drops refresh_token in 60s cookie → redirects
 *      back here with ?got=1
 *   7. Page detects ?got=1 → fetches /oauth-result → displays refresh_token
 *      with copy button + Vercel paste instructions
 *
 * The refresh_token is NEVER stored in our DB. Cookie is single-use.
 */

"use client";

import { useEffect, useState } from "react";

interface PreflightCheck {
  name:    string;
  pass:    boolean;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any;
}

const ENV_LABELS: Record<string, { label: string; how: string }> = {
  MICROSOFT_ADS_CUSTOMER_ID: {
    label: "Customer ID",
    how:   "ads.microsoft.com → Account & Billing → Settings → Customer ID",
  },
  MICROSOFT_ADS_ACCOUNT_ID: {
    label: "Account ID",
    how:   "ads.microsoft.com → Account & Billing → Settings → Account number",
  },
  MICROSOFT_ADS_DEVELOPER_TOKEN: {
    label: "Developer Token",
    how:   "ads.microsoft.com → Tools → Microsoft Advertising API → Request a developer token",
  },
  MICROSOFT_ADS_CLIENT_ID: {
    label: "Azure Client ID",
    how:   "portal.azure.com → App registrations → (your app) → Application (client) ID",
  },
  MICROSOFT_ADS_CLIENT_SECRET: {
    label: "Azure Client Secret",
    how:   "portal.azure.com → App registrations → (your app) → Certificates & secrets → New client secret",
  },
  MICROSOFT_ADS_REFRESH_TOKEN: {
    label: "Refresh Token",
    how:   "Click the Connect button below — this page captures it for you",
  },
};

export default function MicrosoftConnectPage() {
  const [envState, setEnvState] = useState<Record<string, boolean> | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [oauthStarting, setOauthStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadPreflight = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/google-ads/preflight", {
        credentials: "include",
        cache:       "no-store",
      });
      const j = await r.json();
      const msCheck = (j.checks as PreflightCheck[]).find((c) => c.name.includes("Microsoft Advertising"));
      if (msCheck) {
        const map: Record<string, boolean> = {};
        for (const v of msCheck.details.vars) map[v.key] = v.set;
        setEnvState(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreflight();
    const url = new URL(window.location.href);
    const got = url.searchParams.get("got");
    const err = url.searchParams.get("err");
    if (err) {
      setError(decodeURIComponent(err));
      // Strip the query so re-loads don't re-show the error.
      window.history.replaceState({}, "", url.pathname);
    } else if (got === "1") {
      // Fetch the one-time refresh token cookie.
      fetch("/api/admin/microsoft-ads/oauth-result", { credentials: "include" })
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
          const j = await r.json();
          setRefreshToken(j.refreshToken);
          window.history.replaceState({}, "", url.pathname);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }
  }, []);

  const startOAuth = async () => {
    setOauthStarting(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/microsoft-ads/oauth-start", {
        method:      "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
      const j = await r.json();
      window.location.href = j.authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setOauthStarting(false);
    }
  };

  const clientCredsReady = envState
    ? envState.MICROSOFT_ADS_CLIENT_ID && envState.MICROSOFT_ADS_CLIENT_SECRET
    : false;
  const allEnvReady = envState
    ? Object.values(envState).every(Boolean)
    : false;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Connect Microsoft Advertising</h1>
      <p className="text-sm text-gray-600 mb-6">
        Diversify off Google. UK Bing/Yahoo/DuckDuckGo CPCs run 30–60%
        lower for locksmith keywords, with an older, more affluent
        searcher. This page walks you through the OAuth consent flow —
        the only manual bit needed to start uploading Microsoft offline
        conversions from the same Stripe webhook that already runs Google.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-900 rounded text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Step 1 — refresh-token captured */}
      {refreshToken && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded">
          <h2 className="text-base font-semibold text-emerald-900 mb-2">
            ✅ Refresh token captured — paste into Vercel
          </h2>
          <p className="text-sm text-emerald-900 mb-3">
            Copy the value below into <code className="bg-white px-1 rounded">MICROSOFT_ADS_REFRESH_TOKEN</code>
            {" "}in Vercel → Project Settings → Environment Variables → Production. Then redeploy. After redeploy, pre-flight check #10 will turn green.
          </p>
          <div className="relative">
            <textarea
              readOnly
              className="w-full p-2 font-mono text-xs bg-white border rounded h-32"
              value={refreshToken}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(refreshToken);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-emerald-900 mt-2 opacity-80">
            This page will not show this token again. If you lose it,
            re-run the Connect flow to get a new one (it invalidates the old).
          </p>
        </div>
      )}

      {/* Env-var checklist */}
      {loading && <p>Loading…</p>}
      {envState && (
        <div className="border rounded p-4 mb-4">
          <h2 className="text-base font-semibold mb-3">Env var checklist</h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(ENV_LABELS).map(([key, meta]) => (
              <li key={key} className="flex items-start gap-2">
                <span className="text-lg">{envState[key] ? "✅" : "⬜"}</span>
                <div>
                  <div className="font-mono text-xs">{key}</div>
                  <div className="text-xs text-gray-700">{meta.label}</div>
                  {!envState[key] && (
                    <div className="text-[11px] text-gray-500 mt-0.5">{meta.how}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Connect button */}
      {envState && (
        <div className="border rounded p-4 mb-4">
          <h2 className="text-base font-semibold mb-2">Run the OAuth consent</h2>
          <p className="text-xs text-gray-600 mb-3">
            Clicking Connect redirects you to Microsoft, where you log in
            and grant LockSafe access to your ads account. Microsoft then
            redirects back here with the authorisation code; this page
            displays the refresh token for you to paste into Vercel.
          </p>
          <button
            onClick={startOAuth}
            disabled={!clientCredsReady || oauthStarting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {oauthStarting
              ? "Redirecting to Microsoft…"
              : clientCredsReady
                ? "Connect to Microsoft"
                : "Set CLIENT_ID + CLIENT_SECRET first"}
          </button>
          {allEnvReady && (
            <p className="text-[11px] text-emerald-700 mt-2">
              All 6 env vars set. Pre-flight check #10 should be green at
              <a className="underline ml-1" href="/admin/google-ads/preflight">/admin/google-ads/preflight</a>.
            </p>
          )}
        </div>
      )}

      <details className="text-xs text-gray-600">
        <summary className="cursor-pointer font-semibold">How this works (for the audit trail)</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>POST /api/admin/microsoft-ads/oauth-start generates a CSRF state, stores it in a 10-minute HTTP-only cookie, returns the Microsoft authorize URL.</li>
          <li>Your browser redirects to login.microsoftonline.com → you consent.</li>
          <li>Microsoft redirects to /api/admin/microsoft-ads/oauth-callback?code=…&state=… (server-side).</li>
          <li>Callback verifies the state, exchanges the code for tokens via the MS Identity Platform token endpoint, drops refresh_token in a 60-second single-use cookie, redirects to /admin/microsoft-ads/connect?got=1.</li>
          <li>This page reads /api/admin/microsoft-ads/oauth-result, which returns the refresh_token once and clears the cookie.</li>
          <li>You paste into Vercel. Done.</li>
        </ol>
        <p className="mt-2">The refresh token is never written to our database. Vercel env vars remain the single source of truth.</p>
      </details>
    </div>
  );
}
