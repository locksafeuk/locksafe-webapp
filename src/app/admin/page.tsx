"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Briefcase,
  Loader2,
  TrendingUp,
  CheckCircle2,
  PoundSterling,
  PenTool,
  AlertTriangle,
  Phone,
  MapPin,
  ChevronRight,
  Map,
  Bot,
  ShieldCheck,
  Cpu,
  Megaphone,
  Share2,
  Mail,
  BarChart3,
  Shield,
  Plug,
  Brain,
  CreditCard,
  Crown,
  UserCircle,
  Users2,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  totalRevenue: number;
  totalLocksmiths: number;
  activeLocksmiths: number;
  totalCustomers: number;
  pendingPayouts: number;
}

interface AwaitingSignatureJob {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  address: string;
  postcode: string;
  createdAt: string;
  workCompletedAt: string | null;
  confirmationDeadline: string | null;
  confirmationRemindersSent: number;
  customer: { name: string; phone: string; email: string | null };
  locksmith: { name: string; companyName: string | null } | null;
  quote: { total: number } | null;
}

interface OpsSnapshot {
  ops:       { activeJobs: number; awaitingSignature: number };
  people:    { totalLocksmiths: number; pendingVerification: number };
  finance:   { pendingPayouts: number };
  safety:    { openDisputes: number };
  agents: {
    active: number; total: number; lastHeartbeat: string | null;
    pendingApprovals: number;
    llmRuntime: { localPct: number | null; openaiPct: number | null; lastModel: string | null };
  };
  marketing: { scheduledPosts: number; draftPosts: number; activeEmailCampaigns: number; activeAdCampaigns: number };
  voice:     { todayCalls: number; inProgressCalls: number };
  timestamp: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const problemLabels: Record<string, string> = {
  lockout:    "Locked Out",
  broken:     "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary:   "After Burglary",
  other:      "Other",
};

function formatTimeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ─── OpsTile ─────────────────────────────────────────────────────────────────

type DotColor = "green" | "amber" | "red" | "gray";

interface TileProps {
  icon: React.ElementType;
  label: string;
  href: string;
  value?: string | number;
  sub?: string;
  iconBg: string;
  iconColor: string;
  dot: DotColor;
}

function OpsTile({ icon: Icon, label, href, value, sub, iconBg, iconColor, dot }: TileProps) {
  const dotCls: Record<DotColor, string> = {
    green: "bg-green-400",
    amber: "bg-amber-400",
    red:   "bg-red-500",
    gray:  "bg-slate-300",
  };
  return (
    <Link
      href={href}
      className="bg-white rounded-xl p-3 shadow-sm border border-transparent hover:shadow-md hover:border-slate-200 transition-all flex flex-col gap-1.5 min-h-[88px]"
    >
      <div className="flex items-center justify-between">
        <div className={`w-7 h-7 ${iconBg} rounded-lg flex items-center justify-center shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls[dot]}`} title={dot} />
      </div>
      <div className="text-[11px] font-semibold text-slate-600 leading-tight">{label}</div>
      {value !== undefined && (
        <div className="text-base font-bold text-slate-900 leading-none">{value}</div>
      )}
      {sub && (
        <div className="text-[10px] text-slate-400 leading-tight truncate">{sub}</div>
      )}
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats,    setStats]    = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [awaitingSignatureJobs, setAwaitingSignatureJobs] = useState<AwaitingSignatureJob[]>([]);
  const [signatureLoading, setSignatureLoading] = useState(true);
  const [ops, setOps] = useState<OpsSnapshot | null>(null);

  useEffect(() => {
    fetchStats();
    fetchAwaitingSignatureJobs();

    const loadOps = () =>
      fetch("/api/admin/ops-snapshot")
        .then((r) => r.json())
        .then(setOps)
        .catch(() => {});
    loadOps();
    const t = setInterval(loadOps, 30_000);
    return () => clearInterval(t);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/stats");
      const data = await response.json();
      if (data.success) {
        setStats({
          totalJobs:       data.stats.overview?.totalJobs || 0,
          activeJobs:      data.stats.jobsByStatus?.inProgress || 0,
          completedJobs:   data.stats.jobsByStatus?.completed || 0,
          totalRevenue:    data.stats.overview?.monthlyRevenue || 0,
          totalLocksmiths: data.stats.overview?.totalLocksmiths || 0,
          activeLocksmiths: data.stats.overview?.totalLocksmiths || 0,
          totalCustomers:  data.stats.overview?.totalCustomers || 0,
          pendingPayouts:  0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchAwaitingSignatureJobs = async () => {
    try {
      const response = await fetch("/api/admin/jobs?awaitingSignature=true&limit=10");
      const data = await response.json();
      if (data.success) setAwaitingSignatureJobs(data.jobs);
    } catch (error) {
      console.error("Failed to fetch awaiting signature jobs:", error);
    } finally {
      setSignatureLoading(false);
    }
  };

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return { text: "No deadline", color: "text-slate-500" };
    const remaining = new Date(deadline).getTime() - Date.now();
    if (remaining < 0)                          return { text: "Overdue",              color: "text-red-600" };
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours < 2)  return { text: `${Math.floor(remaining / 60000)}m left`, color: "text-red-500" };
    if (hours < 24) return { text: `${hours}h left`,                         color: "text-amber-500" };
    return { text: `${Math.floor(hours / 24)}d left`, color: "text-green-600" };
  };

  // ── Derived tile values ──────────────────────────────────────────────────────

  const awaitSig = ops?.ops.awaitingSignature ?? 0;
  const pendingVerif = ops?.people.pendingVerification ?? 0;
  const openDisputes = ops?.safety.openDisputes ?? 0;
  const activeAgents = ops?.agents.active ?? 0;
  const totalAgents  = ops?.agents.total ?? 0;
  const pendingApprovals = ops?.agents.pendingApprovals ?? 0;
  const localPct = ops?.agents.llmRuntime.localPct;
  const lastModel = ops?.agents.llmRuntime.lastModel;
  const inProgressVoice = ops?.voice.inProgressCalls ?? 0;

  const agentHeartbeatDot = (): DotColor => {
    if (!ops?.agents.lastHeartbeat) return "gray";
    const ageMins = (Date.now() - new Date(ops.agents.lastHeartbeat).getTime()) / 60000;
    if (ageMins < 30) return "green";
    if (ageMins < 120) return "amber";
    return "red";
  };

  const llmDot = (): DotColor => {
    if (localPct === null || localPct === undefined) return "gray";
    return localPct > 50 ? "green" : "amber";
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Welcome back, Admin User</p>
        </div>

        {/* ── Stats Grid ──────────────────────────────────────────────────────── */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
                <div className="h-6 lg:h-8 bg-slate-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <span className="text-slate-500 text-xs lg:text-sm">Total Jobs</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-lg lg:rounded-xl flex items-center justify-center">
                  <Briefcase className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600" />
                </div>
              </div>
              <div className="text-xl lg:text-3xl font-bold text-slate-900">{stats.totalJobs}</div>
              <div className="text-xs lg:text-sm text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" />
                <span>{stats.activeJobs} active</span>
              </div>
            </div>
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <span className="text-slate-500 text-xs lg:text-sm">Revenue</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-100 rounded-lg lg:rounded-xl flex items-center justify-center">
                  <PoundSterling className="w-4 h-4 lg:w-5 lg:h-5 text-green-600" />
                </div>
              </div>
              <div className="text-xl lg:text-3xl font-bold text-slate-900">
                £{(stats.totalRevenue || 0).toLocaleString()}
              </div>
              <div className="text-xs lg:text-sm text-slate-500 mt-1">This month</div>
            </div>
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <span className="text-slate-500 text-xs lg:text-sm">Locksmiths</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-lg lg:rounded-xl flex items-center justify-center">
                  <Users className="w-4 h-4 lg:w-5 lg:h-5 text-purple-600" />
                </div>
              </div>
              <div className="text-xl lg:text-3xl font-bold text-slate-900">{stats.totalLocksmiths}</div>
              <div className="text-xs lg:text-sm text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3 lg:w-4 lg:h-4" />
                <span>{stats.activeLocksmiths} verified</span>
              </div>
            </div>
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <span className="text-slate-500 text-xs lg:text-sm">Customers</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-orange-100 rounded-lg lg:rounded-xl flex items-center justify-center">
                  <Users className="w-4 h-4 lg:w-5 lg:h-5 text-orange-600" />
                </div>
              </div>
              <div className="text-xl lg:text-3xl font-bold text-slate-900">{stats.totalCustomers}</div>
              <div className="text-xs lg:text-sm text-slate-500 mt-1">Registered users</div>
            </div>
          </div>
        ) : null}

        {/* ── Live Operations Tiles ────────────────────────────────────────────── */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Live Operations
            </h2>
            <span className="text-xs text-slate-400">
              {ops ? `Updated ${formatTimeAgo(ops.timestamp)}` : (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Refreshing…
                </span>
              )}
            </span>
          </div>

          {/* Domain label rows + tiles in a flat responsive grid */}
          <div className="space-y-4">

            {/* Operations */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500 mb-1.5 px-0.5">Operations</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 lg:gap-3">
                <OpsTile
                  icon={Briefcase} label="Live Jobs"
                  href="/admin/jobs"
                  value={ops?.ops.activeJobs ?? "—"}
                  sub={`${awaitSig} awaiting sig`}
                  iconBg="bg-sky-100" iconColor="text-sky-600"
                  dot={awaitSig > 8 ? "red" : awaitSig > 3 ? "amber" : "green"}
                />
                <OpsTile
                  icon={PenTool} label="Signatures"
                  href="/admin/jobs?status=PENDING_CUSTOMER_CONFIRMATION"
                  value={ops?.ops.awaitingSignature ?? "—"}
                  sub="Pending confirmation"
                  iconBg="bg-amber-100" iconColor="text-amber-600"
                  dot={awaitSig > 5 ? "red" : awaitSig > 2 ? "amber" : "green"}
                />
                <OpsTile
                  icon={Map} label="Live Ops Map"
                  href="/admin/ops"
                  sub="View map"
                  iconBg="bg-sky-100" iconColor="text-sky-600"
                  dot="green"
                />
              </div>
            </div>

            {/* People */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1.5 px-0.5">People</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 lg:gap-3">
                <OpsTile
                  icon={Users} label="Locksmiths"
                  href="/admin/locksmiths"
                  value={ops?.people.totalLocksmiths ?? "—"}
                  sub={`${pendingVerif} to verify`}
                  iconBg="bg-emerald-100" iconColor="text-emerald-600"
                  dot={pendingVerif > 0 ? "amber" : "green"}
                />
                <OpsTile
                  icon={UserCircle} label="Customers"
                  href="/admin/customers"
                  sub="View customers"
                  iconBg="bg-emerald-100" iconColor="text-emerald-600"
                  dot="green"
                />
                <OpsTile
                  icon={Users2} label="Leads"
                  href="/admin/leads"
                  sub="View pipeline"
                  iconBg="bg-emerald-100" iconColor="text-emerald-600"
                  dot="green"
                />
              </div>
            </div>

            {/* Finance */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-500 mb-1.5 px-0.5">Finance</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 lg:gap-3">
                <OpsTile
                  icon={PoundSterling} label="Payouts"
                  href="/admin/payouts"
                  value={ops?.finance.pendingPayouts ?? "—"}
                  sub="Pending payout"
                  iconBg="bg-green-100" iconColor="text-green-600"
                  dot={ops?.finance.pendingPayouts ?? 0 > 0 ? "amber" : "green"}
                />
                <OpsTile
                  icon={CreditCard} label="Payments"
                  href="/admin/payments"
                  sub="All transactions"
                  iconBg="bg-green-100" iconColor="text-green-600"
                  dot="green"
                />
                <OpsTile
                  icon={Crown} label="Subscriptions"
                  href="/admin/subscriptions"
                  sub="Cover plans"
                  iconBg="bg-green-100" iconColor="text-green-600"
                  dot="green"
                />
              </div>
            </div>

            {/* Trust & Safety */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1.5 px-0.5">Trust & Safety</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 lg:gap-3">
                <OpsTile
                  icon={AlertTriangle} label="Disputes"
                  href="/admin/disputes"
                  value={ops?.safety.openDisputes ?? "—"}
                  sub="Open disputes"
                  iconBg="bg-red-100" iconColor="text-red-600"
                  dot={openDisputes > 0 ? "red" : "green"}
                />
                <OpsTile
                  icon={Shield} label="Security"
                  href="/admin/security"
                  sub="Fraud radar"
                  iconBg="bg-red-100" iconColor="text-red-600"
                  dot="green"
                />
              </div>
            </div>

            {/* AI & Automation */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-1.5 px-0.5">AI & Automation</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 lg:gap-3">
                <OpsTile
                  icon={Bot} label="AI Agents"
                  href="/admin/agents"
                  value={ops ? `${activeAgents}/${totalAgents}` : "—"}
                  sub={ops?.agents.lastHeartbeat ? `Beat ${formatTimeAgo(ops.agents.lastHeartbeat)}` : "No heartbeat"}
                  iconBg="bg-violet-100" iconColor="text-violet-600"
                  dot={agentHeartbeatDot()}
                />
                <OpsTile
                  icon={ShieldCheck} label="Approvals"
                  href="/admin/agents/approvals"
                  value={ops?.agents.pendingApprovals ?? "—"}
                  sub="Pending decisions"
                  iconBg="bg-violet-100" iconColor="text-violet-600"
                  dot={pendingApprovals > 0 ? "amber" : "green"}
                />
                <OpsTile
                  icon={Cpu} label="LLM Runtime"
                  href="/admin/agents"
                  value={localPct !== null && localPct !== undefined ? `${localPct}% local` : "No data"}
                  sub={lastModel ?? "No executions (24h)"}
                  iconBg="bg-violet-100" iconColor="text-violet-600"
                  dot={llmDot()}
                />
                <OpsTile
                  icon={Phone} label="Voice AI"
                  href="/admin/voice-receptionist"
                  value={ops?.voice.todayCalls ?? "—"}
                  sub={`${inProgressVoice} live now`}
                  iconBg="bg-violet-100" iconColor="text-violet-600"
                  dot={inProgressVoice > 0 ? "amber" : "green"}
                />
              </div>
            </div>

            {/* Marketing */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-pink-500 mb-1.5 px-0.5">Marketing</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 lg:gap-3">
                <OpsTile
                  icon={Megaphone} label="Google Ads"
                  href="/admin/ads"
                  value={ops?.marketing.activeAdCampaigns ?? "—"}
                  sub="Active campaigns"
                  iconBg="bg-pink-100" iconColor="text-pink-600"
                  dot={(ops?.marketing.activeAdCampaigns ?? 1) === 0 ? "amber" : "green"}
                />
                <OpsTile
                  icon={Share2} label="Organic Posts"
                  href="/admin/organic"
                  value={ops?.marketing.scheduledPosts ?? "—"}
                  sub={`${ops?.marketing.draftPosts ?? "—"} drafts`}
                  iconBg="bg-pink-100" iconColor="text-pink-600"
                  dot={(ops?.marketing.scheduledPosts ?? 1) === 0 ? "amber" : "green"}
                />
                <OpsTile
                  icon={Mail} label="Email Campaigns"
                  href="/admin/emails"
                  value={ops?.marketing.activeEmailCampaigns ?? "—"}
                  sub="Live/scheduled"
                  iconBg="bg-pink-100" iconColor="text-pink-600"
                  dot="green"
                />
                <OpsTile
                  icon={BarChart3} label="Attribution"
                  href="/admin/attribution"
                  sub="ROAS & spend"
                  iconBg="bg-pink-100" iconColor="text-pink-600"
                  dot="green"
                />
              </div>
            </div>

            {/* System */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-1.5 px-0.5">System</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 lg:gap-3">
                <OpsTile
                  icon={Brain} label="Reflections"
                  href="/admin/agents/reflections"
                  sub="Memory & learning"
                  iconBg="bg-cyan-100" iconColor="text-cyan-600"
                  dot="green"
                />
                <OpsTile
                  icon={Plug} label="Integrations"
                  href="/admin/integrations"
                  sub="Platform connections"
                  iconBg="bg-cyan-100" iconColor="text-cyan-600"
                  dot="green"
                />
              </div>
            </div>

          </div>
        </div>

        {/* ── Jobs Awaiting Signature ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <PenTool className="w-5 h-5 lg:w-6 lg:h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base lg:text-lg font-bold text-slate-900">Jobs Awaiting Signature</h2>
                  <p className="text-xs lg:text-sm text-slate-500">
                    {awaitingSignatureJobs.length} job{awaitingSignatureJobs.length !== 1 ? "s" : ""} pending confirmation
                  </p>
                </div>
              </div>
              <Link
                href="/admin/jobs?status=PENDING_CUSTOMER_CONFIRMATION"
                className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {signatureLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Loading jobs...</p>
            </div>
          ) : awaitingSignatureJobs.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">All caught up!</p>
              <p className="text-slate-500 text-sm">No jobs awaiting customer signature.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {awaitingSignatureJobs.map((job) => {
                const deadlineStatus = getDeadlineStatus(job.confirmationDeadline);
                const isOverdue = deadlineStatus.text === "Overdue";
                return (
                  <div
                    key={job.id}
                    className={`p-4 lg:p-5 hover:bg-slate-50 transition-colors ${isOverdue ? "bg-red-50" : ""}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Link
                            href={`/admin/jobs?id=${job.id}`}
                            className="font-mono text-sm font-semibold text-orange-600 hover:underline"
                          >
                            {job.jobNumber}
                          </Link>
                          {isOverdue && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Overdue
                            </span>
                          )}
                          {job.confirmationRemindersSent > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                              {job.confirmationRemindersSent} reminder{job.confirmationRemindersSent !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 mb-1">
                          {problemLabels[job.problemType] || job.problemType}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{job.address}, {job.postcode}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:flex gap-3 lg:gap-6">
                        <div className="min-w-0">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Customer</div>
                          <div className="text-sm font-medium text-slate-900 truncate">{job.customer.name}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />
                            {job.customer.phone}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Locksmith</div>
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {job.locksmith?.name || "Not assigned"}
                          </div>
                          {job.locksmith?.companyName && (
                            <div className="text-xs text-slate-500 truncate">{job.locksmith.companyName}</div>
                          )}
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Quote</div>
                          <div className="text-sm font-bold text-slate-900">
                            {job.quote ? `£${job.quote.total.toFixed(2)}` : "-"}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Deadline</div>
                          <div className={`text-sm font-medium ${deadlineStatus.color}`}>{deadlineStatus.text}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminSidebar>
  );
}
