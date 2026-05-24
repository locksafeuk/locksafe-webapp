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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${s.badge}`}>
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
  const borderColor = sev === "alert" ? "border-red-200" : sev === "warn" ? "border-amber-200" : "border-slate-100";
  const pendingBorderClass =
    sev === "alert" ? "pending-border-red" : sev === "warn" ? "pending-border-amber" : "";
  return (
    <Link
      href={href}
      className={`group relative bg-white border ${borderColor} ${a.hoverBorder} ${pendingBorderClass} rounded-xl overflow-hidden
                  hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col min-h-[132px]`}
    >
      {/* Coloured top strip — taller + pulsing for warn/alert */}
      <div className={`w-full ${a.bar} ${
        sev === "alert" ? "h-1.5 animate-pulse" :
        sev === "warn"  ? "h-1 animate-pulse" :
        "h-[3px]"
      }`} />

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
          <div className="text-[24px] font-bold text-slate-900 leading-none">{value}</div>
        )}

        {/* Label */}
        <div className="text-[13px] font-semibold text-slate-600 leading-tight">{label}</div>

        {/* Sub */}
        {sub && <div className="text-[12px] text-slate-400 leading-tight truncate mt-auto">{sub}</div>}
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
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
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
  const visibleSigJobs = sigJobs.slice(0, 4);

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
      <div className="p-4 lg:p-5 xl:p-6 space-y-4 w-full max-w-none">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operations</h1>
            <p className="text-sm text-slate-400 mt-0.5">{greeting()} — live overview</p>
          </div>
          <div className="text-[13px] text-slate-400 tabular-nums">
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
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
                  </div>
                  <div className={`text-2xl font-bold ${color} leading-none`}>{value}</div>
                  <div className="text-[12px] text-slate-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-2.5 h-2.5" />
                    {sub}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Priority rows — calibrated 3-column desktop / 2-column tablet ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1.08fr_1.05fr_0.92fr] gap-4 items-start">

          {/* COL 1 — critical operations */}
          <div className="space-y-4">

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

            {/* 2 — OPERATIONS */}
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

          </div>

          {/* COL 2 — AI + people/finance */}
          <div className="space-y-4">

            {/* 3 — AI & AUTOMATION */}
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

            {/* 4 — PEOPLE & FINANCE */}
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

          </div>

          {/* COL 3 — growth + system + signature queue */}
          <div className="space-y-4">

            {/* 5 — MARKETING */}
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

            {/* 7 — SIGNATURE QUEUE */}
            <div className={`bg-white rounded-xl shadow-sm overflow-hidden border ${awaitSig > 0 ? "border-amber-200 pending-border-amber" : "border-slate-100"}`}>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                    <PenTool className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 truncate">Jobs Awaiting Signature</h2>
                    <p className="text-[12px] text-slate-500">{awaitSig} pending confirmation</p>
                  </div>
                </div>
                <Link href="/admin/jobs?status=PENDING_CUSTOMER_CONFIRMATION"
                  className="text-[13px] font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-0.5 shrink-0">
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {sigLoading ? (
                <div className="p-5 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-400 mx-auto mb-2" />
                  <p className="text-[13px] text-slate-500">Loading jobs…</p>
                </div>
              ) : awaitSig === 0 ? (
                <div className="p-5 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-sm font-semibold text-slate-600">All caught up</p>
                  <p className="text-[12px] text-slate-400">No jobs awaiting customer signature.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {visibleSigJobs.map((job) => {
                    const dl = getDeadline(job.confirmationDeadline);
                    const overdue = dl.text === "Overdue";
                    const rowPulseClass = overdue ? "pending-border-red border-red-200 bg-red-50/70" : "pending-border-amber border-amber-200 bg-amber-50/40";

                    return (
                      <div key={job.id} className="px-3 py-2.5">
                        <div className={`rounded-lg border ${rowPulseClass} px-2.5 py-2 transition-colors`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <Link href={`/admin/jobs?id=${job.id}`} className="font-mono text-[13px] font-bold text-orange-600 hover:underline truncate">
                              {job.jobNumber}
                            </Link>
                            <span className={`text-[12px] font-semibold ${dl.color}`}>{dl.text}</span>
                          </div>
                          <div className="text-[13px] text-slate-700 truncate mb-1">{problemLabels[job.problemType] || job.problemType}</div>
                          <div className="text-[12px] text-slate-500 truncate mb-1.5">{job.address}, {job.postcode}</div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-slate-600">
                            <span className="truncate"><span className="font-semibold text-slate-700">Customer:</span> {job.customer.name}</span>
                            <span className="truncate"><span className="font-semibold text-slate-700">Quote:</span> {job.quote ? `£${job.quote.total.toFixed(2)}` : "—"}</span>
                            <span className="truncate"><span className="font-semibold text-slate-700">Locksmith:</span> {job.locksmith?.name || "—"}</span>
                            <span className="truncate"><span className="font-semibold text-slate-700">Reminders:</span> {job.confirmationRemindersSent}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </AdminSidebar>
  );
}
