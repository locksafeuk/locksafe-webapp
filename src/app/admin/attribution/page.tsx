"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  PoundSterling,
  Target,
  MousePointerClick,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  Facebook,
  CircleDollarSign,
} from "lucide-react";

interface AttributionData {
  source: string;
  sessions: number;
  leads: number;
  conversions: number;
  revenue: number;
  assessmentRevenue: number;
  quoteRevenue: number;
  conversionRate: number;
  avgOrderValue: number;
  costPerLead: number;
  roas: number;
}

interface DailyTrend {
  date: string;
  sessions: number;
  leads: number;
  conversions: number;
  revenue: number;
}

interface AttributionResponse {
  attribution: AttributionData[];
  totals: {
    sessions: number;
    leads: number;
    conversions: number;
    revenue: number;
    assessmentRevenue: number;
    quoteRevenue: number;
    conversionRate: number;
    avgOrderValue: number;
  };
  conversionBreakdown: Record<string, number>;
  funnelStages: Record<string, number>;
  dailyTrends: DailyTrend[];
  period: string;
}

// Source icon mapping
function getSourceIcon(source: string) {
  switch (source.toLowerCase()) {
    case "meta":
    case "facebook":
      return <Facebook className="w-4 h-4 text-blue-600" />;
    case "google":
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      );
    case "microsoft":
    case "bing":
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#F25022" d="M1 1h10v10H1z"/>
          <path fill="#7FBA00" d="M13 1h10v10H13z"/>
          <path fill="#00A4EF" d="M1 13h10v10H1z"/>
          <path fill="#FFB900" d="M13 13h10v10H13z"/>
        </svg>
      );
    case "direct":
      return <MousePointerClick className="w-4 h-4 text-gray-600" />;
    default:
      return <Target className="w-4 h-4 text-gray-500" />;
  }
}

// Format source name
function formatSourceName(source: string): string {
  const names: Record<string, string> = {
    meta: "Meta (Facebook/Instagram)",
    google: "Google Ads",
    microsoft: "Microsoft/Bing Ads",
    direct: "Direct / Organic",
    email: "Email Marketing",
    twitter: "Twitter/X",
    tiktok: "TikTok",
  };
  return names[source.toLowerCase()] || source;
}

export default function AttributionDashboard() {
  const [data, setData] = useState<AttributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/attribution?period=${period}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch attribution data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attribution & ROAS</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track conversions and revenue by traffic source
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-2 bg-white border rounded-lg p-1">
            {["7d", "30d", "90d"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Total Sessions</span>
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-gray-900">
                  {data.totals.sessions.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Total Leads</span>
                <Target className="w-5 h-5 text-green-500" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-gray-900">
                  {data.totals.leads.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Conversions</span>
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-gray-900">
                  {data.totals.conversions.toLocaleString()}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  ({data.totals.conversionRate}% rate)
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Total Revenue</span>
                <PoundSterling className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-gray-900">
                  £{data.totals.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200 p-5">
              <div className="flex items-center gap-2 text-orange-700">
                <CircleDollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Assessment Revenue</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-orange-900">
                  £{data.totals.assessmentRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-5">
              <div className="flex items-center gap-2 text-emerald-700">
                <CircleDollarSign className="w-5 h-5" />
                <span className="text-sm font-medium">Quote Revenue</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-emerald-900">
                  £{data.totals.quoteRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-5">
              <div className="flex items-center gap-2 text-blue-700">
                <BarChart3 className="w-5 h-5" />
                <span className="text-sm font-medium">Avg. Order Value</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-blue-900">
                  £{data.totals.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Attribution Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Attribution by Source</h2>
              <p className="text-sm text-gray-500 mt-1">
                Performance breakdown by traffic source
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Leads
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Conversions
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Conv. Rate
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      AOV
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.attribution.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        No attribution data available for this period
                      </td>
                    </tr>
                  ) : (
                    data.attribution.map((row, index) => (
                      <tr key={row.source} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                              {getSourceIcon(row.source)}
                            </div>
                            <span className="font-medium text-gray-900">
                              {formatSourceName(row.source)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {row.sessions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {row.leads.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-medium text-gray-900">
                            {row.conversions.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              row.conversionRate >= 10
                                ? "text-green-600"
                                : row.conversionRate >= 5
                                ? "text-orange-600"
                                : "text-gray-600"
                            }`}
                          >
                            {row.conversionRate}%
                            {row.conversionRate >= 10 && (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-semibold text-gray-900">
                            £{row.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          £{row.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Conversion Events & Funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Events */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Conversion Events
              </h3>
              <div className="space-y-3">
                {Object.entries(data.conversionBreakdown).length === 0 ? (
                  <p className="text-gray-500 text-sm">No conversion events recorded</p>
                ) : (
                  Object.entries(data.conversionBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([event, count]) => (
                      <div key={event} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-orange-600" />
                          </div>
                          <span className="font-medium text-gray-700 capitalize">
                            {event.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="font-semibold text-gray-900">{count}</span>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Funnel Stages */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Funnel Distribution
              </h3>
              <div className="space-y-3">
                {["visitor", "lead", "prospect", "customer", "advocate"].map((stage) => {
                  const count = data.funnelStages[stage] || 0;
                  const total = Object.values(data.funnelStages).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;

                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 capitalize">{stage}</span>
                        <span className="text-gray-500">
                          {count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Daily Trends Chart (Simple) */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Daily Revenue Trend (Last 30 Days)
            </h3>
            <div className="h-48 flex items-end gap-1">
              {data.dailyTrends.map((day, index) => {
                const maxRevenue = Math.max(...data.dailyTrends.map((d) => d.revenue), 1);
                const height = (day.revenue / maxRevenue) * 100;

                return (
                  <div
                    key={day.date}
                    className="flex-1 group relative"
                  >
                    <div
                      className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t transition-all hover:from-orange-600 hover:to-orange-500"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {new Date(day.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      <br />
                      £{day.revenue.toFixed(2)}
                      <br />
                      {day.conversions} conv.
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>
                {new Date(data.dailyTrends[0]?.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
              <span>
                {new Date(data.dailyTrends[data.dailyTrends.length - 1]?.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h4 className="font-semibold text-blue-900 mb-2">
              Setting Up Ad Spend Tracking for ROAS
            </h4>
            <p className="text-sm text-blue-800 mb-3">
              To calculate accurate ROAS (Return on Ad Spend) and Cost Per Lead, you'll need to import your ad spend data from each platform:
            </p>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li><strong>Meta Ads:</strong> Use the Marketing API or export from Ads Manager</li>
              <li><strong>Google Ads:</strong> Use the Google Ads API or Data Studio</li>
              <li><strong>Microsoft Ads:</strong> Use the Bing Ads API or export from UI</li>
            </ul>
            <p className="text-sm text-blue-800 mt-3">
              Consider using a tool like Supermetrics, Funnel.io, or building a custom integration to automate ad spend imports.
            </p>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          Failed to load attribution data
        </div>
      )}
    </div>
  );
}
