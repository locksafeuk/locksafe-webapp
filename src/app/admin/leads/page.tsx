"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  Search,
  Phone,
  Mail,
  Globe,
  Star,
  Download,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  MessageSquare,
  UserCheck,
  XCircle,
  Loader2,
  RefreshCw,
  Users2,
  Edit,
  X,
  Send,
  Smartphone,
  Trash2,
  Plus,
} from "lucide-react";
import type { OutreachSubjectStyle, OutreachTrack } from "@/lib/lead-outreach";
import { WhatsAppButton } from "@/components/WhatsAppButton";

interface Lead {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  rating: number;
  reviewCount: number;
  status: string;
  notes: string | null;
  contactedAt: string | null;
  contactedBy: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  new: number;
  contacted: number;
  replied: number;
  onboarded: number;
  not_interested: number;
  newWithEmail: number;
  newWithMobile: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface OutreachVariantStat {
  key: string;
  sends: number;
  opens: number;
  clicks: number;
  onboarded: number;
  openRate: number;
  clickRate: number;
  signupRate: number;
}

interface OutreachStats {
  totalSends: number;
  totalOpens: number;
  totalClicks: number;
  variants: OutreachVariantStat[];
}

const STATUS_CONFIG: Record<string, { label: string; colour: string }> = {
  new: { label: "New", colour: "bg-blue-100 text-blue-700" },
  contacted: { label: "Contacted", colour: "bg-yellow-100 text-yellow-700" },
  replied: { label: "Replied", colour: "bg-purple-100 text-purple-700" },
  onboarded: { label: "Onboarded", colour: "bg-emerald-100 text-emerald-700" },
  not_interested: { label: "Not Interested", colour: "bg-slate-100 text-slate-500" },
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 100, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [bulkInviting, setBulkInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ sent: number; failed: number } | null>(null);
  const [outreachStats, setOutreachStats] = useState<OutreachStats | null>(null);
  const [sequenceSending, setSequenceSending] = useState(false);
  const [sequenceTrack, setSequenceTrack] = useState<OutreachTrack>("independent");
  const [sequenceStyle, setSequenceStyle] = useState<OutreachSubjectStyle>("benefit");
  const [sequenceTouch, setSequenceTouch] = useState<1 | 2 | 3>(1);
  const [sequenceVariant, setSequenceVariant] = useState<1 | 2 | 3>(1);

  // SMS state
  const [smsSending, setSmsSending] = useState<string | null>(null);
  const [bulkSmsing, setBulkSmsing] = useState(false);
  const [smsResult, setSmsResult] = useState<{ sent: number; failed: number } | null>(null);

  // Email edit modal
  const [emailLead, setEmailLead] = useState<Lead | null>(null);
  const [emailText, setEmailText] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Notes modal
  const [notesLead, setNotesLead] = useState<Lead | null>(null);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const hasActiveFilters = Boolean(search || statusFilter !== "all" || cityFilter !== "all");

  /** True for UK mobile numbers: 07xxx, +447xxx, 00447xxx */
  const isUKMobile = (phone: string | null): boolean => {
    if (!phone) return false;
    const clean = phone.replace(/[\s\-().]/g, "");
    return /^07\d{9}$/.test(clean) || /^\+447\d{9}$/.test(clean) || /^00447\d{9}$/.test(clean);
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (cityFilter !== "all") params.set("city", cityFilter);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", "100");
      const res = await fetch(`/api/admin/leads?${params}`);
      const data = await res.json();
      if (!res.ok) return;
      setLeads(data.leads || []);
      setStats(data.stats || null);
      setCities(data.cities || []);
      setOutreachStats(data.outreachStats || null);
      if (data.pagination) setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, cityFilter, search, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Reset to page 1 when filters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on filter change
  useEffect(() => { setPage(1); }, [statusFilter, cityFilter, search]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    setOpenMenu(null);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const saveNotes = async () => {
    if (!notesLead) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notesLead.id, notes: notesText }),
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === notesLead.id ? { ...l, notes: notesText } : l));
        setNotesLead(null);
      }
    } finally {
      setSavingNotes(false);
    }
  };

  const sendInvite = async (id: string) => {
    setInviteSending(id);
    setOpenMenu(null);
    try {
      const res = await fetch("/api/admin/leads/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.sent > 0) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: "contacted", contactedBy: "invite-email" } : l));
      }
    } finally {
      setInviteSending(null);
    }
  };

  const sendSms = async (id: string) => {
    setSmsSending(id);
    setOpenMenu(null);
    try {
      const res = await fetch("/api/admin/leads/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.sent > 0) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: "contacted", contactedBy: "sms" } : l));
      } else {
        alert(data.error || "SMS failed");
      }
    } finally {
      setSmsSending(null);
    }
  };

  const sendBulkSms = async () => {
    if (!stats?.newWithMobile) return;
    setBulkSmsing(true);
    setSmsResult(null);
    try {
      const res = await fetch("/api/admin/leads/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bulk-all" }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "SMS send failed"); return; }
      setSmsResult({ sent: data.sent, failed: data.failed });
      await fetchLeads();
    } finally {
      setBulkSmsing(false);
    }
  };

  const saveEmail = async () => {
    if (!emailLead) return;
    setSavingEmail(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emailLead.id, email: emailText || null }),
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === emailLead.id ? { ...l, email: emailText || null } : l));
        setEmailLead(null);
      }
    } finally {
      setSavingEmail(false);
    }
  };

  const deleteEmail = async (id: string) => {
    setOpenMenu(null);
    const res = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email: null }),
    });
    if (res.ok) setLeads(prev => prev.map(l => l.id === id ? { ...l, email: null } : l));
  };

  const sendBulkInvites = async () => {
    if (!stats?.newWithEmail) return;
    setBulkInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch("/api/admin/leads/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bulk-all" }),
      });
      const data = await res.json();
      setInviteResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
      await fetchLeads();
    } finally {
      setBulkInviting(false);
    }
  };

  const runSequenceTouch = async () => {
    setSequenceSending(true);
    setInviteResult(null);
    try {
      const res = await fetch("/api/admin/leads/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "sequence",
          track: sequenceTrack,
          subjectStyle: sequenceStyle,
          touch: sequenceTouch,
          variant: sequenceVariant,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Sequence send failed");
        return;
      }
      setInviteResult({ sent: data.sent || 0, failed: data.failed || 0 });
      await fetchLeads();
    } finally {
      setSequenceSending(false);
    }
  };

  const downloadCsv = () => {
    const header = "Name,Email,Phone,City,Address,Website,Rating,Reviews,Status\n";
    const rows = leads.map(l =>
      [l.name, l.email || "", l.phone || "", l.city, l.address, l.website || "", l.rating, l.reviewCount, l.status]
        .map(v => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `locksmith-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCityFilter("all");
    setPage(1);
  };

  return (
    <AdminSidebar>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users2 className="w-6 h-6 text-orange-500" />
              Locksmith Leads
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Independent locksmiths to onboard onto LockSafe</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={downloadCsv} variant="outline">
              <Download className="w-4 h-4 mr-1.5" />
              CSV
            </Button>
            <Button
              size="sm"
              onClick={sendBulkInvites}
              disabled={bulkInviting || !stats?.newWithEmail}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {bulkInviting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Email Invites ({stats?.newWithEmail ?? 0} new)
            </Button>
            <Button
              size="sm"
              onClick={sendBulkSms}
              disabled={bulkSmsing || !stats?.newWithMobile}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {bulkSmsing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Smartphone className="w-4 h-4 mr-1.5" />}
              SMS ({stats?.newWithMobile ?? 0} mobile)
            </Button>
          </div>
        </div>

        {/* SMS result banner */}
        {smsResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-green-800">
              📱 <strong>{smsResult.sent}</strong> welcome SMS{smsResult.sent !== 1 ? "es" : ""} sent
              {smsResult.failed > 0 && <span className="text-red-600 ml-2">· {smsResult.failed} failed</span>}
            </p>
            <button onClick={() => setSmsResult(null)} className="text-green-500 hover:text-green-700"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Invite result banner */}
        {inviteResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-emerald-800">
              ✅ <strong>{inviteResult.sent}</strong> invite emails sent successfully
              {inviteResult.failed > 0 && <span className="text-red-600 ml-2">· {inviteResult.failed} failed</span>}
            </p>
            <button onClick={() => setInviteResult(null)} className="text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { key: "all", label: "Total", value: stats.total, colour: "text-slate-900" },
              { key: "new", label: "New", value: stats.new, colour: "text-blue-600" },
              { key: "contacted", label: "Contacted", value: stats.contacted, colour: "text-yellow-600" },
              { key: "replied", label: "Replied", value: stats.replied, colour: "text-purple-600" },
              { key: "onboarded", label: "Onboarded", value: stats.onboarded, colour: "text-emerald-600" },
              { key: "not_interested", label: "Not Interested", value: stats.not_interested, colour: "text-slate-400" },
            ].map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => setStatusFilter(s.key)}
                className={`rounded-xl border p-4 text-center transition-colors ${
                  statusFilter === s.key
                    ? "bg-orange-50 border-orange-300"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`text-2xl font-bold ${s.colour}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* Sequence Controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Autonomous Lead Email Sequence</h2>
              <p className="text-xs text-slate-500">Touch 1, 2, and 3 run automatically with track + A/B variant targeting.</p>
            </div>
            <Button
              size="sm"
              onClick={runSequenceTouch}
              disabled={sequenceSending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {sequenceSending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Run Automated Touch {sequenceTouch}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select
              value={sequenceTrack}
              onChange={(e) => setSequenceTrack(e.target.value as OutreachTrack)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="independent">Track: Independent</option>
              <option value="manager">Track: Manager</option>
            </select>
            <select
              value={sequenceStyle}
              onChange={(e) => setSequenceStyle(e.target.value as OutreachSubjectStyle)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="benefit">Style: Benefit-first</option>
              <option value="direct">Style: Direct commission</option>
            </select>
            <select
              value={sequenceTouch}
              onChange={(e) => setSequenceTouch(Number(e.target.value) as 1 | 2 | 3)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={1}>Touch 1 (automatic first send)</option>
              <option value={2}>Touch 2 (automatic after 3 days)</option>
              <option value={3}>Touch 3 (automatic after 7 days)</option>
            </select>
            <select
              value={sequenceVariant}
              onChange={(e) => setSequenceVariant(Number(e.target.value) as 1 | 2 | 3)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={1}>Variant 1</option>
              <option value={2}>Variant 2</option>
              <option value={3}>Variant 3</option>
            </select>
          </div>
        </div>

        {/* Outreach performance */}
        {outreachStats && outreachStats.variants.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span><strong className="text-slate-900">Sends:</strong> {outreachStats.totalSends}</span>
              <span><strong className="text-slate-900">Opens:</strong> {outreachStats.totalOpens}</span>
              <span><strong className="text-slate-900">Clicks:</strong> {outreachStats.totalClicks}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Variant Key</th>
                    <th className="px-4 py-3 text-left">Sends</th>
                    <th className="px-4 py-3 text-left">Open Rate</th>
                    <th className="px-4 py-3 text-left">Click Rate</th>
                    <th className="px-4 py-3 text-left">Signup Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outreachStats.variants.slice(0, 12).map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{row.key}</td>
                      <td className="px-4 py-3 text-slate-700">{row.sends}</td>
                      <td className="px-4 py-3 text-slate-700">{row.openRate}%</td>
                      <td className="px-4 py-3 text-slate-700">{row.clickRate}%</td>
                      <td className="px-4 py-3 text-slate-700">{row.signupRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, city, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(search || statusFilter !== "all" || cityFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setCityFilter("all"); }}>
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Loading leads...</span>
            </div>
          ) : leads.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Users2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              {stats && stats.total > 0 ? (
                <>
                  <p className="font-medium">No leads match current filters</p>
                  <p className="text-sm mt-1">Try clearing filters to view all leads.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">
                    <X className="w-4 h-4 mr-1" /> Clear Filters
                  </Button>
                </>
              ) : hasActiveFilters ? (
                <>
                  <p className="font-medium">No leads match current filters</p>
                  <p className="text-sm mt-1">Try a broader search or clear filters.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">
                    <X className="w-4 h-4 mr-1" /> Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-medium">No leads found</p>
                  <p className="text-sm mt-1">
                    Lead sourcing runs automatically in-app via the scraper cron (Serper.dev,
                    gap-fill mode). New leads appear here as they&apos;re discovered — or trigger a
                    one-off run from the Manual Scraper page.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Locksmith</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">City</th>
                    <th className="px-4 py-3 text-left">Rating</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map(lead => {
                    const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
                    return (
                      <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                        {/* Name + website */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{lead.name}</div>
                          {lead.website && (
                            <a
                              href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-orange-500 hover:underline flex items-center gap-0.5 mt-0.5"
                            >
                              <Globe className="w-3 h-3" /> Website
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 group">
                            {lead.email ? (
                              <>
                                <a
                                  href={`mailto:${lead.email}`}
                                  className="text-blue-600 hover:underline flex items-center gap-1 min-w-0"
                                >
                                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate max-w-[160px]">{lead.email}</span>
                                </a>
                                <button
                                  title="Edit email"
                                  onClick={() => { setEmailLead(lead); setEmailText(lead.email || ""); }}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-orange-500 transition-opacity ml-1 flex-shrink-0"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  title="Delete email"
                                  onClick={() => deleteEmail(lead.id)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity flex-shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <button
                                title="Add email"
                                onClick={() => { setEmailLead(lead); setEmailText(""); }}
                                className="text-slate-400 hover:text-orange-500 flex items-center gap-1 text-xs"
                              >
                                <Plus className="w-3 h-3" /> Add email
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3">
                          {lead.phone ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={`tel:${lead.phone}`}
                                className="text-slate-700 hover:text-orange-500 flex items-center gap-1"
                              >
                                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                                {lead.phone}
                              </a>
                              <WhatsAppButton
                                phone={lead.phone}
                                message={`Hi ${lead.name}, this is LockSafe — `}
                                iconOnly
                                size="sm"
                                context={{ targetType: "lead", targetId: lead.id }}
                              />
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* City */}
                        <td className="px-4 py-3 text-slate-600">{lead.city}</td>

                        {/* Rating */}
                        <td className="px-4 py-3">
                          {lead.rating > 0 ? (
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                              <span>{lead.rating.toFixed(1)}</span>
                              <span className="text-slate-400 text-xs">({lead.reviewCount})</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.colour}`}>
                            {sc.label}
                          </span>
                          {lead.contactedBy && (
                            <div className="text-xs text-slate-400 mt-0.5">by {lead.contactedBy}</div>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3">
                          {lead.notes ? (
                            <span className="text-xs text-slate-600 truncate max-w-[150px] block" title={lead.notes}>
                              {lead.notes}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setOpenMenu(openMenu === lead.id ? null : lead.id)}
                              disabled={actionLoading?.startsWith(lead.id)}
                            >
                              {actionLoading?.startsWith(lead.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>Actions <ChevronDown className="w-3 h-3 ml-1" /></>
                              )}
                            </Button>

                            {openMenu === lead.id && (
                              <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-44">
                                <button
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-yellow-700"
                                  onClick={() => updateStatus(lead.id, "contacted")}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" /> Mark Contacted
                                </button>
                                <button
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-purple-700"
                                  onClick={() => updateStatus(lead.id, "replied")}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Replied
                                </button>
                                <button
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-emerald-700"
                                  onClick={() => updateStatus(lead.id, "onboarded")}
                                >
                                  <UserCheck className="w-3.5 h-3.5" /> Mark Onboarded
                                </button>
                                <button
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-500"
                                  onClick={() => updateStatus(lead.id, "not_interested")}
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Not Interested
                                </button>
                                <div className="border-t border-slate-100 my-1" />
                                <button
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                  onClick={() => { setNotesLead(lead); setNotesText(lead.notes || ""); setOpenMenu(null); }}
                                >
                                  <Edit className="w-3.5 h-3.5" /> Edit Notes
                                </button>
                                <button
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                  onClick={() => { setEmailLead(lead); setEmailText(lead.email || ""); setOpenMenu(null); }}
                                >
                                  <Mail className="w-3.5 h-3.5" /> {lead.email ? "Edit Email" : "Add Email"}
                                </button>
                                {lead.email && (
                                  <button
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                                    onClick={() => deleteEmail(lead.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Email
                                  </button>
                                )}
                                {lead.email && lead.status === "new" && (
                                  <>
                                    <div className="border-t border-slate-100 my-1" />
                                    <button
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 text-blue-700 font-medium"
                                      onClick={() => sendInvite(lead.id)}
                                      disabled={inviteSending === lead.id}
                                    >
                                      {inviteSending === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                      Send Invite Email
                                    </button>
                                  </>
                                )}
                                {isUKMobile(lead.phone) && lead.status === "new" && (
                                  <button
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 flex items-center gap-2 text-green-700 font-medium"
                                    onClick={() => sendSms(lead.id)}
                                    disabled={smsSending === lead.id}
                                  >
                                    {smsSending === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                                    Send Welcome SMS
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer: count + pagination */}
          {!loading && leads.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-slate-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} lead{pagination.total !== 1 ? "s" : ""}
              </span>
              {pagination.pages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                  >
                    ← Prev
                  </button>
                  <span className="px-3 py-1.5 text-sm text-slate-600">
                    {pagination.page} / {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={pagination.page >= pagination.pages}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Email Edit / Add Modal */}
      {emailLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">
                {emailLead.email ? "Edit Email" : "Add Email"} — {emailLead.name}
              </h3>
              <button onClick={() => setEmailLead(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="email"
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              placeholder="locksmith@example.co.uk"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") saveEmail(); }}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEmailLead(null)}>Cancel</Button>
              {emailLead.email && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { deleteEmail(emailLead.id); setEmailLead(null); }}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              )}
              <Button size="sm" onClick={saveEmail} disabled={savingEmail} className="bg-orange-500 hover:bg-orange-600 text-white">
                {savingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Notes — {notesLead.name}</h3>
              <button onClick={() => setNotesLead(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              rows={5}
              placeholder="Add notes about this lead..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" size="sm" onClick={() => setNotesLead(null)}>Cancel</Button>
              <Button size="sm" onClick={saveNotes} disabled={savingNotes} className="bg-orange-500 hover:bg-orange-600 text-white">
                {savingNotes ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Save Notes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Close dropdown on outside click */}
      {openMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
      )}
    </AdminSidebar>
  );
}
