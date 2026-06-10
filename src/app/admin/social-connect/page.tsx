"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Twitter,
  Linkedin,
  Facebook,
  Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SocialAccountData {
  id: string;
  platform: string;
  accountId: string;
  accountName: string | null;
  accountHandle: string | null;
  isActive: boolean;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
}

function PlatformIcon({ platform }: { platform: string }) {
  const cls = "w-5 h-5";
  switch (platform) {
    case "TWITTER":   return <Twitter className={cls} />;
    case "LINKEDIN":  return <Linkedin className={cls} />;
    case "FACEBOOK":  return <Facebook className={cls} />;
    case "TIKTOK":    return <Music2 className={cls} />;
    default:          return <AlertCircle className={cls} />;
  }
}

const platformColor: Record<string, string> = {
  TWITTER:   "text-sky-500 bg-sky-50",
  LINKEDIN:  "text-blue-600 bg-blue-50",
  FACEBOOK:  "text-blue-700 bg-blue-50",
  TIKTOK:    "text-slate-900 bg-slate-100",
};

const platformLabel: Record<string, string> = {
  TWITTER:   "Twitter / X",
  LINKEDIN:  "LinkedIn",
  FACEBOOK:  "Facebook",
  TIKTOK:    "TikTok",
};

const connectPaths: Record<string, string | null> = {
  TWITTER:   "/api/admin/social/twitter/connect",
  LINKEDIN:  "/api/admin/social/linkedin/connect",
  FACEBOOK:  null, // Managed via Meta Business Suite directly
  TIKTOK:    "/api/admin/social/tiktok/connect",
};

const ALL_PLATFORMS = ["TWITTER", "LINKEDIN", "FACEBOOK", "TIKTOK"];

function SocialConnectContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<SocialAccountData[]>([]);
  const [loading, setLoading] = useState(true);

  const successPlatform  = searchParams.get("success");
  const errorMsg         = searchParams.get("error");
  const connectedHandle  = searchParams.get("handle") || searchParams.get("name");

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/social/accounts");
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function getAccountForPlatform(platform: string): SocialAccountData | undefined {
    return accounts.find((a) => a.platform === platform && a.isActive);
  }

  function isPlaceholder(account: SocialAccountData): boolean {
    return account.accountId.startsWith("PLACEHOLDER");
  }

  function isExpired(account: SocialAccountData): boolean {
    if (!account.tokenExpiresAt) return false;
    return new Date(account.tokenExpiresAt).getTime() <= Date.now();
  }

  const [tiktokTesting, setTiktokTesting] = useState(false);
  const [tiktokTestResult, setTiktokTestResult] = useState<string | null>(null);

  async function sendTikTokTestPost() {
    setTiktokTesting(true);
    setTiktokTestResult(null);
    try {
      const res = await fetch("/api/admin/social/tiktok/test-post", { method: "POST" });
      const data = await res.json();
      setTiktokTestResult(
        data.success
          ? `✅ Posted to TikTok (status: ${data.status || "ok"}, id: ${data.publishId || "-"})`
          : `❌ ${data.error || "Test post failed"}`
      );
    } catch (e) {
      setTiktokTestResult(`❌ ${e instanceof Error ? e.message : "Request failed"}`);
    } finally {
      setTiktokTesting(false);
    }
  }

  return (
    <AdminSidebar>
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Social Media Accounts</h1>
          <p className="text-slate-500 mt-1">
            Connect your brand accounts so LockSafe can publish content automatically.
          </p>
        </div>

        {/* Success / Error banner */}
        {successPlatform && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-emerald-800">
                {platformLabel[successPlatform.toUpperCase()] || successPlatform} connected successfully!
              </p>
              {connectedHandle && (
                <p className="text-sm text-emerald-700 mt-0.5">Account: {connectedHandle}</p>
              )}
            </div>
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-800">Connection failed</p>
              <p className="text-sm text-red-700 mt-0.5">{decodeURIComponent(errorMsg)}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {ALL_PLATFORMS.map((platform) => {
              const account = getAccountForPlatform(platform);
              const placeholder = account ? isPlaceholder(account) : false;
              const expired    = account ? isExpired(account) : false;
              const connected  = account && !placeholder && !expired;
              const connectUrl = connectPaths[platform];
              const colors     = platformColor[platform] || "text-slate-600 bg-slate-50";

              return (
                <div
                  key={platform}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4"
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors}`}>
                    <PlatformIcon platform={platform} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{platformLabel[platform]}</span>
                      {connected && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Connected
                        </span>
                      )}
                      {expired && !placeholder && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Reconnect required
                        </span>
                      )}
                      {placeholder && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Placeholder
                        </span>
                      )}
                      {!account && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          Not connected
                        </span>
                      )}
                    </div>
                    {connected && account && (
                      <p className="text-sm text-slate-500 truncate">
                        {account.accountHandle || account.accountName}
                        {account.tokenExpiresAt && (
                          <span className="ml-2">
                            · Expires {new Date(account.tokenExpiresAt).toLocaleDateString("en-GB")}
                          </span>
                        )}
                      </p>
                    )}
                    {expired && !placeholder && account && account.tokenExpiresAt && (
                      <p className="text-sm text-amber-700 truncate">
                        {account.accountHandle || account.accountName}
                        <span className="ml-2">
                          · Token expired {new Date(account.tokenExpiresAt).toLocaleDateString("en-GB")}
                        </span>
                      </p>
                    )}
                    {!connected && platform === "FACEBOOK" && (
                      <p className="text-sm text-slate-400">
                        Managed via Meta Business Suite — token set in environment.
                      </p>
                    )}
                    {platform === "TIKTOK" && tiktokTestResult && (
                      <p className="text-sm text-slate-600 mt-1 truncate">{tiktokTestResult}</p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    {platform === "TIKTOK" && connected && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={tiktokTesting}
                        onClick={sendTikTokTestPost}
                      >
                        {tiktokTesting ? "Posting…" : "Test post"}
                      </Button>
                    )}
                    {connectUrl ? (
                      <a href={connectUrl}>
                        <Button
                          variant={connected ? "outline" : "default"}
                          size="sm"
                          className={connected ? "" : "bg-orange-500 hover:bg-orange-600 text-white"}
                        >
                          {connected ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                              Re-connect
                            </>
                          ) : expired ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                              Reconnect
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                              Connect
                            </>
                          )}
                        </Button>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Manual</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-10 bg-slate-50 rounded-2xl p-5 border border-slate-200">
          <h2 className="font-semibold text-slate-800 mb-3">Before connecting</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <span className="font-medium">Twitter:</span> Add{" "}
              <code className="bg-slate-200 px-1 rounded text-xs">TWITTER_API_KEY</code> &{" "}
              <code className="bg-slate-200 px-1 rounded text-xs">TWITTER_API_SECRET</code> to Vercel env vars.
              Register callback: <code className="bg-slate-200 px-1 rounded text-xs">/api/admin/social/twitter/callback</code>
            </li>
            <li>
              <span className="font-medium">LinkedIn:</span> Add{" "}
              <code className="bg-slate-200 px-1 rounded text-xs">LINKEDIN_CLIENT_ID</code> &{" "}
              <code className="bg-slate-200 px-1 rounded text-xs">LINKEDIN_CLIENT_SECRET</code>.
              Register callback: <code className="bg-slate-200 px-1 rounded text-xs">/api/admin/social/linkedin/callback</code>
            </li>

          </ul>
        </div>
      </div>
    </AdminSidebar>
  );
}

export default function SocialConnectPage() {
  return (
    <Suspense fallback={null}>
      <SocialConnectContent />
    </Suspense>
  );
}
