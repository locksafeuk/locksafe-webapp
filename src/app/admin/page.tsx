"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Briefcase, PenTool, AlertTriangle, ShieldCheck,
  Bot, Cpu, Phone, Users, PoundSterling,
  Megaphone, Share2, Mail, BarChart3,
  Map, Shield, Brain, Plug, CreditCard, Crown,
  UserCircle, Users2, MapPin, ChevronRight,
  Loader2, CheckCircle2, TrendingUp,
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
  id: string; jobNumber: string; status: string; problemType: string;
  address: string; postcode: string; createdAt: string;
  workCompletedAt: string | null; confirmationDeadline: string | null;
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
    llmRuntime: { localPct: number | null; lastModel: string | null };
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

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// ─── Status badge ─────────────────────────────────────────────────────────────

type Severity = "ok" | "warn" | "alert" | "off";

const SEV: Record<Severity, { dot: string; badge: string; pulse: boolean }> = {
  ok:    { dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700",  pulse: false },
  warn:  { dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-700",      pulse: true  },
  alert: { dot: "bg-red-500",     badge: "bg-red-50 text-red-700",          pulse: true  },
  off:   { dot: "bg-slate-300",   badge: "bg-slate-50 text-slate-500",      pulse: false },
};

function Badge({ sev, label }: { sev: Severity; label: string }) {
  const s = SEV[sev];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

// ─── Tile ─────────────────────────────────────────────────────────────────────

interface TileProps {
  icon: React.ElementType;
  label: string;
  href: string;
  value?: string | number;
  sub?: string;
  accent: string;   // top border + icon bg tint, e.g. "sky"
  sev: Severity;
  sevLabel: string;
}

const ACCENT_CLASSES: Record<string, { bar: string; iconBg: string; iconText: string; hoverBorder: string }> = {
  red:    { bar: "bg-red-500",    iconBg: "bg-red-100",    iconText: "text-red-600",    hoverBorder: "hover:border-red-300"    },
  sky:    { bar: "bg-sky-500",    iconBg: "bg-sky-100",    iconText: "text-sky-600",    hoverBorder: "hover:border-sky-300"    },
  violet: { bar: "bg-violet-500", iconBg: "bg-violet-100", iconText: "text-violet-600", hoverBorder: "hover:border-violet-300" },
  pink:   { bar: "bg-pink-500",   iconBg: "bg-pink-100",   iconText: "text-pink-600",   hoverBorder: "hover:border-pink-300"   },
  emerald:{ bar: "bg-emerald-500",iconBg: "bg-emerald-100",iconText: "text-emerald-600",hoverBorder: "hover:border-emerald-300"},
  green:  { bar: "bg-green-500",  iconBg: "bg-green-100",  iconText: "text-green-600",  hoverBorder: "hover:border-green-300"  },
  amber:  { bar: "bg-amber-500",  iconBg: "bg-amber-100",  iconText: "text-amber-600",  hoverBorder: "hover:border-amber-300"  },
  cyan:   { bar: "bg-cyan-500",   iconBg: "bg-cyan-100",   iconText: "text-cyan-600",   hoverBorder: "hover:border-cyan-300"   },
};

function Tile({ icon: Icon, label, href, value, sub, accent, sev, sevLabel }: TileProps) {
  const a = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.sky;
  return (
    <Link
      href={href}
      className={`group relative bg-white border border-slate-100 ${a.hoverBorder} rounded-xl overflow-hidden
                  hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col`}
    >
      {/* Coloured top strip */}
      <div className={`h-[3px] w-full ${a.bar}`} />

      <div className="p-3 flex-1 flex flex-col gap-2">
        {/* Icon + badge row */}
        <div className="flex items-start justify-between gap-1">
          <div className={`w-7 h-7 ${a.iconBg} rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
            <Icon className={`w-3.5 h-3.5 ${a.iconText}`} />
          </div>
          <Badge sev={sev} label={sevLabel} />
        </div>

        {/* Number */}
        {value !== undefined && (
          <div className="text-[22px] font-bold text-slate-900 leading-none">{value}</div>
        )}

        {/* Label */}
        <div className="text-[11px] font-semibold text-slate-600 leading-tight">{label}</div>

        {/* Sub */}
        {sub && <div className="text-[10px] text-slate-400 leading-tight truncate mt-auto">{sub}</div>}
      </div>
    </Link>
  );
}

// ─── Priority row ─────────────────────────────────────────────────────────────

function Row({ label, dot, children }: { label: string; dot: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsL]   = useState(true);
  const [sigJobs, setSigJobs]       = useState<AwaitingSignatureJob[]>([]);
  const [sigLoading, setSigLoading] = useState(true);
  const [ops, setOps]               = useState<OpsSnapshot | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(d => {
        if (d.success) setStats({
          totalJobs:       d.stats.overview?.totalJobs || 0,
          activeJobs:      d.stats.jobsByStatus?.inProgress || 0,
          totalRevenue:    d.stats.overview?.monthlyRevenue || 0,
          totalLocksmiths: d.stats.overview?.totalLocksmiths || 0,
          activeLocksmiths: d.stats.overview?.totalLocksmiths || 0,
          totalCustomers:  d.stats.overview?.totalCustomers || 0,
        });
      })
      .catch(console.error)
      .finally(() => setStatsL(false));

    fetch("/api/admin/jobs?awaitingSignature=true&limit=10")
      .then(r => r.json())
      .then(d => { if (d.success) setSigJobs(d.jobs); })
      .catch(console.error)
      .finally(() => setSigLoading(false));

    const poll = () =>
      fetch("/api/admin/ops-snapshot").then(r => r.json()).then(setOps).catch(() => {});
    poll();
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const awaitSig    = ops?.ops.awaitingSignature ?? 0;
  const pendVerif   = ops?.people.pendingVerification ?? 0;
  const openDisp    = ops?.safety.openDisputes ?? 0;
  const pendAppr    = ops?.agents.pendingApprovals ?? 0;
  const localPct    = ops?.agents.llmRuntime.localPct;
  const lastModel   = ops?.agents.llmRuntime.lastModel;
  const liveVoice   = ops?.voice.inProgressCalls ?? 0;
  const pendPayout  = ops?.finance.pendingPayouts ?? 0;
  const schedPosts  = ops?.marketing.scheduledPosts ?? 0;
  const activeAds   = ops?.marketing.activeAdCampaigns ?? 0;

  const agentSev = (): Severity => {
    if (!ops?.agents.lastHeartbeat) return "off";
    const m = (Date.now() - new Date(ops.agents.lastHeartbeat).getTime()) / 60000;
    return m < 30 ? "ok" : m < 120 ? "warn" : "alert";
  };

  const getDeadline = (d: string | null) => {
    if (!d) return { text: "No deadline", color: "text-slate-500" };
    const rem = new Date(d).getTime() - Date.now();
    if (rem < 0) return { text: "Overdue", color: "text-red-600" };
    const h = Math.floor(rem / 3_600_000);
    if (h < 2)  return { text: `${Math.floor(rem / 60000)}m left`, color: "text-red-500" };
    if (h < 24) return { text: `${h}h left`, color: "text-amber-500" };
    return { text: `${Math.floor(h / 24)}d left`, color: "text-green-600" };
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-6 space-y-5 max-w-[1600px]">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operations</h1>
            <p className="text-xs text-slate-400 mt-0.5">{greeting()} — live overview</p>
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {ops ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Refreshed {timeAgo(ops.timestamp)}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading…
              </span>
            )}
          </div>
        </div>

        {/* ── Compact stats strip ───────────────────────────────────────────── */}
        <div className="bg-slate-950 rounded-2xl overflow-hidden">
          {statsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-800 divide-y sm:divide-y-0">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-5 py-3.5 animate-pulse">
                  <div className="h-2.5 bg-slate-800 rounded w-16 mb-2" />
                  <div className="h-5 bg-slate-800 rounded w-10" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x divide-slate-800">
              {[
                { label: "Total Jobs",  value: stats?.totalJobs ?? "—", sub: `${stats?.activeJobs ?? 0} active`,        icon: Briefcase,    color: "text-sky-400"    },
                { label: "Revenue",     value: `£${(stats?.totalRevenue || 0).toLocaleString()}`, sub: "This month",    icon: PoundSterling, color: "text-emerald-400" },
                { label: "Locksmiths",  value: stats?.totalLocksmiths ?? "—", sub: `${stats?.activeLocksmiths ?? 0} verified`, icon: Users, color: "text-violet-400" },
                { label: "Customers",   value: stats?.totalCustomers ?? "—",  sub: "Registered users",                 icon: UserCircle,   color: "text-amber-400"  },
              ].map(({ label, value, sub, icon: Icon, color }) => (
                <div key={label} className="px-5 py-3.5 hover:bg-slate-900 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-3 h-3 ${color}`} />
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
                  </div>
                  <div className={`text-xl font-bold ${color} leading-none`}>{value}</div>
                  <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-2.5 h-2.5" />
                    {sub}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Priority rows ─────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* 1 — CRITICAL */}
          <Row label="Critical" dot="bg-red-500">
            <Tile icon={Briefcase}   label="Active Jobs"
              href="/admin/jobs"
              value={ops?.ops.activeJobs ?? "—"}
              sub={`${awaitSig} awaiting signature`}
              accent="red"
              sev={awaitSig > 8 ? "alert" : awaitSig > 3 ? "warn" : "ok"}
              sevLabel={awaitSig > 0 ? `${awaitSig} pending` : "On track"} />
            <Tile icon={PenTool}     label="Awaiting Signature"
              href="/admin/jobs?status=PENDING_CUSTOMER_CONFIRMATION"
              value={ops?.ops.awaitingSignature ?? "—"}
              sub="Pending confirmation"
              accent="amber"
              sev={awaitSig > 5 ? "alert" : awaitSig > 2 ? "warn" : "ok"}
              sevLabel={awaitSig > 0 ? "Needs action" : "All clear"} />
            <Tile icon={AlertTriangle} label="Disputes"
              href="/admin/disputes"
              value={openDisp}
              sub="Open disputes"
              accent="red"
              sev={openDisp > 0 ? "alert" : "ok"}
              sevLabel={openDisp > 0 ? `${openDisp} open` : "None open"} />
            <Tile icon={ShieldCheck}  label="Agent Approvals"
              href="/admin/agents/approvals"
              value={pendAppr}
              sub="Pending decisions"
              accent="violet"
              sev={pendAppr > 0 ? "warn" : "ok"}
              sevLabel={pendAppr > 0 ? `${pendAppr} pending` : "All clear"} />
          </Row>

          {/* 2 — AI & AUTOMATION */}
          <Row label="AI & Automation" dot="bg-violet-500">
            <Tile icon={Bot}          label="AI Agents"
              href="/admin/agents"
              value={ops ? `${ops.agents.active}/${ops.agents.total}` : "—"}
              sub={ops?.agents.lastHeartbeat ? `Beat ${timeAgo(ops.agents.lastHeartbeat)}` : "No heartbeat"}
              accent="violet"
              sev={agentSev()}
              sevLabel={agentSev() === "ok" ? "Healthy" : agentSev() === "warn" ? "Stale" : "Down"} />
            <Tile icon={Cpu}          label="LLM Runtime"
              href="/admin/agents"
              value={localPct != null ? `${localPct}%` : "—"}
              sub={lastModel ?? "No runs (24h)"}
              accent="violet"
              sev={localPct == null ? "off" : localPct > 50 ? "ok" : "warn"}
              sevLabel={localPct != null ? `${localPct}% local` : "No data"} />
            <Tile icon={Phone}        label="Voice AI"
              href="/admin/voice-receptionist"
              value={ops?.voice.todayCalls ?? "—"}
              sub="Calls today"
              accent="violet"
              sev={liveVoice > 0 ? "warn" : "ok"}
              sevLabel={liveVoice > 0 ? `${liveVoice} live` : "Idle"} />
          </Row>

          {/* 3 — OPERATIONS */}
          <Row label="Operations" dot="bg-sky-500">
            <Tile icon={Map}          label="Live Ops Map"
              href="/admin/ops"
              sub="Dispatch & coverage"
              accent="sky"
              sev="ok"
              sevLabel="Live" />
            <Tile icon={Users}        label="Locksmiths"
              href="/admin/locksmiths"
              value={ops?.people.totalLocksmiths ?? "—"}
              sub={`${pendVerif} to verify`}
              accent="emerald"
              sev={pendVerif > 0 ? "warn" : "ok"}
              sevLabel={pendVerif > 0 ? `${pendVerif} pending` : "All verified"} />
            <Tile icon={PoundSterling} label="Payouts"
              href="/admin/payouts"
              value={pendPayout}
              sub="Pending payouts"
              accent="green"
              sev={pendPayout > 0 ? "warn" : "ok"}
              sevLabel={pendPayout > 0 ? `${pendPayout} queued` : "Settled"} />
            <Tile icon={Shield}       label="Security"
              href="/admin/security"
              sub="Fraud radar"
              accent="red"
              sev="ok"
              sevLabel="Monitoring" />
          </Row>

          {/* 4 — MARKETING */}
          <Row label="Marketing" dot="bg-pink-500">
            <Tile icon={Megaphone}    label="Google Ads"
              href="/admin/ads"
              value={activeAds}
              sub="Active campaigns"
              accent="pink"
              sev={activeAds === 0 ? "warn" : "ok"}
              sevLabel={activeAds > 0 ? `${activeAds} live` : "None active"} />
            <Tile icon={Share2}       label="Organic Posts"
              href="/admin/organic"
              value={schedPosts}
              sub={`${ops?.marketing.draftPosts ?? "—"} drafts`}
              accent="pink"
              sev={schedPosts === 0 ? "warn" : "ok"}
              sevLabel={schedPosts > 0 ? `${schedPosts} scheduled` : "Queue empty"} />
            <Tile icon={Mail}         label="Email"
              href="/admin/emails"
              value={ops?.marketing.activeEmailCampaigns ?? "—"}
              sub="Live / scheduled"
              accent="pink"
              sev="ok"
              sevLabel="Active" />
            <Tile icon={BarChart3}    label="Attribution"
              href="/admin/attribution"
              sub="ROAS & spend"
              accent="pink"
              sev="ok"
              sevLabel="Tracking" />
          </Row>

          {/* 5 — PEOPLE & FINANCE */}
          <Row label="People & Finance" dot="bg-emerald-500">
            <Tile icon={UserCircle}   label="Customers"
              href="/admin/customers"
              sub="View all customers"
              accent="emerald"
              sev="ok"
              sevLabel="Active" />
            <Tile icon={Users2}       label="Leads"
              href="/admin/leads"
              sub="View pipeline"
              accent="emerald"
              sev="ok"
              sevLabel="Live" />
            <Tile icon={CreditCard}   label="Payments"
              href="/admin/payments"
              sub="All transactions"
              accent="green"
              sev="ok"
              sevLabel="Running" />
            <Tile icon={Crown}        label="Subscriptions"
              href="/admin/subscriptions"
              sub="Cover plans"
              accent="green"
              sev="ok"
              sevLabel="Active" />
          </Row>

          {/* 6 — SYSTEM */}
          <Row label="System" dot="bg-cyan-500">
            <Tile icon={Brain}        label="Reflections"
              href="/admin/agents/reflections"
              sub="Memory & learning"
              accent="cyan"
              sev="ok"
              sevLabel="Running" />
            <Tile icon={Plug}         label="Integrations"
              href="/admin/integrations"
              sub="Platform connections"
              accent="cyan"
              sev="ok"
              sevLabel="Connected" />
          </Row>

        </div>

        {/* ── Jobs Awaiting Signature ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <PenTool className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Jobs Awaiting Signature</h2>
                <p className="text-[11px] text-slate-500">
                  {sigJobs.length} job{sigJobs.length !== 1 ? "s" : ""} pending confirmation
                </p>
              </div>
            </div>
            <Link href="/admin/jobs?status=PENDING_CUSTOMER_CONFIRMATION"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-0.5">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {sigLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-orange-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading jobs…</p>
            </div>
          ) : sigJobs.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">All caught up!</p>
              <p className="text-xs text-slate-400">No jobs awaiting customer signature.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sigJobs.map((job) => {
                const dl = getDeadline(job.confirmationDeadline);
                const overdue = dl.text === "Overdue";
                return (
                  <div key={job.id} className={`px-5 py-4 hover:bg-slate-50 transition-colors ${overdue ? "bg-red-50" : ""}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Link href={`/admin/jobs?id=${job.id}`}
                            className="font-mono text-xs font-bold text-orange-600 hover:underline">
                            {job.jobNumber}
                          </Link>
                          {overdue && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                              <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                            </span>
                          )}
                          {job.confirmationRemindersSent > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                              {job.confirmationRemindersSent} reminder{job.confirmationRemindersSent !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600">{problemLabels[job.problemType] || job.problemType}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate">{job.address}, {job.postcode}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:flex gap-4 lg:gap-6 shrink-0">
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Customer</div>
                          <div className="text-xs font-semibold text-slate-900 truncate">{job.customer.name}</div>
                          <div className="text-[10px] text-slate-400">{job.customer.phone}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Locksmith</div>
                          <div className="text-xs font-semibold text-slate-900 truncate">{job.locksmith?.name || "—"}</div>
                          {job.locksmith?.companyName && (
                            <div className="text-[10px] text-slate-400 truncate">{job.locksmith.companyName}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Quote</div>
                          <div className="text-xs font-bold text-slate-900">
                            {job.quote ? `£${job.quote.total.toFixed(2)}` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Deadline</div>
                          <div className={`text-xs font-semibold ${dl.color}`}>{dl.text}</div>
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
