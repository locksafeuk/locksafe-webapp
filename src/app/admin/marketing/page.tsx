"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  Users,
  MousePointer,
  Eye,
  Target,
  Mail,
  TrendingUp,
  RefreshCw,
  Download,
  Filter,
  Search,
  ChevronRight,
  Loader2,
  AlertCircle,
  Activity,
  Layers,
  Clock,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Sparkles,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface MarketingStats {
  totalSessions: number;
  uniqueVisitors: number;
  avgEngagementScore: number;
  avgIntentScore: number;
  bounceRate: number;
  conversionRate: number;
}

interface SegmentData {
  name: string;
  count: number;
  percentage: number;
}

interface ModalStats {
  modalType: string;
  shown: number;
  dismissed: number;
  converted: number;
  conversionRate: number;
}

interface LeadCapture {
  id: string;
  email: string;
  name: string | null;
  source: string;
  segment: string[];
  convertedToCustomer: boolean;
  createdAt: string;
}

interface SessionData {
  id: string;
  visitorId: string;
  deviceType: string;
  browser: string;
  landingPage: string;
  segment: string[];
  engagementScore: number;
  intentScore: number;
  pageViews: number;
  startedAt: string;
  lastActiveAt: string;
}

// ============================================
// COMPONENT
// ============================================

export default function MarketingDashboard() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "90d">("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "leads" | "modals">("overview");

  // Data states
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const [modalStats, setModalStats] = useState<ModalStats[]>([]);
  const [leads, setLeads] = useState<LeadCapture[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);

  // Fetch marketing data
  const fetchMarketingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/marketing?timeRange=${timeRange}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setSegments(data.segments);
        setModalStats(data.modalStats);
        setLeads(data.leads);
        setSessions(data.sessions);
      } else {
        setError(data.error || "Failed to load marketing data");
      }
    } catch (err) {
      console.error("Error fetching marketing data:", err);
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketingData();
  }, [timeRange]);

  // Loading state
  if (loading) {
    return (
      <AdminSidebar>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-slate-600">Loading marketing analytics...</p>
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
            <Button onClick={fetchMarketingData} className="bg-orange-500 hover:bg-orange-600 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </AdminSidebar>
    );
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return Smartphone;
      case "tablet":
        return Tablet;
      default:
        return Monitor;
    }
  };

  const getSegmentColor = (segment: string) => {
    const colors: Record<string, string> = {
      emergency: "bg-red-100 text-red-700",
      price_shopper: "bg-blue-100 text-blue-700",
      researcher: "bg-purple-100 text-purple-700",
      returning: "bg-amber-100 text-amber-700",
      landlord: "bg-emerald-100 text-emerald-700",
      locksmith_prospect: "bg-slate-100 text-slate-700",
      lead: "bg-green-100 text-green-700",
    };
    return colors[segment] || "bg-slate-100 text-slate-700";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Marketing</h1>
            <p className="text-sm text-slate-500">User tracking & funnel</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
              className="px-2 lg:px-3 py-1.5 lg:py-2 border rounded-lg text-xs lg:text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              <option value="24h">24h</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
            </select>
            <Button variant="outline" size="icon" onClick={fetchMarketingData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-4 lg:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats?.totalSessions.toLocaleString() || 0}
            </div>
            <div className="text-sm text-slate-500 mt-1">Total Sessions</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-500 rounded-xl flex items-center justify-center">
                <Eye className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats?.uniqueVisitors.toLocaleString() || 0}
            </div>
            <div className="text-sm text-slate-500 mt-1">Unique Visitors</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats?.avgEngagementScore || 0}
            </div>
            <div className="text-sm text-slate-500 mt-1">Avg Engagement</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-500 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats?.avgIntentScore || 0}
            </div>
            <div className="text-sm text-slate-500 mt-1">Avg Intent</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {stats?.conversionRate || 0}%
            </div>
            <div className="text-sm text-slate-500 mt-1">Conversion Rate</div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {leads.length}
            </div>
            <div className="text-sm text-slate-500 mt-1">Leads Captured</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
          {(["overview", "sessions", "leads", "modals"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Segment Distribution */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">User Segments</h2>
                  <p className="text-sm text-slate-500">Visitor behavior classification</p>
                </div>
                <Layers className="w-5 h-5 text-slate-400" />
              </div>

              {segments.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No segment data yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {segments.map((segment) => (
                    <div key={segment.name} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium ${getSegmentColor(segment.name)}`}>
                            {segment.name.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{segment.count}</span>
                          <span className="text-sm text-slate-500">({segment.percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
                          style={{ width: `${segment.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Performance */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Modal Performance</h2>
                  <p className="text-sm text-slate-500">Popup engagement metrics</p>
                </div>
                <MessageSquare className="w-5 h-5 text-slate-400" />
              </div>

              {modalStats.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No modal data yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {modalStats.map((modal) => (
                    <div key={modal.modalType} className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-900 capitalize">
                          {modal.modalType.replace("_", " ")}
                        </span>
                        <span className={`text-sm font-medium ${
                          modal.conversionRate >= 20 ? "text-emerald-600" :
                          modal.conversionRate >= 10 ? "text-amber-600" : "text-slate-500"
                        }`}>
                          {modal.conversionRate}% conv
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-slate-900">{modal.shown}</div>
                          <div className="text-xs text-slate-500">Shown</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-red-500">{modal.dismissed}</div>
                          <div className="text-xs text-slate-500">Dismissed</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-emerald-600">{modal.converted}</div>
                          <div className="text-xs text-slate-500">Converted</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Device Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Device Breakdown</h2>
                  <p className="text-sm text-slate-500">Traffic by device type</p>
                </div>
                <Smartphone className="w-5 h-5 text-slate-400" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { type: "mobile", icon: Smartphone, color: "from-blue-400 to-blue-500" },
                  { type: "desktop", icon: Monitor, color: "from-purple-400 to-purple-500" },
                  { type: "tablet", icon: Tablet, color: "from-emerald-400 to-emerald-500" },
                ].map((device) => {
                  const count = sessions.filter(s => s.deviceType === device.type).length;
                  const Icon = device.icon;
                  return (
                    <div key={device.type} className="text-center p-4 bg-slate-50 rounded-xl">
                      <div className={`w-12 h-12 bg-gradient-to-br ${device.color} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-xl font-bold text-slate-900">{count}</div>
                      <div className="text-xs text-slate-500 capitalize">{device.type}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Landing Pages */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Top Landing Pages</h2>
                  <p className="text-sm text-slate-500">Most popular entry points</p>
                </div>
                <MapPin className="w-5 h-5 text-slate-400" />
              </div>

              {sessions.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No session data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(
                    sessions.reduce((acc, s) => {
                      acc[s.landingPage] = (acc[s.landingPage] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  )
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([page, count]) => (
                      <div key={page} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="font-mono text-sm text-slate-600 truncate max-w-[200px]">
                          {page}
                        </span>
                        <span className="font-bold text-slate-900">{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === "sessions" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Recent Sessions</h2>
                  <p className="text-sm text-slate-500">{sessions.length} sessions tracked</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search sessions..."
                      className="pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Visitor
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Landing Page
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Segments
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Engagement
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Intent
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Last Active
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.slice(0, 20).map((session) => {
                    const DeviceIcon = getDeviceIcon(session.deviceType);
                    return (
                      <tr key={session.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="font-mono text-sm text-slate-600">
                            {session.visitorId.slice(0, 12)}...
                          </div>
                          <div className="text-xs text-slate-400">{session.browser}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <DeviceIcon className="w-4 h-4 text-slate-400" />
                            <span className="text-sm capitalize">{session.deviceType}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-slate-600 truncate block max-w-[150px]">
                            {session.landingPage}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {session.segment.slice(0, 2).map((seg) => (
                              <span
                                key={seg}
                                className={`px-2 py-0.5 rounded text-xs font-medium ${getSegmentColor(seg)}`}
                              >
                                {seg.replace("_", " ")}
                              </span>
                            ))}
                            {session.segment.length > 2 && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                                +{session.segment.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            session.engagementScore >= 50 ? "bg-emerald-100 text-emerald-700" :
                            session.engagementScore >= 20 ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {session.engagementScore}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                            session.intentScore >= 50 ? "bg-red-100 text-red-700" :
                            session.intentScore >= 20 ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {session.intentScore}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Clock className="w-3 h-3" />
                            {formatDate(session.lastActiveAt)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {sessions.length === 0 && (
                <div className="py-12 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No sessions tracked yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Lead Captures</h2>
                  <p className="text-sm text-slate-500">{leads.length} leads captured</p>
                </div>
                <Button variant="outline" className="hidden md:flex">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Segments
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Converted
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Captured
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{lead.name || "Anonymous"}</div>
                        <div className="text-sm text-slate-500">{lead.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600">
                          {lead.source.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {lead.segment.map((seg) => (
                            <span
                              key={seg}
                              className={`px-2 py-0.5 rounded text-xs font-medium ${getSegmentColor(seg)}`}
                            >
                              {seg.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {lead.convertedToCustomer ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-slate-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-500">
                          {formatDate(lead.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {leads.length === 0 && (
                <div className="py-12 text-center text-slate-500">
                  <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No leads captured yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modals Tab */}
        {activeTab === "modals" && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Modal Performance Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Modal Analytics</h2>
                  <p className="text-sm text-slate-500">Detailed performance by modal type</p>
                </div>
              </div>

              {modalStats.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No modal interactions yet</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modalStats.map((modal) => (
                    <div key={modal.modalType} className="border border-slate-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900 capitalize">
                          {modal.modalType.replace("_", " ")}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          modal.conversionRate >= 20 ? "bg-emerald-100 text-emerald-700" :
                          modal.conversionRate >= 10 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {modal.conversionRate}% CVR
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">Impressions</span>
                          <span className="font-bold text-slate-900">{modal.shown}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">Dismissed</span>
                          <span className="font-bold text-red-500">{modal.dismissed}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">Converted</span>
                          <span className="font-bold text-emerald-600">{modal.converted}</span>
                        </div>
                      </div>

                      {/* Funnel Visualization */}
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex items-end justify-between h-16 gap-1">
                          <div
                            className="flex-1 bg-blue-200 rounded-t"
                            style={{ height: "100%" }}
                            title={`Shown: ${modal.shown}`}
                          />
                          <div
                            className="flex-1 bg-amber-200 rounded-t"
                            style={{ height: `${modal.shown > 0 ? (modal.dismissed / modal.shown) * 100 : 0}%` }}
                            title={`Dismissed: ${modal.dismissed}`}
                          />
                          <div
                            className="flex-1 bg-emerald-400 rounded-t"
                            style={{ height: `${modal.shown > 0 ? (modal.converted / modal.shown) * 100 : 0}%` }}
                            title={`Converted: ${modal.converted}`}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>Shown</span>
                          <span>Dismissed</span>
                          <span>Converted</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </AdminSidebar>
  );
}
