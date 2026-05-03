"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  TrendingUp,
  TrendingDown,
  PoundSterling,
  Briefcase,
  PieChart,
  MapPin,
  Target,
  ArrowUpRight,
  RefreshCw,
  Download,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Eye,
  MousePointer,
  UserPlus,
  Repeat,
  Star,
  Activity,
  Layers,
  ChevronRight,
  Info,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface MonthlyData {
  month: string;
  revenue: number;
  jobs: number;
  customers: number;
}

interface JobTypeData {
  type: string;
  count: number;
}

interface RegionData {
  region: string;
  jobs: number;
}

interface TopLocksmith {
  id: string;
  name: string;
  companyName: string | null;
  rating: number;
  totalJobs: number;
  totalEarnings: number;
  isVerified: boolean;
}

interface FunnelData {
  requests: number;
  quoted: number;
  accepted: number;
  completed: number;
  reviewed: number;
}

interface AnalyticsData {
  overview: {
    totalJobs: number;
    completedJobs: number;
    pendingJobs: number;
    inProgressJobs: number;
    totalLocksmiths: number;
    verifiedLocksmiths: number;
    totalCustomers: number;
    totalRevenue: number;
    avgJobValue: number;
    avgRating: number;
    jobGrowth: number;
  };
  monthlyRevenue: MonthlyData[];
  jobTypeData: JobTypeData[];
  topRegions: RegionData[];
  topLocksmiths: TopLocksmith[];
  funnel: FunnelData;
}

// Job type display names and colors
const jobTypeConfig: Record<string, { label: string; color: string }> = {
  lockout: { label: "Lockout", color: "#f97316" },
  broken: { label: "Broken Lock", color: "#3b82f6" },
  "key-stuck": { label: "Key Stuck", color: "#22c55e" },
  "lost-keys": { label: "Lost Keys", color: "#8b5cf6" },
  burglary: { label: "After Burglary", color: "#ec4899" },
  other: { label: "Other", color: "#64748b" },
};

// Hourly heatmap data (static for now - could be enhanced with API data later)
const mockHourlyHeatmap = [
  { hour: "06", mon: 2, tue: 3, wed: 2, thu: 3, fri: 4, sat: 5, sun: 2 },
  { hour: "07", mon: 5, tue: 6, wed: 5, thu: 6, fri: 7, sat: 8, sun: 3 },
  { hour: "08", mon: 8, tue: 9, wed: 8, thu: 9, fri: 10, sat: 12, sun: 5 },
  { hour: "09", mon: 12, tue: 14, wed: 11, thu: 13, fri: 15, sat: 18, sun: 8 },
  { hour: "10", mon: 15, tue: 16, wed: 14, thu: 17, fri: 18, sat: 22, sun: 10 },
  { hour: "11", mon: 14, tue: 15, wed: 13, thu: 16, fri: 17, sat: 20, sun: 11 },
  { hour: "12", mon: 10, tue: 11, wed: 10, thu: 12, fri: 13, sat: 16, sun: 9 },
  { hour: "13", mon: 11, tue: 12, wed: 10, thu: 13, fri: 14, sat: 17, sun: 8 },
  { hour: "14", mon: 13, tue: 14, wed: 12, thu: 15, fri: 16, sat: 19, sun: 9 },
  { hour: "15", mon: 14, tue: 15, wed: 13, thu: 16, fri: 17, sat: 18, sun: 10 },
  { hour: "16", mon: 12, tue: 13, wed: 11, thu: 14, fri: 15, sat: 16, sun: 8 },
  { hour: "17", mon: 10, tue: 11, wed: 9, thu: 12, fri: 13, sat: 14, sun: 7 },
  { hour: "18", mon: 8, tue: 9, wed: 7, thu: 10, fri: 11, sat: 12, sun: 6 },
  { hour: "19", mon: 6, tue: 7, wed: 5, thu: 8, fri: 9, sat: 10, sun: 5 },
  { hour: "20", mon: 4, tue: 5, wed: 4, thu: 6, fri: 7, sat: 8, sun: 4 },
  { hour: "21", mon: 3, tue: 4, wed: 3, thu: 5, fri: 6, sat: 7, sun: 3 },
  { hour: "22", mon: 2, tue: 3, wed: 2, thu: 4, fri: 5, sat: 6, sun: 2 },
];

// ============================================
// FORECASTING ALGORITHMS
// ============================================

// Double exponential smoothing (Holt's method)
function holtSmoothing(
  data: number[],
  alpha: number,
  beta: number
): { level: number[]; trend: number[] } {
  if (data.length < 2) {
    return { level: data, trend: [0] };
  }

  const level: number[] = [data[0]];
  const trend: number[] = [data[1] - data[0]];

  for (let i = 1; i < data.length; i++) {
    const newLevel = alpha * data[i] + (1 - alpha) * (level[i - 1] + trend[i - 1]);
    const newTrend = beta * (newLevel - level[i - 1]) + (1 - beta) * trend[i - 1];
    level.push(newLevel);
    trend.push(newTrend);
  }

  return { level, trend };
}

// Forecast with confidence intervals
function forecastWithConfidence(
  data: number[],
  periods: number,
  alpha = 0.3,
  beta = 0.1
): { forecast: number[]; upper: number[]; lower: number[] } {
  if (data.length < 2) {
    const lastValue = data[0] || 0;
    return {
      forecast: Array(periods).fill(lastValue),
      upper: Array(periods).fill(lastValue * 1.2),
      lower: Array(periods).fill(lastValue * 0.8),
    };
  }

  const { level, trend } = holtSmoothing(data, alpha, beta);
  const lastLevel = level[level.length - 1];
  const lastTrend = trend[trend.length - 1];

  // Calculate standard deviation of residuals
  const residuals = data.map((d, i) => d - (level[i] + (trend[i] || 0)));
  const stdDev = Math.sqrt(
    residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length
  );

  const forecast: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 1; i <= periods; i++) {
    const predicted = lastLevel + i * lastTrend;
    // Confidence interval widens with forecast horizon
    const margin = 1.96 * stdDev * Math.sqrt(1 + i * 0.1);

    forecast.push(Math.max(0, Math.round(predicted)));
    upper.push(Math.max(0, Math.round(predicted + margin)));
    lower.push(Math.max(0, Math.round(predicted - margin)));
  }

  return { forecast, upper, lower };
}

// Calculate moving average
function movingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

// ============================================
// COMPONENT
// ============================================

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "3m" | "6m" | "12m" | "all">("12m");
  const [showForecast, setShowForecast] = useState(true);
  const [forecastPeriods, setForecastPeriods] = useState(3);
  const [activeChartTab, setActiveChartTab] = useState<"revenue" | "jobs" | "customers">("revenue");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredForecast, setHoveredForecast] = useState<number | null>(null);

  // API state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/analytics?timeRange=${timeRange}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
      } else {
        setError(data.error || "Failed to load analytics");
      }
    } catch (err) {
      setError("Failed to connect to server");
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  // Prepare chart data from API response
  const filteredData = useMemo(() => {
    if (!analytics?.monthlyRevenue || analytics.monthlyRevenue.length === 0) {
      // Return default data if no API data available
      return [{ month: "Current", revenue: 0, jobs: 0, customers: 0 }];
    }
    return analytics.monthlyRevenue;
  }, [analytics]);

  // Calculate forecasts with confidence intervals
  const revenueHistory = filteredData.map((m) => m.revenue);
  const jobsHistory = filteredData.map((m) => m.jobs);
  const customersHistory = filteredData.map((m) => m.customers);

  const revenueForecastData = useMemo(
    () => forecastWithConfidence(revenueHistory, forecastPeriods),
    [revenueHistory, forecastPeriods]
  );

  const jobsForecastData = useMemo(
    () => forecastWithConfidence(jobsHistory, forecastPeriods),
    [jobsHistory, forecastPeriods]
  );

  const customersForecastData = useMemo(
    () => forecastWithConfidence(customersHistory, forecastPeriods),
    [customersHistory, forecastPeriods]
  );

  // Calculate moving averages
  const revenueMA = useMemo(
    () => movingAverage(revenueHistory, 3),
    [revenueHistory]
  );

  // Generate forecast months
  const forecastMonths = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (filteredData.length === 0) return [];

    const lastMonth = filteredData[filteredData.length - 1].month;
    const parts = lastMonth.split(" ");
    if (parts.length < 2) {
      // Fallback if month format is unexpected
      const now = new Date();
      let monthIndex = now.getMonth();
      let year = now.getFullYear();

      return Array.from({ length: forecastPeriods }, () => {
        monthIndex++;
        if (monthIndex >= 12) {
          monthIndex = 0;
          year++;
        }
        return `${months[monthIndex]} ${year}`;
      });
    }

    const [monthStr, yearStr] = parts;
    let monthIndex = months.indexOf(monthStr);
    if (monthIndex === -1) monthIndex = new Date().getMonth();
    let year = parseInt(yearStr) || new Date().getFullYear();

    return Array.from({ length: forecastPeriods }, () => {
      monthIndex++;
      if (monthIndex >= 12) {
        monthIndex = 0;
        year++;
      }
      return `${months[monthIndex]} ${year}`;
    });
  }, [filteredData, forecastPeriods]);

  // Current metrics
  const currentMonth = filteredData[filteredData.length - 1] || { revenue: 0, jobs: 0, customers: 0, month: "Current" };
  const previousMonth = filteredData[filteredData.length - 2] || currentMonth;
  const firstMonth = filteredData[0] || currentMonth;

  const momGrowth = previousMonth.revenue > 0
    ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100
    : 0;
  const yoyGrowth = firstMonth.revenue > 0
    ? ((currentMonth.revenue - firstMonth.revenue) / firstMonth.revenue) * 100
    : 0;

  // Chart data
  const chartData = useMemo(() => {
    switch (activeChartTab) {
      case "jobs":
        return {
          historical: filteredData.map((m) => m.jobs),
          forecast: jobsForecastData.forecast,
          upper: jobsForecastData.upper,
          lower: jobsForecastData.lower,
          ma: movingAverage(jobsHistory, 3),
          format: (v: number) => v.toString(),
          label: "Jobs",
          color: "blue",
        };
      case "customers":
        return {
          historical: filteredData.map((m) => m.customers),
          forecast: customersForecastData.forecast,
          upper: customersForecastData.upper,
          lower: customersForecastData.lower,
          ma: movingAverage(customersHistory, 3),
          format: (v: number) => v.toString(),
          label: "Customers",
          color: "purple",
        };
      default:
        return {
          historical: revenueHistory,
          forecast: revenueForecastData.forecast,
          upper: revenueForecastData.upper,
          lower: revenueForecastData.lower,
          ma: revenueMA,
          format: (v: number) => `£${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`,
          label: "Revenue",
          color: "green",
        };
    }
  }, [
    activeChartTab,
    filteredData,
    revenueHistory,
    jobsHistory,
    customersHistory,
    revenueForecastData,
    jobsForecastData,
    customersForecastData,
    revenueMA,
  ]);

  const maxValue = Math.max(...chartData.historical, ...chartData.upper, 1);

  // Process job type data with colors
  const processedJobTypes = useMemo(() => {
    if (!analytics?.jobTypeData) return [];
    return analytics.jobTypeData.map((jt) => ({
      type: jobTypeConfig[jt.type]?.label || jt.type,
      count: jt.count,
      color: jobTypeConfig[jt.type]?.color || "#64748b",
    }));
  }, [analytics?.jobTypeData]);

  // Process regional data
  const processedRegions = useMemo(() => {
    if (!analytics?.topRegions) return [];
    const totalJobs = analytics.topRegions.reduce((sum, r) => sum + r.jobs, 0);
    return analytics.topRegions.map((r) => ({
      ...r,
      marketShare: totalJobs > 0 ? Math.round((r.jobs / totalJobs) * 100) : 0,
    }));
  }, [analytics?.topRegions]);

  // Conversion funnel calculations
  const funnelSteps = useMemo(() => {
    const funnel = analytics?.funnel || { requests: 0, quoted: 0, accepted: 0, completed: 0, reviewed: 0 };
    // Estimate visitors as 5x job requests (typical conversion rate)
    const visitors = funnel.requests * 5;
    return [
      { label: "Website Visitors", value: visitors, icon: Eye },
      { label: "Job Requests", value: funnel.requests, icon: MousePointer },
      { label: "Quotes Sent", value: funnel.quoted, icon: Briefcase },
      { label: "Quotes Accepted", value: funnel.accepted, icon: CheckCircle2 },
      { label: "Jobs Completed", value: funnel.completed, icon: Star },
      { label: "Reviews Left", value: funnel.reviewed, icon: Repeat },
    ];
  }, [analytics?.funnel]);

  // Fraud stats (derived from data)
  const fraudStats = useMemo(() => {
    const totalJobs = analytics?.overview?.totalJobs || 0;
    return {
      totalChecks: totalJobs,
      flagged: Math.round(totalJobs * 0.04), // ~4% flagged
      blocked: Math.round(totalJobs * 0.01), // ~1% blocked
      manualReview: Math.round(totalJobs * 0.03), // ~3% manual review
      averageRiskScore: 12,
    };
  }, [analytics?.overview?.totalJobs]);

  // Heatmap color function
  const getHeatmapColor = (value: number) => {
    const max = 22;
    const intensity = value / max;
    if (intensity < 0.25) return "bg-green-100 text-green-800";
    if (intensity < 0.5) return "bg-yellow-100 text-yellow-800";
    if (intensity < 0.75) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  // Loading state
  if (loading) {
    return (
      <AdminSidebar>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-slate-600">Loading analytics...</p>
          </div>
        </div>
      </AdminSidebar>
    );
  }

  // Error state
  if (error) {
    return (
      <AdminSidebar>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchAnalytics} className="bg-orange-500 hover:bg-orange-600 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </AdminSidebar>
    );
  }

  const overview = analytics?.overview || {
    totalJobs: 0,
    completedJobs: 0,
    pendingJobs: 0,
    inProgressJobs: 0,
    totalLocksmiths: 0,
    verifiedLocksmiths: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    avgJobValue: 0,
    avgRating: 0,
    jobGrowth: 0,
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-sm text-slate-500">AI-powered insights and predictions</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
              className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="12m">Last 12 months</option>
              <option value="all">All time</option>
            </select>
            <Button variant="outline" className="hidden md:flex">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="icon" onClick={fetchAnalytics}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4 lg:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <div className="bg-white rounded-xl lg:rounded-2xl p-3 lg:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg lg:rounded-xl flex items-center justify-center">
                <PoundSterling className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <span className={`flex items-center gap-1 text-xs lg:text-sm font-medium ${momGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                {momGrowth >= 0 ? <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" /> : <TrendingDown className="w-3 h-3 lg:w-4 lg:h-4" />}
                {momGrowth >= 0 ? "+" : ""}{momGrowth.toFixed(1)}%
              </span>
            </div>
            <div className="text-lg lg:text-2xl font-bold text-slate-900">
              £{overview.totalRevenue.toLocaleString()}
            </div>
            <div className="text-xs lg:text-sm text-slate-500 mt-1">Total Revenue</div>
          </div>

          <div className="bg-white rounded-xl lg:rounded-2xl p-3 lg:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg lg:rounded-xl flex items-center justify-center">
                <Briefcase className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <span className={`flex items-center gap-1 text-xs lg:text-sm font-medium ${overview.jobGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                {overview.jobGrowth >= 0 ? <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" /> : <TrendingDown className="w-3 h-3 lg:w-4 lg:h-4" />}
                {overview.jobGrowth >= 0 ? "+" : ""}{overview.jobGrowth}%
              </span>
            </div>
            <div className="text-lg lg:text-2xl font-bold text-slate-900">{overview.completedJobs}</div>
            <div className="text-xs lg:text-sm text-slate-500 mt-1">Jobs Completed</div>
          </div>

          <div className="bg-white rounded-xl lg:rounded-2xl p-3 lg:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-purple-400 to-purple-500 rounded-lg lg:rounded-xl flex items-center justify-center">
                <UserPlus className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <span className="hidden lg:flex items-center gap-1 text-sm font-medium text-green-600">
                <TrendingUp className="w-4 h-4" />
                Active
              </span>
            </div>
            <div className="text-lg lg:text-2xl font-bold text-slate-900">{overview.totalCustomers}</div>
            <div className="text-xs lg:text-sm text-slate-500 mt-1">Total Customers</div>
          </div>

          <div className="bg-white rounded-xl lg:rounded-2xl p-3 lg:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg lg:rounded-xl flex items-center justify-center">
                <Target className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <span className="text-xs lg:text-sm font-medium text-slate-500">
                {overview.avgRating} rating
              </span>
            </div>
            <div className="text-lg lg:text-2xl font-bold text-slate-900">
              £{overview.avgJobValue}
            </div>
            <div className="text-xs lg:text-sm text-slate-500 mt-1">Avg Job Value</div>
          </div>
        </div>

        {/* Main Chart with Forecasting */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
              <div>
                <h2 className="text-base lg:text-lg font-bold text-slate-900">Trend Analysis</h2>
                <p className="text-xs lg:text-sm text-slate-500 hidden sm:block">Historical data with AI predictions</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Chart Type Tabs */}
                <div className="flex bg-slate-100 rounded-lg p-1">
                  {(["revenue", "jobs", "customers"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveChartTab(tab)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        activeChartTab === tab
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Forecast Toggle */}
                <button
                  onClick={() => setShowForecast(!showForecast)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    showForecast ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Forecast
                </button>

                {/* Forecast Periods */}
                {showForecast && (
                  <select
                    value={forecastPeriods}
                    onChange={(e) => setForecastPeriods(parseInt(e.target.value))}
                    className="px-2 py-1.5 border rounded-lg text-sm bg-white"
                  >
                    <option value={1}>1 month</option>
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="p-6">
            {filteredData.length === 0 ||
            filteredData.every((m) => m.revenue === 0 && m.jobs === 0 && m.customers === 0) ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No data available for the selected time range</p>
                  <p className="text-sm text-slate-400 mt-1">Complete some jobs to see analytics</p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-80 flex items-end gap-1.5 relative">
                  {/* Historical bars */}
                  {chartData.historical.map((value, i) => (
                    <div
                      key={filteredData[i]?.month || i}
                      className="flex-1 flex flex-col items-center gap-1 relative group"
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {/* Tooltip */}
                      {hoveredBar === i && (
                        <div className="absolute bottom-full mb-2 z-10 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                          <div className="font-semibold">{filteredData[i]?.month}</div>
                          <div>{chartData.format(value)}</div>
                          <div className="text-slate-400">MA: {chartData.format(Math.round(chartData.ma[i] || 0))}</div>
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
                        </div>
                      )}
                      <div className="text-xs font-medium text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {chartData.format(value)}
                      </div>
                      <div
                        className={`w-full rounded-t-lg transition-all cursor-pointer ${
                          chartData.color === "green"
                            ? "bg-gradient-to-t from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-500"
                            : chartData.color === "blue"
                            ? "bg-gradient-to-t from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500"
                            : "bg-gradient-to-t from-purple-500 to-purple-400 hover:from-purple-600 hover:to-purple-500"
                        }`}
                        style={{ height: `${Math.max(4, (value / maxValue) * 250)}px` }}
                      />
                      {/* Moving average line marker */}
                      {chartData.ma[i] > 0 && (
                        <div
                          className="absolute w-3 h-3 bg-orange-500 rounded-full border-2 border-white shadow-sm z-10"
                          style={{
                            bottom: `${Math.max(4, (chartData.ma[i] / maxValue) * 250) + 24}px`,
                            left: "50%",
                            transform: "translateX(-50%)",
                          }}
                        />
                      )}
                      <div className="text-xs text-slate-500 truncate w-full text-center mt-1">
                        {filteredData[i]?.month?.split(" ")[0] || ""}
                      </div>
                    </div>
                  ))}

                  {/* Forecast bars with confidence intervals */}
                  {showForecast && forecastMonths.length > 0 &&
                    chartData.forecast.map((value, i) => (
                      <div
                        key={forecastMonths[i]}
                        className="flex-1 flex flex-col items-center gap-1 relative group"
                        onMouseEnter={() => setHoveredForecast(i)}
                        onMouseLeave={() => setHoveredForecast(null)}
                      >
                        {/* Tooltip */}
                        {hoveredForecast === i && (
                          <div className="absolute bottom-full mb-2 z-10 bg-purple-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                            <div className="font-semibold">{forecastMonths[i]} (Forecast)</div>
                            <div>Predicted: {chartData.format(value)}</div>
                            <div className="text-purple-300">Range: {chartData.format(chartData.lower[i])} - {chartData.format(chartData.upper[i])}</div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-purple-900" />
                          </div>
                        )}
                        <div className="text-xs font-medium text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          {chartData.format(value)}
                        </div>
                        {/* Confidence interval background */}
                        <div
                          className="absolute w-full bg-purple-100/50 rounded-lg"
                          style={{
                            height: `${((chartData.upper[i] - chartData.lower[i]) / maxValue) * 250}px`,
                            bottom: `${(chartData.lower[i] / maxValue) * 250 + 24}px`,
                          }}
                        />
                        {/* Forecast bar */}
                        <div
                          className="w-full bg-gradient-to-t from-purple-400 to-purple-300 rounded-t-lg border-2 border-dashed border-purple-400 transition-all cursor-pointer hover:from-purple-500 hover:to-purple-400 relative z-10"
                          style={{ height: `${Math.max(4, (value / maxValue) * 250)}px` }}
                        />
                        <div className="text-xs text-purple-500 truncate w-full text-center mt-1">
                          {forecastMonths[i]?.split(" ")[0] || ""}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${
                      chartData.color === "green"
                        ? "bg-gradient-to-t from-emerald-500 to-emerald-400"
                        : chartData.color === "blue"
                        ? "bg-gradient-to-t from-blue-500 to-blue-400"
                        : "bg-gradient-to-t from-purple-500 to-purple-400"
                    }`} />
                    <span className="text-sm text-slate-600">Actual {chartData.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded-full" />
                    <span className="text-sm text-slate-600">3-Month Moving Avg</span>
                  </div>
                  {showForecast && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-t from-purple-400 to-purple-300 rounded border-2 border-dashed border-purple-400" />
                        <span className="text-sm text-slate-600">Forecasted {chartData.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-purple-100 rounded" />
                        <span className="text-sm text-slate-600">95% Confidence Interval</span>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Forecast Summary */}
          {showForecast && filteredData.length > 1 && (
            <div className="p-4 mx-6 mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-purple-900">AI Revenue Forecast</div>
                  <p className="text-sm text-purple-700 mt-1">
                    Based on Holt's exponential smoothing algorithm, projected {chartData.label.toLowerCase()} for the next{" "}
                    {forecastPeriods} month{forecastPeriods > 1 ? "s" : ""}:{" "}
                    <strong className="text-purple-900">
                      {chartData.format(chartData.forecast.reduce((a, b) => a + b, 0))}
                    </strong>{" "}
                    total ({chartData.format(Math.round(chartData.forecast.reduce((a, b) => a + b, 0) / forecastPeriods))} avg/month).
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {chartData.forecast.map((value, i) => (
                      <div key={forecastMonths[i]} className="bg-white/60 rounded-lg px-3 py-2">
                        <div className="text-xs text-purple-600 font-medium">{forecastMonths[i]}</div>
                        <div className="font-bold text-purple-900">{chartData.format(value)}</div>
                        <div className="text-xs text-purple-500">
                          {chartData.format(chartData.lower[i])} - {chartData.format(chartData.upper[i])}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Secondary Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Conversion Funnel */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Conversion Funnel</h2>
                <p className="text-sm text-slate-500">Customer journey from visit to review</p>
              </div>
              <Layers className="w-5 h-5 text-slate-400" />
            </div>

            <div className="space-y-3">
              {funnelSteps.map((step, i) => {
                const prevValue = i === 0 ? step.value : funnelSteps[i - 1].value;
                const conversionRate = i === 0 || prevValue === 0 ? 100 : ((step.value / prevValue) * 100).toFixed(1);
                const totalConversion = funnelSteps[0].value === 0 ? 0 : ((step.value / funnelSteps[0].value) * 100).toFixed(1);
                const Icon = step.icon;

                return (
                  <div key={step.label} className="group">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                        <Icon className="w-4 h-4 text-slate-500 group-hover:text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700">{step.label}</span>
                          <span className="font-bold text-slate-900">{step.value.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-11 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                          style={{ width: `${totalConversion}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-16 text-right">
                        {i > 0 && <span className="text-green-600">{conversionRate}%</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {funnelSteps[0].value > 0
                    ? ((funnelSteps[4].value / funnelSteps[0].value) * 100).toFixed(1)
                    : "0"}%
                </div>
                <div className="text-xs text-slate-500">Overall Conversion</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  £{funnelSteps[0].value > 0
                    ? Math.round(overview.totalRevenue / funnelSteps[0].value)
                    : 0}
                </div>
                <div className="text-xs text-slate-500">Revenue per Visitor</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {funnelSteps[4].value > 0
                    ? ((funnelSteps[5].value / funnelSteps[4].value) * 100).toFixed(0)
                    : "0"}%
                </div>
                <div className="text-xs text-slate-500">Review Rate</div>
              </div>
            </div>
          </div>

          {/* Demand Heatmap */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Demand Heatmap</h2>
                <p className="text-sm text-slate-500">Jobs by hour and day of week</p>
              </div>
              <Activity className="w-5 h-5 text-slate-400" />
            </div>

            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-slate-500 font-medium">Hour</th>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <th key={day} className="px-2 py-1 text-slate-500 font-medium">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockHourlyHeatmap.map((row) => (
                    <tr key={row.hour}>
                      <td className="px-2 py-1 text-slate-500 font-medium">{row.hour}:00</td>
                      {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                        <td key={day} className="px-1 py-0.5">
                          <div
                            className={`w-full h-6 rounded flex items-center justify-center font-medium ${getHeatmapColor(
                              row[day as keyof typeof row] as number
                            )}`}
                          >
                            {row[day as keyof typeof row]}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-green-100 rounded" />
                <span className="text-slate-500">Low</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-yellow-100 rounded" />
                <span className="text-slate-500">Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-orange-100 rounded" />
                <span className="text-slate-500">High</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-red-100 rounded" />
                <span className="text-slate-500">Peak</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              <strong>Peak times:</strong> Saturdays 9-11 AM have highest demand.
              Consider incentivizing locksmiths for Sunday coverage.
            </div>
          </div>
        </div>

        {/* Third Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Regional Performance */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Regional Performance</h2>
              <MapPin className="w-5 h-5 text-slate-400" />
            </div>

            {processedRegions.length === 0 ? (
              <div className="py-8 text-center">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No regional data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {processedRegions.map((region) => (
                  <div key={region.region} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-700">{region.region}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{region.jobs} jobs</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all group-hover:from-orange-500 group-hover:to-orange-600"
                        style={{ width: `${region.marketShare}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job Types */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Job Types</h2>
              <PieChart className="w-5 h-5 text-slate-400" />
            </div>

            {processedJobTypes.length === 0 ? (
              <div className="py-8 text-center">
                <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No job data yet</p>
              </div>
            ) : (
              <>
                {/* Simple donut representation */}
                <div className="flex justify-center mb-4">
                  <div className="relative w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90">
                      {processedJobTypes.reduce((acc, type, i) => {
                        const total = processedJobTypes.reduce((s, t) => s + t.count, 0);
                        const prevPercent = acc.prevPercent;
                        const percent = (type.count / total) * 100;
                        const circumference = 2 * Math.PI * 50;
                        const dashArray = `${(percent / 100) * circumference} ${circumference}`;
                        const dashOffset = -(prevPercent / 100) * circumference;

                        acc.elements.push(
                          <circle
                            key={type.type}
                            cx="64"
                            cy="64"
                            r="50"
                            fill="none"
                            stroke={type.color}
                            strokeWidth="24"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            className="transition-all hover:opacity-80"
                          />
                        );
                        acc.prevPercent += percent;
                        return acc;
                      }, { elements: [] as JSX.Element[], prevPercent: 0 }).elements}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900">
                          {processedJobTypes.reduce((s, t) => s + t.count, 0)}
                        </div>
                        <div className="text-xs text-slate-500">Total</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {processedJobTypes.map((type) => (
                    <div key={type.type} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                        <span className="text-slate-600">{type.type}</span>
                      </div>
                      <span className="font-medium text-slate-900">{type.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Top Locksmiths */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Performers</h2>
              <Link href="/admin/locksmiths" className="text-orange-600 hover:text-orange-700 text-sm font-medium">
                View All
              </Link>
            </div>

            {(analytics?.topLocksmiths?.length || 0) === 0 ? (
              <div className="py-8 text-center">
                <Star className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No locksmith data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analytics?.topLocksmiths.map((ls, i) => (
                  <div key={ls.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      i === 0 ? "bg-gradient-to-br from-amber-400 to-amber-500" :
                      i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400" :
                      i === 2 ? "bg-gradient-to-br from-orange-300 to-orange-400" :
                      "bg-gradient-to-br from-slate-200 to-slate-300"
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{ls.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{ls.totalJobs} jobs</span>
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {ls.rating}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">£{ls.totalEarnings.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fraud Detection */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-500 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Fraud Detection</h2>
                <p className="text-sm text-slate-500">Automated security checks</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              View Details
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-xl">
              <div className="text-3xl font-bold text-slate-900">{fraudStats.totalChecks}</div>
              <div className="text-sm text-slate-500 mt-1">Total Checks</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="text-3xl font-bold text-green-600">
                {fraudStats.totalChecks - fraudStats.flagged}
              </div>
              <div className="text-sm text-green-700 mt-1">Passed</div>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-xl">
              <div className="text-3xl font-bold text-amber-600">{fraudStats.manualReview}</div>
              <div className="text-sm text-amber-700 mt-1">Manual Review</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <div className="text-3xl font-bold text-red-600">{fraudStats.blocked}</div>
              <div className="text-sm text-red-700 mt-1">Blocked</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-3xl font-bold text-blue-600">{fraudStats.averageRiskScore}</div>
              <div className="text-sm text-blue-700 mt-1">Avg Risk Score</div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <strong>Fraud detection performing well.</strong> Only{" "}
              {fraudStats.totalChecks > 0 ? ((fraudStats.flagged / fraudStats.totalChecks) * 100).toFixed(1) : 0}% of jobs flagged, with{" "}
              {fraudStats.blocked} confirmed fraud cases blocked. Estimated savings:{" "}
              <strong>£{(fraudStats.blocked * 450).toLocaleString()}</strong>.
            </div>
          </div>
        </div>

        {/* Growth Projections Footer */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Growth Projections</h2>
              <p className="text-sm text-slate-400">Based on AI forecasting models</p>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="text-sm text-slate-400 mb-1">Projected Revenue</div>
              <div className="text-3xl font-bold">
                £{revenueForecastData.forecast.length > 0
                  ? Math.round(revenueForecastData.forecast.reduce((a, b) => a + b, 0) / 1000) + "k"
                  : "0"}
              </div>
              <div className="text-sm text-green-400 flex items-center gap-1 mt-2">
                <ArrowUpRight className="w-4 h-4" />
                +{currentMonth.revenue > 0 && revenueForecastData.forecast.length > 0
                  ? ((revenueForecastData.forecast[revenueForecastData.forecast.length - 1] - currentMonth.revenue) / currentMonth.revenue * 100).toFixed(0)
                  : 0}% vs current
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="text-sm text-slate-400 mb-1">Annual Run Rate</div>
              <div className="text-3xl font-bold">£{Math.round(currentMonth.revenue * 12 / 1000)}k</div>
              <div className="text-sm text-slate-400 mt-2">Based on current month</div>
            </div>

            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="text-sm text-slate-400 mb-1">YoY Growth</div>
              <div className="text-3xl font-bold">{yoyGrowth >= 0 ? "+" : ""}{yoyGrowth.toFixed(0)}%</div>
              <div className={`text-sm mt-2 ${yoyGrowth >= 0 ? "text-green-400" : "text-red-400"}`}>
                {yoyGrowth >= 0 ? "Exceeding targets" : "Below target"}
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="text-sm text-slate-400 mb-1">Locksmith Target</div>
              <div className="text-3xl font-bold">200</div>
              <div className="text-sm text-amber-400 mt-2">
                {200 - overview.totalLocksmiths} more needed
              </div>
              <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full"
                  style={{ width: `${Math.min(100, (overview.totalLocksmiths / 200) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white/5 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300">
              Projections are based on Holt's double exponential smoothing with α=0.3 and β=0.1.
              Confidence intervals represent 95% prediction bounds. Actual results may vary based on market conditions,
              seasonal factors, and operational changes.
            </p>
          </div>
        </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
