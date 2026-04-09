"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone, PhoneCall, PhoneOff, Clock, TrendingUp, AlertTriangle,
  PlayCircle, PauseCircle, Settings, BarChart3, List, Mic,
  ArrowUpRight, ArrowDownRight, Search, Filter, RefreshCw,
  ChevronLeft, ChevronRight, Flag, CheckCircle2, XCircle,
  TestTube2, Volume2, User, MapPin, Calendar, MessageSquare,
  Loader2, Eye, Star, Zap, Shield, Activity,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";

// ============================================
// TYPES
// ============================================

interface VoiceCall {
  id: string;
  retellCallId: string;
  callerPhone: string | null;
  callerName: string | null;
  callerPostcode: string | null;
  callType: string;
  callStatus: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  callCategory: string | null;
  urgencyLevel: string | null;
  problemType: string | null;
  propertyType: string | null;
  outcome: string | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  summary: string | null;
  transcript: any;
  estimatedRevenue: number | null;
  wasEscalated: boolean;
  flaggedForReview: boolean;
  isTestCall: boolean;
  reviewNotes: string | null;
}

interface Analytics {
  totalCalls: number;
  avgDuration: number;
  avgSentiment: number;
  escalationRate: number;
  callToJobRate: number;
  callToBookingRate: number;
  totalEstimatedRevenue: number;
  categoryBreakdown: Record<string, number>;
  outcomeBreakdown: Record<string, number>;
  jobsCreated: number;
  appointmentsBooked: number;
  escalatedCount: number;
  negativeCalls: number;
  hourlyData: Array<{ hour: number; label: string; calls: number }>;
  dailyData: Array<{ date: string; calls: number }>;
}

interface AgentConfig {
  id: string;
  name: string;
  isActive: boolean;
  isPaused: boolean;
  pauseReason: string | null;
  systemPrompt: string;
  greetingMessage: string | null;
  language: string;
  enableDispatch: boolean;
  enableBooking: boolean;
  enableFAQ: boolean;
  enableEscalation: boolean;
  maxCallDuration: number;
  blockedNumbers: string[];
}

type TabId = "overview" | "calls" | "analytics" | "settings";

// ============================================
// HELPERS
// ============================================

const categoryColors: Record<string, string> = {
  emergency: "bg-red-100 text-red-800",
  appointment: "bg-blue-100 text-blue-800",
  inquiry: "bg-green-100 text-green-800",
  complaint: "bg-yellow-100 text-yellow-800",
  spam: "bg-gray-100 text-gray-800",
  unknown: "bg-gray-100 text-gray-600",
};

const outcomeLabels: Record<string, string> = {
  job_created: "Job Created",
  appointment_booked: "Appointment Booked",
  info_provided: "Info Provided",
  escalated: "Escalated",
  abandoned: "Abandoned",
  unknown: "Unknown",
};

const sentimentColors: Record<string, string> = {
  positive: "text-green-600",
  neutral: "text-gray-600",
  negative: "text-red-600",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPhone(phone: string | null): string {
  if (!phone) return "Unknown";
  return phone;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  try {
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "--"; }
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function VoiceReceptionistPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [callsLoading, setCallsLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<VoiceCall | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [analyticsPeriod, setAnalyticsPeriod] = useState("7d");
  const [testLoading, setTestLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchCalls = useCallback(async (pageNum?: number, search?: string, category?: string) => {
    setCallsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum ?? page));
      params.set("limit", "15");
      if (search) params.set("search", search);
      if (category) params.set("category", category);

      const res = await fetch(`/api/retell/calls?${params.toString()}`);
      const data = await res.json();
      if (data?.success) {
        setCalls(data?.calls ?? []);
        setTotalPages(data?.pagination?.totalPages ?? 1);
      }
    } catch (err: any) {
      console.error("Failed to fetch calls:", err);
    } finally {
      setCallsLoading(false);
    }
  }, [page]);

  const fetchAnalytics = useCallback(async (period?: string) => {
    try {
      const res = await fetch(`/api/retell/analytics?period=${period ?? analyticsPeriod}`);
      const data = await res.json();
      if (data?.success) setAnalytics(data?.analytics ?? null);
    } catch (err: any) {
      console.error("Failed to fetch analytics:", err);
    }
  }, [analyticsPeriod]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/retell/config");
      const data = await res.json();
      if (data?.success) setConfig(data?.config ?? null);
    } catch (err: any) {
      console.error("Failed to fetch config:", err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchCalls(1), fetchAnalytics(), fetchConfig()]);
      setLoading(false);
    };
    init();
  }, [fetchCalls, fetchAnalytics, fetchConfig]);

  const createTestCall = async (scenario: string) => {
    setTestLoading(true);
    try {
      const res = await fetch("/api/retell/test-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (data?.success) {
        await fetchCalls(1);
        await fetchAnalytics();
      }
    } catch (err: any) {
      console.error("Failed to create test call:", err);
    } finally {
      setTestLoading(false);
    }
  };

  const togglePause = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const res = await fetch("/api/retell/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaused: !config.isPaused }),
      });
      const data = await res.json();
      if (data?.success) setConfig(data?.config ?? config);
    } catch (err: any) {
      console.error("Failed to toggle pause:", err);
    } finally {
      setSavingConfig(false);
    }
  };

  const tabs: Array<{ id: TabId; label: string; icon: any }> = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "calls", label: "Call History", icon: List },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <AdminSidebar>
      <div className="p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Phone className="w-5 h-5 text-orange-600" />
              </div>
              Voice AI Receptionist
            </h1>
            <p className="text-slate-500 mt-1">24/7 AI-powered call handling powered by Retell AI</p>
          </div>
          <div className="flex items-center gap-3">
            {config && (
              <Button
                onClick={togglePause}
                disabled={savingConfig}
                className={config.isPaused
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-yellow-500 hover:bg-yellow-600 text-white"
                }
              >
                {savingConfig ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : config.isPaused ? (
                  <PlayCircle className="w-4 h-4 mr-2" />
                ) : (
                  <PauseCircle className="w-4 h-4 mr-2" />
                )}
                {config.isPaused ? "Resume Agent" : "Pause Agent"}
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${config?.isPaused ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`} />
              <span className="text-sm font-medium text-slate-600">
                {config?.isPaused ? "Paused" : "Active"}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          {tabs.map((tab: any) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab analytics={analytics} calls={calls} config={config} onCreateTest={createTestCall} testLoading={testLoading} onViewCall={setSelectedCall} />}
            {activeTab === "calls" && (
              <CallsTab
                calls={calls}
                loading={callsLoading}
                page={page}
                totalPages={totalPages}
                searchQuery={searchQuery}
                categoryFilter={categoryFilter}
                onSearch={(q: string) => { setSearchQuery(q); setPage(1); fetchCalls(1, q, categoryFilter); }}
                onFilter={(c: string) => { setCategoryFilter(c); setPage(1); fetchCalls(1, searchQuery, c); }}
                onPageChange={(p: number) => { setPage(p); fetchCalls(p, searchQuery, categoryFilter); }}
                onViewCall={setSelectedCall}
                onRefresh={() => fetchCalls(page, searchQuery, categoryFilter)}
              />
            )}
            {activeTab === "analytics" && (
              <AnalyticsTab
                analytics={analytics}
                period={analyticsPeriod}
                onPeriodChange={(p: string) => { setAnalyticsPeriod(p); fetchAnalytics(p); }}
              />
            )}
            {activeTab === "settings" && <SettingsTab config={config} onUpdate={fetchConfig} />}
          </>
        )}

        {/* Call Detail Modal */}
        {selectedCall && (
          <CallDetailModal call={selectedCall} onClose={() => setSelectedCall(null)} />
        )}
      </div>
    </AdminSidebar>
  );
}

// ============================================
// OVERVIEW TAB
// ============================================

function OverviewTab({ analytics, calls, config, onCreateTest, testLoading, onViewCall }: {
  analytics: Analytics | null;
  calls: VoiceCall[];
  config: AgentConfig | null;
  onCreateTest: (s: string) => void;
  testLoading: boolean;
  onViewCall: (c: VoiceCall) => void;
}) {
  const stats = [
    { label: "Total Calls", value: analytics?.totalCalls ?? 0, icon: Phone, color: "bg-blue-50 text-blue-600" },
    { label: "Jobs Created", value: analytics?.jobsCreated ?? 0, icon: Zap, color: "bg-green-50 text-green-600" },
    { label: "Avg Duration", value: formatDuration(analytics?.avgDuration ?? 0), icon: Clock, color: "bg-purple-50 text-purple-600" },
    { label: "Est. Revenue", value: `\u00A3${(analytics?.totalEstimatedRevenue ?? 0).toLocaleString()}`, icon: TrendingUp, color: "bg-orange-50 text-orange-600" },
    { label: "Escalation Rate", value: `${analytics?.escalationRate ?? 0}%`, icon: AlertTriangle, color: "bg-red-50 text-red-600" },
    { label: "Bookings", value: analytics?.appointmentsBooked ?? 0, icon: Calendar, color: "bg-teal-50 text-teal-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat: any, i: number) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Calls + Test Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Calls */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Recent Calls</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {(calls ?? []).slice(0, 8).map((call: VoiceCall) => (
              <button
                key={call?.id}
                onClick={() => onViewCall(call)}
                className="w-full px-5 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  call?.callCategory === "emergency" ? "bg-red-100" :
                  call?.callCategory === "appointment" ? "bg-blue-100" :
                  call?.callCategory === "complaint" ? "bg-yellow-100" : "bg-green-100"
                }`}>
                  {call?.callCategory === "emergency" ? <PhoneCall className="w-4 h-4 text-red-600" /> :
                   call?.callCategory === "complaint" ? <AlertTriangle className="w-4 h-4 text-yellow-600" /> :
                   <Phone className="w-4 h-4 text-green-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 text-sm truncate">
                      {call?.callerName ?? formatPhone(call?.callerPhone)}
                    </span>
                    {call?.flaggedForReview && <Flag className="w-3 h-3 text-red-500 flex-shrink-0" />}
                    {call?.isTestCall && <TestTube2 className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{call?.summary ?? "No summary"}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[call?.callCategory ?? "unknown"] ?? categoryColors.unknown}`}>
                    {call?.callCategory ?? "unknown"}
                  </span>
                  <div className="text-xs text-slate-400 mt-1">{formatDate(call?.startedAt)}</div>
                </div>
              </button>
            ))}
            {(calls?.length ?? 0) === 0 && (
              <div className="px-5 py-10 text-center text-slate-400">
                <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No calls yet. Generate a test call to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Test & Quick Actions */}
        <div className="space-y-4">
          {/* Agent Status */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-500" />
              Agent Status
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Status</span>
                <span className={`text-sm font-medium ${config?.isPaused ? 'text-yellow-600' : 'text-green-600'}`}>
                  {config?.isPaused ? "Paused" : "Active 24/7"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Language</span>
                <span className="text-sm font-medium text-slate-900">{config?.language ?? "en-GB"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Dispatch</span>
                <span className={`text-sm font-medium ${config?.enableDispatch ? 'text-green-600' : 'text-red-600'}`}>
                  {config?.enableDispatch ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Booking</span>
                <span className={`text-sm font-medium ${config?.enableBooking ? 'text-green-600' : 'text-red-600'}`}>
                  {config?.enableBooking ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>

          {/* Test Call Generator */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <TestTube2 className="w-4 h-4 text-purple-500" />
              Generate Test Call
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {["emergency", "appointment", "inquiry", "negative"].map((scenario: string) => (
                <Button
                  key={scenario}
                  onClick={() => onCreateTest(scenario)}
                  disabled={testLoading}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border-0"
                  size="sm"
                >
                  {testLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CALLS TAB
// ============================================

function CallsTab({ calls, loading, page, totalPages, searchQuery, categoryFilter, onSearch, onFilter, onPageChange, onViewCall, onRefresh }: {
  calls: VoiceCall[];
  loading: boolean;
  page: number;
  totalPages: number;
  searchQuery: string;
  categoryFilter: string;
  onSearch: (q: string) => void;
  onFilter: (c: string) => void;
  onPageChange: (p: number) => void;
  onViewCall: (c: VoiceCall) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, postcode..."
            value={searchQuery}
            onChange={(e: any) => onSearch(e?.target?.value ?? "")}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e: any) => onFilter(e?.target?.value ?? "")}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Categories</option>
          <option value="emergency">Emergency</option>
          <option value="appointment">Appointment</option>
          <option value="inquiry">Inquiry</option>
          <option value="complaint">Complaint</option>
        </select>
        <Button onClick={onRefresh} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-0" size="sm">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Caller</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Outcome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Sentiment</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </td></tr>
              ) : (calls ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No calls found</td></tr>
              ) : (calls ?? []).map((call: VoiceCall) => (
                <tr key={call?.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {call?.flaggedForReview && <Flag className="w-3 h-3 text-red-500 flex-shrink-0" />}
                      {call?.isTestCall && <TestTube2 className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                      <div>
                        <div className="font-medium text-slate-900">{call?.callerName ?? "Unknown"}</div>
                        <div className="text-xs text-slate-500">{formatPhone(call?.callerPhone)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[call?.callCategory ?? "unknown"] ?? categoryColors.unknown}`}>
                      {call?.callCategory ?? "unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {outcomeLabels[call?.outcome ?? "unknown"] ?? call?.outcome ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                    {formatDuration(call?.durationSeconds)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${sentimentColors[call?.sentimentLabel ?? "neutral"] ?? sentimentColors.neutral}`}>
                      {call?.sentimentLabel ?? "--"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(call?.startedAt)}</td>
                  <td className="px-4 py-3">
                    <Button onClick={() => onViewCall(call)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-0" size="sm">
                      <Eye className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-0" size="sm">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-0" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// ANALYTICS TAB
// ============================================

function AnalyticsTab({ analytics, period, onPeriodChange }: {
  analytics: Analytics | null;
  period: string;
  onPeriodChange: (p: string) => void;
}) {
  if (!analytics) return <div className="text-center py-10 text-slate-400">No analytics data</div>;

  const maxHourlyCalls = Math.max(...(analytics?.hourlyData ?? []).map((h: any) => h?.calls ?? 0), 1);
  const maxDailyCalls = Math.max(...(analytics?.dailyData ?? []).map((d: any) => d?.calls ?? 0), 1);

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {["24h", "7d", "30d", "90d"].map((p: string) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p ? "bg-orange-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Calls" value={String(analytics.totalCalls)} icon={Phone} />
        <MetricCard label="Call-to-Job Rate" value={`${analytics.callToJobRate}%`} icon={Zap} />
        <MetricCard label="Avg Duration" value={formatDuration(analytics.avgDuration)} icon={Clock} />
        <MetricCard label="Est. Revenue" value={`\u00A3${analytics.totalEstimatedRevenue.toLocaleString()}`} icon={TrendingUp} />
      </div>

      {/* Category & Outcome Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Call Categories</h3>
          <div className="space-y-3">
            {Object.entries(analytics.categoryBreakdown ?? {}).map(([cat, count]: [string, number]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 capitalize">{cat}</span>
                  <span className="font-medium text-slate-900">{count}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      cat === "emergency" ? "bg-red-400" :
                      cat === "appointment" ? "bg-blue-400" :
                      cat === "inquiry" ? "bg-green-400" :
                      cat === "complaint" ? "bg-yellow-400" : "bg-gray-400"
                    }`}
                    style={{ width: `${analytics.totalCalls > 0 ? (count / analytics.totalCalls) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Outcomes</h3>
          <div className="space-y-3">
            {Object.entries(analytics.outcomeBreakdown ?? {}).map(([out, count]: [string, number]) => (
              <div key={out}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{outcomeLabels[out] ?? out}</span>
                  <span className="font-medium text-slate-900">{count}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full bg-orange-400" style={{ width: `${analytics.totalCalls > 0 ? (count / analytics.totalCalls) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly Heatmap */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Hourly Call Distribution</h3>
        <div className="flex items-end gap-1 h-32">
          {(analytics.hourlyData ?? []).map((h: any) => (
            <div key={h?.hour} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t transition-all ${
                  (h?.calls ?? 0) > 0 ? 'bg-orange-400' : 'bg-slate-100'
                }`}
                style={{ height: `${maxHourlyCalls > 0 ? ((h?.calls ?? 0) / maxHourlyCalls) * 100 : 0}%`, minHeight: '2px' }}
                title={`${h?.label}: ${h?.calls ?? 0} calls`}
              />
              {(h?.hour ?? 0) % 4 === 0 && <span className="text-[10px] text-slate-400">{h?.label}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Daily Trend */}
      {(analytics?.dailyData?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Daily Call Volume</h3>
          <div className="flex items-end gap-2 h-32">
            {(analytics.dailyData ?? []).map((d: any) => (
              <div key={d?.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-blue-400 rounded-t transition-all"
                  style={{ height: `${maxDailyCalls > 0 ? ((d?.calls ?? 0) / maxDailyCalls) * 100 : 0}%`, minHeight: '2px' }}
                  title={`${d?.date}: ${d?.calls ?? 0} calls`}
                />
                <span className="text-[10px] text-slate-400 rotate-[-45deg] origin-top-left">
                  {(d?.date ?? "").slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-orange-500" />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

// ============================================
// SETTINGS TAB
// ============================================

function SettingsTab({ config, onUpdate }: { config: AgentConfig | null; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    greetingMessage: config?.greetingMessage ?? "",
    maxCallDuration: config?.maxCallDuration ?? 600,
    enableDispatch: config?.enableDispatch ?? true,
    enableBooking: config?.enableBooking ?? true,
    enableFAQ: config?.enableFAQ ?? true,
    enableEscalation: config?.enableEscalation ?? true,
    language: config?.language ?? "en-GB",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/retell/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      await onUpdate();
    } catch (err: any) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Voice Agent Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Greeting Message</label>
            <textarea
              value={formData.greetingMessage}
              onChange={(e: any) => setFormData((prev: any) => ({ ...(prev ?? {}), greetingMessage: e?.target?.value ?? "" }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 h-20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Call Duration (seconds)</label>
            <input
              type="number"
              value={formData.maxCallDuration}
              onChange={(e: any) => setFormData((prev: any) => ({ ...(prev ?? {}), maxCallDuration: parseInt(e?.target?.value ?? "600", 10) }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
            <select
              value={formData.language}
              onChange={(e: any) => setFormData((prev: any) => ({ ...(prev ?? {}), language: e?.target?.value ?? "en-GB" }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="en-GB">English (UK)</option>
              <option value="en-US">English (US)</option>
              <option value="es">Spanish</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Feature Toggles</h3>
        <div className="space-y-3">
          {[
            { key: "enableDispatch", label: "Emergency Dispatch", desc: "Automatically dispatch locksmiths for emergency calls" },
            { key: "enableBooking", label: "Appointment Booking", desc: "Allow the agent to book appointments" },
            { key: "enableFAQ", label: "FAQ Handling", desc: "Answer common questions about pricing and services" },
            { key: "enableEscalation", label: "Human Escalation", desc: "Transfer complex cases to human support" },
          ].map((toggle: any) => (
            <div key={toggle.key} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-slate-900">{toggle.label}</div>
                <div className="text-xs text-slate-500">{toggle.desc}</div>
              </div>
              <button
                onClick={() => setFormData((prev: any) => ({ ...(prev ?? {}), [toggle.key]: !(prev as any)?.[toggle.key] }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  (formData as any)?.[toggle.key] ? 'bg-orange-500' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
                  (formData as any)?.[toggle.key] ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
        Save Configuration
      </Button>
    </div>
  );
}

// ============================================
// CALL DETAIL MODAL
// ============================================

function CallDetailModal({ call, onClose }: { call: VoiceCall; onClose: () => void }) {
  const transcript = call?.transcript;
  const messages: Array<{ role: string; content: string }> = Array.isArray(transcript) ? transcript : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden" onClick={(e: any) => e?.stopPropagation?.()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-orange-500" />
              Call Details
              {call?.isTestCall && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Test</span>}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{call?.retellCallId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-64px)] p-6 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem icon={User} label="Caller" value={call?.callerName ?? "Unknown"} />
            <InfoItem icon={Phone} label="Phone" value={formatPhone(call?.callerPhone)} />
            <InfoItem icon={MapPin} label="Postcode" value={call?.callerPostcode ?? "--"} />
            <InfoItem icon={Clock} label="Duration" value={formatDuration(call?.durationSeconds)} />
          </div>

          {/* Status Row */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${categoryColors[call?.callCategory ?? "unknown"] ?? categoryColors.unknown}`}>
              {call?.callCategory ?? "unknown"}
            </span>
            {call?.urgencyLevel && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                call.urgencyLevel === "critical" ? "bg-red-100 text-red-800" :
                call.urgencyLevel === "high" ? "bg-orange-100 text-orange-800" :
                "bg-gray-100 text-gray-700"
              }`}>
                {call.urgencyLevel} urgency
              </span>
            )}
            {call?.outcome && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                {outcomeLabels[call.outcome] ?? call.outcome}
              </span>
            )}
            {call?.sentimentLabel && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                call.sentimentLabel === "positive" ? "bg-green-100 text-green-800" :
                call.sentimentLabel === "negative" ? "bg-red-100 text-red-800" :
                "bg-gray-100 text-gray-700"
              }`}>
                {call.sentimentLabel} sentiment
              </span>
            )}
          </div>

          {/* Summary */}
          {call?.summary && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Summary</h4>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{call.summary}</p>
            </div>
          )}

          {/* Transcript */}
          {messages.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Transcript
              </h4>
              <div className="space-y-2 bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                {messages.map((msg: any, i: number) => (
                  <div key={i} className={`flex ${msg?.role === "agent" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                      msg?.role === "agent"
                        ? "bg-white text-slate-700 shadow-sm"
                        : "bg-orange-500 text-white"
                    }`}>
                      <div className="text-[10px] opacity-70 mb-0.5">
                        {msg?.role === "agent" ? "Sarah (AI)" : "Caller"}
                      </div>
                      {msg?.content ?? ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue */}
          {(call?.estimatedRevenue ?? 0) > 0 && (
            <div className="bg-green-50 rounded-lg p-3 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-sm font-medium text-green-800">Estimated Revenue</div>
                <div className="text-lg font-bold text-green-700">\u00A3{call?.estimatedRevenue?.toLocaleString?.() ?? "0"}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-slate-900">{value}</div>
      </div>
    </div>
  );
}
