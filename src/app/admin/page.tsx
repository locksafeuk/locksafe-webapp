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
  totalRevenue: number;
  totalLocksmiths: number;
  activeLocksmiths: number;
  totalCustomers: number;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const problemLabels: Record<string, string> = {
  lockout: "Locked Out", broken: "Broken Lock", "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys", burglary: "After Burglary", other: "Other",
};

function formatTimeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)    return `${secs}s ago`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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
  borderHover: string;
  dot: DotColor;
}

function OpsTile({ icon: Icon, label, href, value, sub, iconBg, iconColor, borderHover, dot }: TileProps) {
  const dotCls: Record<DotColor, string> = {
    green: "bg-green-400",
    amber: "bg-amber-400",
    red:   "bg-red-500",
    gray:  "bg-slate-300",
  };
  const pulse = dot === "amber" || dot === "red";
  return (
    <Link
      href={href}
      className={`group bg-white rounded-xl p-3 shadow-sm border border-transparent ${borderHover}
                  hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col gap-1.5 min-h-[88px]`}
    >
      <div className="flex items-center justify-between">
        <div className={`w-7 h-7 ${iconBg} rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-150`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </div>
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls[dot]} ${pulse ? "animate-pulse" : ""}`} title={dot} />
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

// ─── Domain section wrapper ───────────────────────────────────────────────────

function DomainSection({
  label, accent, children,
}: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1 h-3.5 rounded-full ${accent}`} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2 lg:gap-3">
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats, setStats]               = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [awaitingJobs, setAwaitingJobs] = useState<AwaitingSignatureJob[]>([]);
  const [sigLoading, setSigLoading]     = useState(true);
  const [ops, setOps]                   = useState<OpsSnapshot | null>(null);

  useEffect(() => {
    // Stats
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStats({
            totalJobs:       data.stats.overview?.totalJobs || 0,
            activeJobs:      data.stats.jobsByStatus?.inProgress || 0,
            totalRevenue:    data.stats.overview?.monthlyRevenue || 0,
            totalLocksmiths: data.stats.overview?.totalLocksmiths || 0,
            activeLocksmiths: data.stats.overview?.totalLocksmiths || 0,
            totalCustomers:  data.stats.overview?.totalCustomers || 0,
          });
        }
      })
      .catch(console.error)
      .finally(() => setStatsLoading(false));

    // Awaiting signature jobs
    fetch("/api/admin/jobs?awaitingSignature=true&limit=10")
      .then((r) => r.json())
      .then((data) => { if (data.success) setAwaitingJobs(data.jobs); })
      .catch(console.error)
      .finally(() => setSigLoading(false));

    // Ops snapshot — poll every 30s
    const loadOps = () =>
      fetch("/api/admin/ops-snapshot").then((r) => r.json()).then(setOps).catch(() => {});
    loadOps();
    const t = setInterval(loadOps, 30_000);
    return () => clearInterval(t);
  }, []);

  const getDeadline = (deadline: string | null) => {
    if (!deadline) return { text: "No deadline", color: "text-slate-500" };
    const rem = new Date(deadline).getTime() - Date.now();
    if (rem < 0) return { text: "Overdue", color: "text-red-600" };
    const h = Math.floor(rem / 3_600_000);
    if (h < 2)  return { text: `${Math.floor(rem / 60000)}m left`, color: "text-red-500" };
    if (h < 24) return { text: `${h}h left`, color: "text-amber-500" };
    return { text: `${Math.floor(h / 24)}d left`, color: "text-green-600" };
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const awaitSig     = ops?.ops.awaitingSignature ?? 0;
  const pendingVerif = ops?.people.pendingVerification ?? 0;
  const openDisputes = ops?.safety.openDisputes ?? 0;
  const pendingApprovals = ops?.agents.pendingApprovals ?? 0;
  const localPct     = ops?.agents.llmRuntime.localPct;
  const lastModel    = ops?.agents.llmRuntime.lastModel;
  const inProgressVoice = ops?.voice.inProgressCalls ?? 0;

  const agentDot = (): DotColor => {
    if (!ops?.agents.lastHeartbeat) return "gray";
    const ageMins = (Date.now() - new Date(ops.agents.lastHeartbeat).getTime()) / 60000;
    return ageMins < 30 ? "green" : ageMins < 120 ? "amber" : "red";
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-6 xl:p-8 space-y-6">

        {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
          {/* Dot-grid texture */}
          <div className="absolute inset-0 hero-dot-grid" />
          {/* Glow orbs */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-orange-500/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 left-1/3 w-64 h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 right-1/4 w-48 h-48 bg-violet-500/15 rounded-full blur-2xl pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 p-5 lg:p-8">
            {/* Title row */}
            <div className="flex items-start justify-between mb-5 lg:mb-6">
              <div>
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
                  LockSafe Admin
                </p>
                <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  {getGreeting()} 👋
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  Here&apos;s your live operations overview
                </p>
              </div>
              <div className="text-right hidden sm:block">
                {ops ? (
                  <span className="text-xs text-slate-500">
                    Updated {formatTimeAgo(ops.timestamp)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-slate-600">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                  </span>
                )}
              </div>
            </div>

            {/* Compact stat chips */}
            {statsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 lg:p-4 animate-pulse h-16" />
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Jobs",   value: stats.totalJobs,                            sub: `${stats.activeJobs} active`,       color: "text-sky-400",    icon: Briefcase },
                  { label: "Revenue",      value: `£${stats.totalRevenue.toLocaleString()}`,   sub: "This month",                       color: "text-green-400",  icon: PoundSterling },
                  { label: "Locksmiths",   value: stats.totalLocksmiths,                       sub: `${stats.activeLocksmiths} verified`, color: "text-violet-400", icon: Users },
                  { label: "Customers",    value: stats.totalCustomers,                         sub: "Registered",                       color: "text-amber-400",  icon: UserCircle },
                ].map(({ label, value, sub, color, icon: Icon }) => (
                  <div
                    key={label}
                    className="bg-white/5 backdrop-blur-sm rounded-xl p-3 lg:p-4 border border-white/10 hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${color} opacity-70`} />
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</span>
                    </div>
                    <div className={`text-xl lg:text-2xl font-bold ${color}`}>{value}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Live Operations Tiles ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Live Operations
            </h2>
            {ops && (
              <span className="text-xs text-slate-400 tabular-nums">
                Auto-refresh 30s · {formatTimeAgo(ops.timestamp)}
              </span>
            )}
          </div>

          <div className="space-y-5">

            {/* Operations */}
            <DomainSection label="Operations" accent="bg-sky-500">
              <OpsTile icon={Briefcase} label="Live Jobs"
                href="/admin/jobs"
                value={ops?.ops.activeJobs ?? "—"}
                sub={`${awaitSig} awaiting sig`}
                iconBg="bg-sky-100" iconColor="text-sky-600"
                borderHover="hover:border-sky-200"
                dot={awaitSig > 8 ? "red" : awaitSig > 3 ? "amber" : "green"} />
              <OpsTile icon={PenTool} label="Signatures"
                href="/admin/jobs?status=PENDING_CUSTOMER_CONFIRMATION"
                value={ops?.ops.awaitingSignature ?? "—"}
                sub="Pending confirmation"
                iconBg="bg-amber-100" iconColor="text-amber-600"
                borderHover="hover:border-amber-200"
                dot={awaitSig > 5 ? "red" : awaitSig > 2 ? "amber" : "green"} />
              <OpsTile icon={Map} label="Live Ops Map"
                href="/admin/ops"
                sub="View map"
                iconBg="bg-sky-100" iconColor="text-sky-600"
                borderHover="hover:border-sky-200"
                dot="green" />
            </DomainSection>

            {/* People */}
            <DomainSection label="People" accent="bg-emerald-500">
              <OpsTile icon={Users} label="Locksmiths"
                href="/admin/locksmiths"
                value={ops?.people.totalLocksmiths ?? "—"}
                sub={`${pendingVerif} to verify`}
                iconBg="bg-emerald-100" iconColor="text-emerald-600"
                borderHover="hover:border-emerald-200"
                dot={pendingVerif > 0 ? "amber" : "green"} />
              <OpsTile icon={UserCircle} label="Customers"
                href="/admin/customers"
                sub="View all customers"
                iconBg="bg-emerald-100" iconColor="text-emerald-600"
                borderHover="hover:border-emerald-200"
                dot="green" />
              <OpsTile icon={Users2} label="Leads"
                href="/admin/leads"
                sub="View pipeline"
                iconBg="bg-emerald-100" iconColor="text-emerald-600"
                borderHover="hover:border-emerald-200"
                dot="green" />
            </DomainSection>

            {/* Finance */}
            <DomainSection label="Finance" accent="bg-green-500">
              <OpsTile icon={PoundSterling} label="Payouts"
                href="/admin/payouts"
                value={ops?.finance.pendingPayouts ?? "—"}
                sub="Pending payout"
                iconBg="bg-green-100" iconColor="text-green-600"
                borderHover="hover:border-green-200"
                dot={(ops?.finance.pendingPayouts ?? 0) > 0 ? "amber" : "green"} />
              <OpsTile icon={CreditCard} label="Payments"
                href="/admin/payments"
                sub="All transactions"
                iconBg="bg-green-100" iconColor="text-green-600"
                borderHover="hover:border-green-200"
                dot="green" />
              <OpsTile icon={Crown} label="Subscriptions"
                href="/admin/subscriptions"
                sub="Cover plans"
                iconBg="bg-green-100" iconColor="text-green-600"
                borderHover="hover:border-green-200"
                dot="green" />
            </DomainSection>

            {/* Trust & Safety */}
            <DomainSection label="Trust & Safety" accent="bg-red-500">
              <OpsTile icon={AlertTriangle} label="Disputes"
                href="/admin/disputes"
                value={ops?.safety.openDisputes ?? "—"}
                sub="Open disputes"
                iconBg="bg-red-100" iconColor="text-red-600"
                borderHover="hover:border-red-200"
                dot={openDisputes > 0 ? "red" : "green"} />
              <OpsTile icon={Shield} label="Security"
                href="/admin/security"
                sub="Fraud radar"
                iconBg="bg-red-100" iconColor="text-red-600"
                borderHover="hover:border-red-200"
                dot="green" />
            </DomainSection>

            {/* AI & Automation */}
            <DomainSection label="AI & Automation" accent="bg-violet-500">
              <OpsTile icon={Bot} label="AI Agents"
                href="/admin/agents"
                value={ops ? `${ops.agents.active}/${ops.agents.total}` : "—"}
                sub={ops?.agents.lastHeartbeat ? `Beat ${formatTimeAgo(ops.agents.lastHeartbeat)}` : "No heartbeat"}
                iconBg="bg-violet-100" iconColor="text-violet-600"
                borderHover="hover:border-violet-200"
                dot={agentDot()} />
              <OpsTile icon={ShieldCheck} label="Approvals"
                href="/admin/agents/approvals"
                value={ops?.agents.pendingApprovals ?? "—"}
                sub="Pending decisions"
                iconBg="bg-violet-100" iconColor="text-violet-600"
                borderHover="hover:border-violet-200"
                dot={pendingApprovals > 0 ? "amber" : "green"} />
              <OpsTile icon={Cpu} label="LLM Runtime"
                href="/admin/agents"
                value={localPct !== null && localPct !== undefined ? `${localPct}% local` : "No data"}
                sub={lastModel ?? "No runs (24h)"}
                iconBg="bg-violet-100" iconColor="text-violet-600"
                borderHover="hover:border-violet-200"
                dot={localPct === null || localPct === undefined ? "gray" : localPct > 50 ? "green" : "amber"} />
              <OpsTile icon={Phone} label="Voice AI"
                href="/admin/voice-receptionist"
                value={ops?.voice.todayCalls ?? "—"}
                sub={`${inProgressVoice} live now`}
                iconBg="bg-violet-100" iconColor="text-violet-600"
                borderHover="hover:border-violet-200"
                dot={inProgressVoice > 0 ? "amber" : "green"} />
            </DomainSection>

            {/* Marketing */}
            <DomainSection label="Marketing" accent="bg-pink-500">
              <OpsTile icon={Megaphone} label="Google Ads"
                href="/admin/ads"
                value={ops?.marketing.activeAdCampaigns ?? "—"}
                sub="Active campaigns"
                iconBg="bg-pink-100" iconColor="text-pink-600"
                borderHover="hover:border-pink-200"
                dot={(ops?.marketing.activeAdCampaigns ?? 1) === 0 ? "amber" : "green"} />
              <OpsTile icon={Share2} label="Organic Posts"
                href="/admin/organic"
                value={ops?.marketing.scheduledPosts ?? "—"}
                sub={`${ops?.marketing.draftPosts ?? "—"} drafts`}
                iconBg="bg-pink-100" iconColor="text-pink-600"
                borderHover="hover:border-pink-200"
                dot={(ops?.marketing.scheduledPosts ?? 1) === 0 ? "amber" : "green"} />
              <OpsTile icon={Mail} label="Email Campaigns"
                href="/admin/emails"
                value={ops?.marketing.activeEmailCampaigns ?? "—"}
                sub="Live / scheduled"
                iconBg="bg-pink-100" iconColor="text-pink-600"
                borderHover="hover:border-pink-200"
                dot="green" />
              <OpsTile icon={BarChart3} label="Attribution"
                href="/admin/attribution"
                sub="ROAS & spend"
                iconBg="bg-pink-100" iconColor="text-pink-600"
                borderHover="hover:border-pink-200"
                dot="green" />
            </DomainSection>

            {/* System */}
            <DomainSection label="System" accent="bg-cyan-500">
              <OpsTile icon={Brain} label="Reflections"
                href="/admin/agents/reflections"
                sub="Memory & learning"
                iconBg="bg-cyan-100" iconColor="text-cyan-600"
                borderHover="hover:border-cyan-200"
                dot="green" />
              <OpsTile icon={Plug} label="Integrations"
                href="/admin/integrations"
                sub="Platform connections"
                iconBg="bg-cyan-100" iconColor="text-cyan-600"
                borderHover="hover:border-cyan-200"
                dot="green" />
            </DomainSection>

          </div>
        </div>

        {/* ── Jobs Awaiting Signature ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
          <div className="p-4 lg:p-6 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <PenTool className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Jobs Awaiting Signature</h2>
                  <p className="text-xs text-slate-500">
                    {awaitingJobs.length} job{awaitingJobs.length !== 1 ? "s" : ""} pending confirmation
                  </p>
                </div>
              </div>
              <Link
                href="/admin/jobs?status=PENDING_CUSTOMER_CONFIRMATION"
                className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1 shrink-0"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {sigLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Loading jobs…</p>
            </div>
          ) : awaitingJobs.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">All caught up!</p>
              <p className="text-slate-500 text-sm">No jobs awaiting customer signature.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {awaitingJobs.map((job) => {
                const dl = getDeadline(job.confirmationDeadline);
                const overdue = dl.text === "Overdue";
                return (
                  <div
                    key={job.id}
                    className={`p-4 lg:p-5 hover:bg-slate-50 transition-colors ${overdue ? "bg-red-50" : ""}`}
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
                          {overdue && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Overdue
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
                            <Phone className="w-3 h-3" />{job.customer.phone}
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
                        <div>
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Quote</div>
                          <div className="text-sm font-bold text-slate-900">
                            {job.quote ? `£${job.quote.total.toFixed(2)}` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Deadline</div>
                          <div className={`text-sm font-medium ${dl.color}`}>{dl.text}</div>
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
