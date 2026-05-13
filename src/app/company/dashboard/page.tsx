"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  TrendingUp,
  Briefcase,
  Star,
  Loader2,
  Pencil,
  Check,
  X,
  ChevronRight,
  Building2,
  PoundSterling,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { CompanySidebar } from "@/components/layout/CompanySidebar";

interface Locksmith {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalJobs: number;
  totalEarnings: number;
  rating: number;
  performanceScore: number | null;
  isActive: boolean;
  isVerified: boolean;
}

interface Membership {
  id: string;
  locksmithId: string;
  locksmithSplit: number;
  platformCommissionOverride: number | null;
  role: string;
  invitedAt: string;
  acceptedAt: string | null;
  locksmith: Locksmith;
}

interface Company {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  stripeConnectOnboarded: boolean;
  memberships: Membership[];
  owner: { id: string; name: string; email: string } | null;
}

interface RecentJob {
  id: string;
  status: string;
  problemType: string;
  propertyType: string;
  assessmentFee: number | null;
  createdAt: string;
  workCompletedAt: string | null;
  locksmithId: string | null;
  customer: { name: string } | null;
  locksmith: { id: string; name: string } | null;
}

interface Stats {
  totalJobs: number;
  totalEarnings: number;
  avgRating: number;
  memberCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  EN_ROUTE: "bg-indigo-100 text-indigo-700",
  ACCEPTED: "bg-amber-100 text-amber-700",
  PENDING: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
  DISPUTED: "bg-rose-100 text-rose-700",
};

export default function CompanyDashboardPage() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId") ?? undefined;
  const { toasts, toast, dismiss } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline split editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSplit, setEditSplit] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const url = companyId ? `/api/company/dashboard?companyId=${companyId}` : "/api/company/dashboard";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCompany(data.company);
        setStats(data.stats);
        setRecentJobs(data.recentJobs ?? []);
      }
    } catch {
      toast({ title: "Failed to load dashboard", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (m: Membership) => {
    setEditingId(m.id);
    setEditSplit(String(m.locksmithSplit));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSplit("");
  };

  const saveSplit = async (memberId: string) => {
    const val = parseFloat(editSplit);
    if (isNaN(val) || val < 0 || val > 100) {
        toast({ title: "Split must be 0–100%", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const url = companyId
        ? `/api/company/members/${memberId}?companyId=${companyId}`
        : `/api/company/members/${memberId}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithSplit: val }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Commission updated" });
      setEditingId(null);
      await load();
    } catch {
        toast({ title: "Failed to save", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CompanySidebar companyId={companyId}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </CompanySidebar>
    );
  }

  if (!company || !stats) {
    return (
      <CompanySidebar companyId={companyId}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>Could not load company data.</p>
          </div>
        </div>
      </CompanySidebar>
    );
  }

  return (
    <CompanySidebar companyId={companyId}>
      <Toaster toasts={toasts} dismiss={dismiss} />
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <p className="text-sm text-gray-500">{company.contactEmail} · {company.contactPhone}</p>
            </div>
          </div>
          {!company.stripeConnectOnboarded && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Stripe payouts not set up
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Team Members", value: stats.memberCount, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Total Jobs", value: stats.totalJobs.toLocaleString(), icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Total Earnings", value: `£${(stats.totalEarnings / 100).toFixed(2)}`, icon: PoundSterling, color: "text-green-600", bg: "bg-green-50" },
            { label: "Avg Rating", value: stats.avgRating.toFixed(1) + " ★", icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Team Members + Commission */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Team Members & Commission Splits
            </h2>
            <span className="text-xs text-gray-400">{company.memberships.length} member{company.memberships.length !== 1 ? "s" : ""}</span>
          </div>

          {company.memberships.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No team members yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {company.memberships.map((m) => {
                const ls = m.locksmith;
                const managerCut = 100 - m.locksmithSplit;
                const isEditing = editingId === m.id;

                return (
                  <div key={m.id} className="px-6 py-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {ls.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{ls.name}</span>
                        {m.role === "owner" && (
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold">OWNER</span>
                        )}
                        {!ls.isActive && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inactive</span>
                        )}
                        {!m.acceptedAt && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Pending invite</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{ls.email}</div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-6 text-xs text-gray-500">
                      <div className="text-center">
                        <div className="font-semibold text-gray-800 text-sm">{ls.totalJobs}</div>
                        <div>Jobs</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-800 text-sm">£{(ls.totalEarnings / 100).toFixed(0)}</div>
                        <div>Earned</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-800 text-sm">{ls.rating.toFixed(1)} ★</div>
                        <div>Rating</div>
                      </div>
                    </div>

                    {/* Commission Split */}
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <div className="text-gray-400 mb-1">Locksmith / Manager</div>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={editSplit}
                              onChange={(e) => setEditSplit(e.target.value)}
                              className="w-16 h-7 text-xs text-center"
                            />
                            <span className="text-gray-400 text-xs">%</span>
                            <button
                              onClick={() => saveSplit(m.id)}
                              disabled={saving}
                              className="text-green-600 hover:text-green-700 p-1"
                            >
                              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">
                              {m.locksmithSplit}% / {managerCut}%
                            </span>
                            {m.role !== "owner" && (
                              <button
                                onClick={() => startEdit(m)}
                                className="text-gray-300 hover:text-indigo-500 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600" />
              Recent Team Jobs
            </h2>
            <span className="text-xs text-gray-400">Last 20</span>
          </div>

          {recentJobs.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No jobs yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentJobs.map((job) => (
                <div key={job.id} className="px-6 py-3.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{job.problemType} / {job.propertyType}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{job.customer?.name ?? "Unknown customer"}</span>
                      {job.locksmith && (
                        <>
                          <ChevronRight className="w-3 h-3" />
                          <span>{job.locksmith.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500 flex-shrink-0">
                    {job.assessmentFee != null ? (
                      <span className="font-semibold text-gray-800 text-sm">Fee: £{(job.assessmentFee / 100).toFixed(2)}</span>
                    ) : null}
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(job.createdAt).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance summary */}
        {stats.memberCount > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Performance Summary
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Locksmith</th>
                    <th className="text-right pb-2 font-medium">Jobs</th>
                    <th className="text-right pb-2 font-medium">Earnings</th>
                    <th className="text-right pb-2 font-medium">Rating</th>
                    <th className="text-right pb-2 font-medium">Score</th>
                    <th className="text-right pb-2 font-medium">Their Split</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {company.memberships.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 text-gray-800 font-medium">{m.locksmith.name}</td>
                      <td className="py-2.5 text-right text-gray-600">{m.locksmith.totalJobs}</td>
                      <td className="py-2.5 text-right text-gray-600">£{(m.locksmith.totalEarnings / 100).toFixed(0)}</td>
                      <td className="py-2.5 text-right text-gray-600">{m.locksmith.rating.toFixed(1)} ★</td>
                      <td className="py-2.5 text-right">
                        {m.locksmith.performanceScore != null ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            m.locksmith.performanceScore >= 80 ? "bg-green-100 text-green-700" :
                            m.locksmith.performanceScore >= 60 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {m.locksmith.performanceScore}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-indigo-700">{m.locksmithSplit}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </CompanySidebar>
  );
}
