"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  MousePointer,
  Target,
  BarChart3,
  RefreshCw,
  Sparkles,
  Copy,
  Check,
  Edit2,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Image as ImageIcon,
  FileText,
  Layers,
  Rocket,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface Ad {
  id: string;
  name: string;
  status: string;
  metaAdId: string | null;
  aiGenerated: boolean;
  aiVariation: string | null;
  trackingUrl: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  creative: {
    id: string;
    type: string;
    primaryText: string;
    headline: string;
    description: string | null;
    callToAction: string;
    imageUrl: string | null;
    destinationUrl: string;
    emotionalAngle: string | null;
  };
}

interface AdSet {
  id: string;
  name: string;
  status: string;
  metaAdSetId: string | null;
  dailyBudget: number | null;
  optimizationGoal: string;
  targeting: Record<string, unknown>;
  ads: Ad[];
}

interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  dailyBudget: number | null;
  startDate: string | null;
  endDate: string | null;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  metaCampaignId: string | null;
  aiGenerated: boolean;
  aiPrompt: string | null;
  createdAt: string;
  updatedAt: string;
  account: {
    name: string;
    pixelId: string | null;
    accountId: string;
  };
  adSets: AdSet[];
}

interface Metrics {
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  costPerConversion: number;
  conversionRate: number;
}

interface DailyPerformance {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedAdSet, setExpandedAdSet] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/admin/ads/${id}`);
      const data = await res.json();

      if (data.error) {
        console.error(data.error);
        return;
      }

      setCampaign(data.campaign);
      setMetrics(data.metrics);
      setDailyPerformance(data.dailyPerformance || []);

      // Expand first ad set by default
      if (data.campaign?.adSets?.length > 0) {
        setExpandedAdSet(data.campaign.adSets[0].id);
      }
    } catch (error) {
      console.error("Error fetching campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateCampaignStatus = async (newStatus: string) => {
    if (!campaign) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/ads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setCampaign({ ...campaign, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating campaign:", error);
    } finally {
      setUpdating(false);
    }
  };

  const deleteCampaign = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/ads/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/admin/ads");
      }
    } catch (error) {
      console.error("Error deleting campaign:", error);
    } finally {
      setDeleting(false);
    }
  };

  const [publishErrorDetails, setPublishErrorDetails] = useState<{
    details?: string;
    troubleshooting?: string[];
    missingVariables?: string[];
  } | null>(null);

  const publishToMeta = async () => {
    if (!campaign) return;

    setPublishing(true);
    setPublishError(null);
    setPublishErrorDetails(null);

    try {
      const res = await fetch(`/api/admin/ads/${id}/publish`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setPublishError(data.error || "Failed to publish to Meta");
        setPublishErrorDetails({
          details: data.details,
          troubleshooting: data.troubleshooting,
          missingVariables: data.missingVariables,
        });
        return;
      }

      // Refresh campaign data
      await fetchCampaign();
    } catch (error) {
      console.error("Error publishing to Meta:", error);
      setPublishError("Failed to connect to the server");
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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
        return <RefreshCw className="h-3 w-3" />;
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

  if (loading) {
    return (
      <AdminSidebar>
        <div className="p-4 lg:p-8 flex items-center justify-center min-h-screen">
          <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
        </div>
      </AdminSidebar>
    );
  }

  if (!campaign) {
    return (
      <AdminSidebar>
        <div className="p-4 lg:p-8">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Campaign Not Found</h2>
            <p className="text-slate-500 mb-4">The campaign you're looking for doesn't exist.</p>
            <Link
              href="/admin/ads"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Campaigns
            </Link>
          </div>
        </div>
      </AdminSidebar>
    );
  }

  const totalAds = campaign.adSets.reduce((sum, as) => sum + as.ads.length, 0);

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <Link
              href="/admin/ads"
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors mt-1"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900">{campaign.name}</h1>
                {campaign.aiGenerated && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Generated
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 ${getStatusColor(campaign.status)}`}>
                  {getStatusIcon(campaign.status)}
                  {campaign.status.replace("_", " ")}
                </span>
                <span>{getObjectiveLabel(campaign.objective)}</span>
                <span>{totalAds} ads</span>
                <span>Created {formatDate(campaign.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {campaign.metaCampaignId ? (
              <a
                href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${campaign.account.accountId}&selected_campaign_ids=${campaign.metaCampaignId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">View in Meta</span>
              </a>
            ) : (
              <button
                onClick={publishToMeta}
                disabled={publishing}
                className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {publishing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                <span className="hidden sm:inline">Publish to Meta</span>
                <span className="sm:hidden">Publish</span>
              </button>
            )}

            {campaign.status === "ACTIVE" ? (
              <button
                onClick={() => updateCampaignStatus("PAUSED")}
                disabled={updating}
                className="flex items-center gap-2 px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-sm font-medium rounded-lg transition-colors"
              >
                {updating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                Pause
              </button>
            ) : campaign.status !== "REJECTED" ? (
              <button
                onClick={() => updateCampaignStatus("ACTIVE")}
                disabled={updating}
                className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 text-sm font-medium rounded-lg transition-colors"
              >
                {updating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Activate
              </button>
            ) : null}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        {/* Publish Error Banner */}
        {publishError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-red-800">Failed to Publish to Meta</div>
                <p className="text-sm text-red-600 mt-1">{publishError}</p>

                {publishErrorDetails?.details && (
                  <p className="text-sm text-red-600 mt-2 bg-red-100 rounded p-2 font-mono text-xs">
                    {publishErrorDetails.details}
                  </p>
                )}

                {publishErrorDetails?.missingVariables && publishErrorDetails.missingVariables.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-red-700">Missing environment variables:</p>
                    <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                      {publishErrorDetails.missingVariables.map((v) => (
                        <li key={v} className="font-mono">{v}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {publishErrorDetails?.troubleshooting && publishErrorDetails.troubleshooting.length > 0 && (
                  <div className="mt-3 border-t border-red-200 pt-3">
                    <p className="text-xs font-medium text-red-700">Troubleshooting:</p>
                    <ul className="mt-1 text-xs text-red-600 space-y-1">
                      {publishErrorDetails.troubleshooting.map((tip, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-red-400">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-red-500 mt-3">
                  See <Link href="/docs/META_ADS_COMPLETE_SETUP.md" className="underline">setup guide</Link> for step-by-step instructions.
                </p>
              </div>
              <button
                onClick={() => {
                  setPublishError(null);
                  setPublishErrorDetails(null);
                }}
                className="text-red-400 hover:text-red-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Not Published Notice */}
        {!campaign.metaCampaignId && !publishError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-amber-800">Campaign Not Published to Meta</div>
              <p className="text-sm text-amber-600 mt-1">
                This campaign exists only in your local database. Click "Publish to Meta" to submit it to Facebook Ads Manager for review.
              </p>
            </div>
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <DollarSign className="h-4 w-4" />
              Spend
            </div>
            <div className="text-lg lg:text-xl font-bold text-slate-900">{formatCurrency(campaign.totalSpend)}</div>
            {campaign.dailyBudget && (
              <div className="text-xs text-slate-400 mt-1">{formatCurrency(campaign.dailyBudget)}/day</div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Eye className="h-4 w-4" />
              Impressions
            </div>
            <div className="text-lg lg:text-xl font-bold text-slate-900">{formatNumber(campaign.totalImpressions)}</div>
            {metrics && (
              <div className="text-xs text-slate-400 mt-1">CPM: {formatCurrency(metrics.cpm)}</div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <MousePointer className="h-4 w-4" />
              Clicks
            </div>
            <div className="text-lg lg:text-xl font-bold text-slate-900">{formatNumber(campaign.totalClicks)}</div>
            {metrics && (
              <div className="text-xs text-slate-400 mt-1">CPC: {formatCurrency(metrics.cpc)}</div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <BarChart3 className="h-4 w-4" />
              CTR
            </div>
            <div className={`text-lg lg:text-xl font-bold ${metrics && metrics.ctr >= 1 ? "text-green-600" : "text-slate-900"}`}>
              {metrics?.ctr.toFixed(2)}%
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Target className="h-4 w-4" />
              Conversions
            </div>
            <div className="text-lg lg:text-xl font-bold text-slate-900">{campaign.totalConversions}</div>
            {metrics && metrics.costPerConversion > 0 && (
              <div className="text-xs text-slate-400 mt-1">Cost: {formatCurrency(metrics.costPerConversion)}</div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <DollarSign className="h-4 w-4" />
              Revenue
            </div>
            <div className="text-lg lg:text-xl font-bold text-green-600">{formatCurrency(campaign.totalRevenue)}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              {metrics && metrics.roas >= 1 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              ROAS
            </div>
            <div className={`text-lg lg:text-xl font-bold ${metrics && metrics.roas >= 1 ? "text-green-600" : "text-red-600"}`}>
              {metrics?.roas.toFixed(2)}x
            </div>
          </div>
        </div>

        {/* Performance Chart Placeholder */}
        {dailyPerformance.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Performance (Last 30 Days)</h2>
            <div className="h-48 flex items-center justify-center bg-slate-50 rounded-lg">
              <div className="text-center text-slate-500">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm">Chart visualization coming soon</p>
                <p className="text-xs text-slate-400 mt-1">{dailyPerformance.length} days of data available</p>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Details */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              Schedule
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Start Date</span>
                <span className="text-slate-900 font-medium">{formatDate(campaign.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">End Date</span>
                <span className="text-slate-900 font-medium">{formatDate(campaign.endDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Daily Budget</span>
                <span className="text-slate-900 font-medium">
                  {campaign.dailyBudget ? formatCurrency(campaign.dailyBudget) : "Not set"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-slate-400" />
              Objective
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Type</span>
                <span className="text-slate-900 font-medium">{getObjectiveLabel(campaign.objective)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Optimization</span>
                <span className="text-slate-900 font-medium">
                  {campaign.adSets[0]?.optimizationGoal || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pixel</span>
                <span className="text-slate-900 font-medium font-mono text-xs">
                  {campaign.account.pixelId || "Not configured"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-400" />
              Structure
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Ad Sets</span>
                <span className="text-slate-900 font-medium">{campaign.adSets.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Ads</span>
                <span className="text-slate-900 font-medium">{totalAds}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Meta Campaign ID</span>
                <span className="text-slate-900 font-medium font-mono text-xs">
                  {campaign.metaCampaignId || "Not published"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ad Sets & Ads */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Ad Sets & Ads</h2>
          </div>

          <div className="divide-y divide-slate-200">
            {campaign.adSets.map((adSet) => (
              <div key={adSet.id}>
                {/* Ad Set Header */}
                <button
                  onClick={() => setExpandedAdSet(expandedAdSet === adSet.id ? null : adSet.id)}
                  className="w-full p-4 lg:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Layers className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{adSet.name}</div>
                      <div className="text-sm text-slate-500">
                        {adSet.ads.length} ads • {adSet.optimizationGoal}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(adSet.status)}`}>
                      {adSet.status}
                    </span>
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${expandedAdSet === adSet.id ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Ads List */}
                {expandedAdSet === adSet.id && (
                  <div className="bg-slate-50 border-t border-slate-200">
                    {adSet.ads.map((ad) => (
                      <div key={ad.id} className="p-4 lg:p-6 border-b border-slate-200 last:border-b-0">
                        <div className="flex flex-col lg:flex-row gap-4">
                          {/* Creative Preview */}
                          <div className="lg:w-64 flex-shrink-0">
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                              {ad.creative.imageUrl ? (
                                <img
                                  src={ad.creative.imageUrl}
                                  alt={ad.name}
                                  className="w-full h-32 object-cover"
                                />
                              ) : (
                                <div className="w-full h-32 bg-slate-100 flex items-center justify-center">
                                  <ImageIcon className="h-8 w-8 text-slate-300" />
                                </div>
                              )}
                              <div className="p-3">
                                <div className="font-medium text-slate-900 text-sm line-clamp-2">
                                  {ad.creative.headline}
                                </div>
                                <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                                  {ad.creative.primaryText}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Ad Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <h4 className="font-medium text-slate-900">{ad.name}</h4>
                              {ad.aiGenerated && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                  {ad.aiVariation || "AI"}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(ad.status)}`}>
                                {ad.status}
                              </span>
                            </div>

                            {/* Ad Metrics */}
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                              <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-500">Spend</div>
                                <div className="font-semibold text-slate-900 text-sm">{formatCurrency(ad.spend)}</div>
                              </div>
                              <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-500">Impr.</div>
                                <div className="font-semibold text-slate-900 text-sm">{formatNumber(ad.impressions)}</div>
                              </div>
                              <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-500">Clicks</div>
                                <div className="font-semibold text-slate-900 text-sm">{formatNumber(ad.clicks)}</div>
                              </div>
                              <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-500">CTR</div>
                                <div className="font-semibold text-slate-900 text-sm">
                                  {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0"}%
                                </div>
                              </div>
                              <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-500">Conv.</div>
                                <div className="font-semibold text-slate-900 text-sm">{ad.conversions}</div>
                              </div>
                              <div className="text-center p-2 bg-white rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-500">Revenue</div>
                                <div className="font-semibold text-green-600 text-sm">{formatCurrency(ad.revenue)}</div>
                              </div>
                            </div>

                            {/* Tracking URL */}
                            {ad.trackingUrl && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">Tracking URL:</span>
                                <code className="flex-1 bg-slate-100 px-2 py-1 rounded text-slate-600 truncate">
                                  {ad.trackingUrl}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(ad.trackingUrl!, ad.id)}
                                  className="p-1 hover:bg-slate-200 rounded"
                                >
                                  {copied === ad.id ? (
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Delete Campaign</h3>
                  <p className="text-sm text-slate-500">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-slate-600 mb-6">
                Are you sure you want to delete <strong>{campaign.name}</strong>? This will also delete all
                associated ad sets, ads, and performance data.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteCampaign}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Campaign
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}
