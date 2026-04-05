"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  MousePointer,
  Target,
  Play,
  Pause,
  BarChart3,
  Sparkles,
  MessageSquare,
  Link2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Settings,
  Activity,
  Book,
  Zap,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  dailyBudget: number | null;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  metaCampaignId: string | null;
  aiGenerated: boolean;
  createdAt: string;
  adSets: Array<{
    id: string;
    name: string;
    ads: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  }>;
}

interface Stats {
  totalCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  averageROAS: number;
}

interface SyncStatus {
  lastSyncAt: string | null;
  campaignsWithData: number;
  totalSpend: number;
  totalImpressions: number;
  totalConversions: number;
  isConfigured: boolean;
}

interface SyncResult {
  success: boolean;
  campaignsUpdated?: number;
  adSetsUpdated?: number;
  adsUpdated?: number;
  snapshotsCreated?: number;
  reviewsUpdated?: number;
  campaignsImported?: number;
  adSetsImported?: number;
  adsImported?: number;
  errors?: string[];
  duration?: number;
}

interface ConnectionTestResult {
  success: boolean;
  accountInfo?: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
  };
  pixelInfo?: {
    id: string;
    name: string;
  };
  pageInfo?: {
    id: string;
    name: string;
  };
  campaignCount?: number;
  errors: string[];
}

interface EnvStatus {
  meta: {
    variables: Record<string, boolean>;
    configured: number;
    total: number;
    ready: boolean;
  };
  openai: {
    variables: Record<string, boolean>;
    configured: number;
    total: number;
    ready: boolean;
  };
  summary: {
    canPublishToMeta: boolean;
    canUseAI: boolean;
    allConfigured: boolean;
  };
}

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  // Connection test state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null);

  // Environment status
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);

  useEffect(() => {
    fetchCampaigns();
    fetchSyncStatus();
    fetchEnvStatus();
  }, [statusFilter]);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`/api/admin/ads?status=${statusFilter}`);
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch("/api/admin/ads/sync");
      const data = await res.json();
      if (data.status) {
        setSyncStatus(data.status);
      }
    } catch (error) {
      console.error("Error fetching sync status:", error);
    }
  };

  const fetchEnvStatus = async () => {
    try {
      const res = await fetch("/api/admin/env-status");
      const data = await res.json();
      if (!data.error) {
        setEnvStatus(data);
      }
    } catch (error) {
      console.error("Error fetching env status:", error);
    }
  };

  const triggerSync = async (syncType: "full" | "snapshots" | "reviews" = "full") => {
    setSyncing(true);
    setSyncResult(null);
    setConnectionResult(null); // Clear connection result when syncing
    let importResult: { campaignsImported?: number; adSetsImported?: number; adsImported?: number; errors?: string[] } = {};
    const allErrors: string[] = [];

    try {
      // Step 1: First import any new campaigns from Meta Ads Manager
      if (syncType === "full") {
        console.log("[Sync] Step 1: Importing campaigns from Meta...");
        try {
          const importRes = await fetch("/api/admin/ads/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "ALL",
              includePaused: true,
              updateExisting: true,
            }),
          });
          const importData = await importRes.json();
          console.log("[Sync] Import response:", JSON.stringify(importData, null, 2));

          if (!importRes.ok) {
            const errorMsg = importData.error || importData.details || `Import failed with status ${importRes.status}`;
            allErrors.push(`Import Error: ${errorMsg}`);
          } else if (importData.result) {
            importResult = {
              campaignsImported: importData.result.campaignsImported || 0,
              adSetsImported: importData.result.adSetsImported || 0,
              adsImported: importData.result.adsImported || 0,
              errors: importData.result.errors || [],
            };
            if (importData.result.errors?.length) {
              allErrors.push(...importData.result.errors.map((e: string) => `Import: ${e}`));
            }
          }
        } catch (importError) {
          console.error("[Sync] Import fetch error:", importError);
          allErrors.push(`Import failed: ${importError instanceof Error ? importError.message : "Unknown error"}`);
        }
      }

      // Step 2: Then sync performance metrics
      console.log("[Sync] Step 2: Syncing performance metrics...");
      const res = await fetch("/api/admin/ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncType,
          includeSnapshots: syncType === "full",
        }),
      });
      const data = await res.json();
      console.log("[Sync] Sync response:", JSON.stringify(data, null, 2));

      if (!res.ok) {
        const errorMsg = data.error || data.details || `Sync failed with status ${res.status}`;
        allErrors.push(`Sync Error: ${errorMsg}`);
      } else if (data.result?.errors?.length) {
        allErrors.push(...data.result.errors.map((e: string) => `Sync: ${e}`));
      }

      // Combine import and sync results
      const combinedResult: SyncResult = {
        success: res.ok && allErrors.length === 0,
        campaignsUpdated: data.result?.campaignsUpdated || 0,
        adSetsUpdated: data.result?.adSetsUpdated || 0,
        adsUpdated: data.result?.adsUpdated || 0,
        snapshotsCreated: data.result?.snapshotsCreated || 0,
        campaignsImported: importResult.campaignsImported,
        adSetsImported: importResult.adSetsImported,
        adsImported: importResult.adsImported,
        errors: allErrors.length > 0 ? allErrors : undefined,
        duration: data.result?.duration,
      };
      setSyncResult(combinedResult);

      if (data.success) {
        await fetchCampaigns();
        await fetchSyncStatus();
      }
    } catch (error) {
      console.error("[Sync] Error triggering sync:", error);
      setSyncResult({
        success: false,
        errors: [error instanceof Error ? error.message : "Failed to trigger sync - check console for details"],
      });
    } finally {
      setSyncing(false);
    }
  };

  // Test Meta API connection
  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      console.log("[Test Connection] Testing Meta API connection...");
      const res = await fetch("/api/admin/ads/import?action=test");
      const data = await res.json();
      console.log("[Test Connection] Result:", data);
      setConnectionResult(data);
    } catch (error) {
      console.error("[Test Connection] Error:", error);
      setConnectionResult({
        success: false,
        errors: [error instanceof Error ? error.message : "Failed to test connection"],
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const formatTimeSince = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-700 border-green-200";
      case "PAUSED":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "DRAFT":
        return "bg-slate-100 text-slate-600 border-slate-200";
      case "PENDING_REVIEW":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "REJECTED":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Play className="h-3 w-3" />;
      case "PAUSED":
        return <Pause className="h-3 w-3" />;
      case "DRAFT":
        return <Clock className="h-3 w-3" />;
      case "PENDING_REVIEW":
        return <RefreshCw className="h-3 w-3 animate-spin" />;
      case "REJECTED":
        return <XCircle className="h-3 w-3" />;
      default:
        return <CheckCircle className="h-3 w-3" />;
    }
  };

  const getObjectiveLabel = (objective: string) => {
    const labels: Record<string, string> = {
      LEADS: "Lead Generation",
      SALES: "Conversions",
      TRAFFIC: "Traffic",
      AWARENESS: "Awareness",
      ENGAGEMENT: "Engagement",
      APP_INSTALLS: "App Installs",
    };
    return labels[objective] || objective;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-orange-500" />
              AI Ad Manager
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Create and manage Facebook/Instagram ads with AI assistance
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Secondary actions - row on mobile */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSyncPanel(!showSyncPanel)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium flex-1 sm:flex-none ${
                  showSyncPanel
                    ? "bg-green-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Sync</span>
                {syncStatus?.lastSyncAt && (
                  <span className="text-xs opacity-70 hidden md:inline">
                    ({formatTimeSince(syncStatus.lastSyncAt)})
                  </span>
                )}
              </button>
              <Link
                href="/admin/ads/assistant"
                className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium flex-1 sm:flex-none"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden xs:inline">Assistant</span>
              </Link>
              <Link
                href="/admin/ads/utm-builder"
                className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium flex-1 sm:flex-none"
              >
                <Link2 className="h-4 w-4" />
                <span className="hidden xs:inline">UTM</span>
              </Link>
            </div>
            {/* Primary action - full width on mobile */}
            <Link
              href="/admin/ads/create"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors text-sm w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Create Ad
            </Link>
          </div>
        </div>

        {/* Sync Panel */}
        {showSyncPanel && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Meta Performance Sync
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Pull latest performance metrics from Meta Ads Manager
                </p>
              </div>
              <div className="flex items-center gap-2">
                {syncStatus?.isConfigured ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Not configured
                  </span>
                )}
              </div>
            </div>

            {/* Sync Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Last Sync</div>
                <div className="text-lg font-semibold text-slate-900">
                  {formatTimeSince(syncStatus?.lastSyncAt || null)}
                </div>
                {syncStatus?.lastSyncAt && (
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(syncStatus.lastSyncAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Campaigns with Data</div>
                <div className="text-lg font-semibold text-slate-900">
                  {syncStatus?.campaignsWithData || 0}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Total Spend Synced</div>
                <div className="text-lg font-semibold text-slate-900">
                  {formatCurrency(syncStatus?.totalSpend || 0)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Conversions Synced</div>
                <div className="text-lg font-semibold text-slate-900">
                  {syncStatus?.totalConversions || 0}
                </div>
              </div>
            </div>

            {/* Sync Result */}
            {syncResult && (
              <div
                className={`mb-4 p-4 rounded-lg border ${
                  syncResult.success
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {syncResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className={`font-semibold ${syncResult.success ? "text-green-700" : "text-red-700"}`}>
                      {syncResult.success ? "Sync Completed" : "Sync Failed"}
                    </div>
                    {syncResult.success && (
                      <div className="text-sm text-slate-600 mt-1">
                        {/* Show imported stats if any */}
                        {(syncResult.campaignsImported || syncResult.adSetsImported || syncResult.adsImported) ? (
                          <div className="mb-1">
                            <span className="font-medium text-blue-600">Imported from Meta:</span>{" "}
                            {syncResult.campaignsImported || 0} campaigns,{" "}
                            {syncResult.adSetsImported || 0} ad sets,{" "}
                            {syncResult.adsImported || 0} ads
                          </div>
                        ) : null}
                        {/* Show updated stats */}
                        Updated: {syncResult.campaignsUpdated || 0} campaigns,{" "}
                        {syncResult.adSetsUpdated || 0} ad sets,{" "}
                        {syncResult.adsUpdated || 0} ads
                        {syncResult.snapshotsCreated ? `, ${syncResult.snapshotsCreated} snapshots` : ""}
                        {syncResult.duration ? ` (${(syncResult.duration / 1000).toFixed(1)}s)` : ""}
                      </div>
                    )}
                    {syncResult.errors && syncResult.errors.length > 0 && (
                      <div className="text-sm text-red-600 mt-2 space-y-1">
                        <div className="font-medium">Errors:</div>
                        {syncResult.errors.slice(0, 5).map((error, i) => (
                          <div key={i} className="pl-2 border-l-2 border-red-300 text-xs">
                            {error}
                          </div>
                        ))}
                        {syncResult.errors.length > 5 && (
                          <div className="text-xs text-red-400">
                            +{syncResult.errors.length - 5} more errors (check browser console)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sync Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => triggerSync("full")}
                disabled={syncing || !syncStatus?.isConfigured}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {syncing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {syncing ? "Syncing..." : "Full Sync"}
              </button>
              <button
                onClick={() => triggerSync("reviews")}
                disabled={syncing || !syncStatus?.isConfigured}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-700 rounded-lg transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Review Status Only
              </button>
              <button
                onClick={testConnection}
                disabled={testingConnection}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 disabled:bg-slate-100 disabled:cursor-not-allowed text-blue-700 rounded-lg transition-colors"
              >
                {testingConnection ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {testingConnection ? "Testing..." : "Test Connection"}
              </button>
            </div>

            {/* Connection Test Result */}
            {connectionResult && (
              <div
                className={`mt-4 p-4 rounded-lg border ${
                  connectionResult.success
                    ? "bg-blue-50 border-blue-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {connectionResult.success ? (
                    <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className={`font-semibold ${connectionResult.success ? "text-blue-700" : "text-red-700"}`}>
                      {connectionResult.success ? "Connection Successful" : "Connection Failed"}
                    </div>
                    {connectionResult.success && connectionResult.accountInfo && (
                      <div className="text-sm text-slate-600 mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Ad Account:</span>
                          <span>{connectionResult.accountInfo.name} ({connectionResult.accountInfo.id})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Currency:</span>
                          <span>{connectionResult.accountInfo.currency}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Timezone:</span>
                          <span>{connectionResult.accountInfo.timezone}</span>
                        </div>
                        {connectionResult.pixelInfo && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Pixel:</span>
                            <span>{connectionResult.pixelInfo.name} ({connectionResult.pixelInfo.id})</span>
                          </div>
                        )}
                        {connectionResult.pageInfo && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Page:</span>
                            <span>{connectionResult.pageInfo.name} ({connectionResult.pageInfo.id})</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Campaigns in Meta:</span>
                          <span className="text-green-600 font-semibold">{connectionResult.campaignCount || 0}</span>
                        </div>
                      </div>
                    )}
                    {connectionResult.errors && connectionResult.errors.length > 0 && (
                      <div className="text-sm text-red-600 mt-2 space-y-1">
                        <div className="font-medium">Errors:</div>
                        {connectionResult.errors.map((error, i) => (
                          <div key={i} className="pl-2 border-l-2 border-red-300">
                            {error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Cron Setup Info */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Settings className="h-4 w-4 text-slate-500" />
                Automatic Sync Setup
              </h3>
              <p className="text-sm text-slate-500 mb-3">
                Set up a cron job to automatically sync metrics every 6 hours.
              </p>
              <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-400 overflow-x-auto">
                <div className="text-slate-500 mb-1"># cron-job.org or Vercel Cron</div>
                <div>URL: <span className="text-green-400">/api/cron/sync-meta-performance</span></div>
                <div>Method: <span className="text-amber-400">POST</span></div>
                <div>Schedule: <span className="text-blue-400">0 */6 * * *</span> (every 6 hours)</div>
                <div>Header: <span className="text-purple-400">Authorization: Bearer YOUR_CRON_SECRET</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 lg:gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <BarChart3 className="h-4 w-4" />
                Campaigns
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">{stats.totalCampaigns}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <DollarSign className="h-4 w-4" />
                Spend
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">{formatCurrency(stats.totalSpend)}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Eye className="h-4 w-4" />
                Impressions
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">{formatNumber(stats.totalImpressions)}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <MousePointer className="h-4 w-4" />
                Clicks
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">{formatNumber(stats.totalClicks)}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Target className="h-4 w-4" />
                Conversions
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">{formatNumber(stats.totalConversions)}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <DollarSign className="h-4 w-4" />
                Revenue
              </div>
              <div className="text-xl lg:text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                {stats.averageROAS >= 1 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                ROAS
              </div>
              <div className={`text-xl lg:text-2xl font-bold ${stats.averageROAS >= 1 ? "text-green-600" : "text-red-600"}`}>
                {stats.averageROAS.toFixed(2)}x
              </div>
            </div>
          </div>
        )}

        {/* Setup Guide (if no campaigns) */}
        {!loading && campaigns.length === 0 && (
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Get Started with AI-Powered Ads
                </h3>
                <p className="text-slate-600 mb-4">
                  Connect your Meta Ads account and import existing campaigns, or create new ones with AI assistance.
                </p>

                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="text-orange-600 font-semibold mb-1">1. Setup Connection</div>
                    <p className="text-slate-500 text-sm">
                      Test your Meta API credentials and connection
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="text-orange-600 font-semibold mb-1">2. Import Campaigns</div>
                    <p className="text-slate-500 text-sm">
                      Pull existing campaigns from Meta Ads Manager
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="text-orange-600 font-semibold mb-1">3. Sync & Track</div>
                    <p className="text-slate-500 text-sm">
                      Auto-sync spend, impressions, clicks & conversions
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/admin/ads/setup"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Setup Wizard
                  </Link>
                  <Link
                    href="/admin/ads/create"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create New Ad
                  </Link>
                  <Link
                    href="/admin/ads/docs"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    <Book className="h-4 w-4" />
                    Documentation
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Filter */}
        {campaigns.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {["all", "ACTIVE", "PAUSED", "DRAFT", "PENDING_REVIEW"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-orange-500 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {status === "all" ? "All" : status.replace("_", " ")}
              </button>
            ))}
          </div>
        )}

        {/* Campaigns List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
          </div>
        ) : campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const ctr = campaign.totalImpressions > 0
                ? (campaign.totalClicks / campaign.totalImpressions) * 100
                : 0;
              const roas = campaign.totalSpend > 0
                ? campaign.totalRevenue / campaign.totalSpend
                : 0;
              const adCount = campaign.adSets.reduce((sum, as) => sum + as.ads.length, 0);

              return (
                <div
                  key={campaign.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Campaign Info */}
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Target className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                          {campaign.aiGenerated && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 ${getStatusColor(campaign.status)}`}>
                            {getStatusIcon(campaign.status)}
                            {campaign.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mt-1">
                          <span>{getObjectiveLabel(campaign.objective)}</span>
                          <span>{adCount} ads</span>
                          {campaign.dailyBudget && (
                            <span>{formatCurrency(campaign.dailyBudget)}/day</span>
                          )}
                          {campaign.metaCampaignId && (
                            <a
                              href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID}&selected_campaign_ids=${campaign.metaCampaignId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View in Ads Manager
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 lg:gap-6">
                      <div className="text-center">
                        <div className="text-xs text-slate-500">Spend</div>
                        <div className="font-semibold text-slate-900">{formatCurrency(campaign.totalSpend)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">Impressions</div>
                        <div className="font-semibold text-slate-900">{formatNumber(campaign.totalImpressions)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">Clicks</div>
                        <div className="font-semibold text-slate-900">{formatNumber(campaign.totalClicks)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">CTR</div>
                        <div className={`font-semibold ${ctr >= 1 ? "text-green-600" : "text-slate-500"}`}>
                          {ctr.toFixed(2)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">Conv.</div>
                        <div className="font-semibold text-slate-900">{campaign.totalConversions}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">ROAS</div>
                        <div className={`font-semibold ${roas >= 1 ? "text-green-600" : "text-red-600"}`}>
                          {roas.toFixed(2)}x
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        className={`p-2 rounded-lg transition-colors ${
                          campaign.status === "ACTIVE"
                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                        title={campaign.status === "ACTIVE" ? "Pause" : "Activate"}
                      >
                        {campaign.status === "ACTIVE" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                      <Link
                        href={`/admin/ads/${campaign.id}`}
                        className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Environment Variables Info - Only show when not all configured */}
        {envStatus && !envStatus.summary.allConfigured && (
        <div className="rounded-xl p-4 mt-6 border bg-amber-50 border-amber-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Environment Variables Status
            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {envStatus.meta.configured + envStatus.openai.configured} / {envStatus.meta.total + envStatus.openai.total} configured
            </span>
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium text-slate-700 flex items-center justify-between">
                <span>Meta Ads</span>
                {envStatus?.meta.ready ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Ready to publish
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                    Draft mode only
                  </span>
                )}
              </div>
              <div className="bg-slate-900 p-3 rounded-lg text-xs overflow-x-auto space-y-1">
                {envStatus?.meta.variables ? (
                  Object.entries(envStatus.meta.variables).map(([key, configured]) => (
                    <div key={key} className="flex items-center gap-2">
                      {configured ? (
                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                      )}
                      <span className={configured ? "text-green-400" : "text-red-400"}>
                        {key}
                      </span>
                      {configured && <span className="text-slate-500">= ✓ configured</span>}
                      {!configured && <span className="text-slate-500">= <span className="text-red-400">missing</span></span>}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">Loading...</div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-slate-700 flex items-center justify-between">
                <span>OpenAI (for AI features)</span>
                {envStatus?.openai.ready ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    AI enabled
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                    AI disabled
                  </span>
                )}
              </div>
              <div className="bg-slate-900 p-3 rounded-lg text-xs space-y-1">
                {envStatus?.openai.variables ? (
                  Object.entries(envStatus.openai.variables).map(([key, configured]) => (
                    <div key={key} className="flex items-center gap-2">
                      {configured ? (
                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                      )}
                      <span className={configured ? "text-green-400" : "text-red-400"}>
                        {key}
                      </span>
                      {configured && <span className="text-slate-500">= ✓ configured</span>}
                      {!configured && <span className="text-slate-500">= <span className="text-red-400">missing</span></span>}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500">Loading...</div>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-2">
                {envStatus?.summary.canPublishToMeta
                  ? "All required Meta credentials are configured. You can publish ads."
                  : "Without META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, and META_PAGE_ID, ads won't be published to Meta."}
              </p>
            </div>
          </div>
        </div>
        )}
      </div>
    </AdminSidebar>
  );
}
