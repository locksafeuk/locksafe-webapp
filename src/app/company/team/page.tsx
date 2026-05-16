"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Briefcase,
  Star,
  Loader2,
  Pencil,
  Check,
  X,
  PoundSterling,
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
  memberships: Membership[];
}

function CompanyTeamContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId") ?? undefined;
  const { toasts, toast, dismiss } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

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
      }
    } catch {
      toast({ title: "Failed to load team data", variant: "error" });
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
      toast({ title: "Commission split updated" });
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

  if (!company) {
    return (
      <CompanySidebar companyId={companyId}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>Could not load team data.</p>
          </div>
        </div>
      </CompanySidebar>
    );
  }

  const totalJobs = company.memberships.reduce((sum, m) => sum + (m.locksmith.totalJobs ?? 0), 0);
  const totalEarnings = company.memberships.reduce((sum, m) => sum + (m.locksmith.totalEarnings ?? 0), 0);
  const avgRating =
    company.memberships.length > 0
      ? company.memberships.reduce((sum, m) => sum + (m.locksmith.rating ?? 0), 0) / company.memberships.length
      : 0;

  return (
    <CompanySidebar companyId={companyId}>
      <Toaster toasts={toasts} dismiss={dismiss} />
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            My Team
          </h1>
          <p className="text-sm text-gray-500 mt-1">{company.name} · {company.memberships.length} member{company.memberships.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Members", value: company.memberships.length, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Total Jobs", value: totalJobs.toLocaleString(), icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Total Earned", value: `£${(totalEarnings / 100).toFixed(2)}`, icon: PoundSterling, color: "text-green-600", bg: "bg-green-50" },
            { label: "Avg Rating", value: avgRating > 0 ? avgRating.toFixed(1) + " ★" : "—", icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Commission explanation */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800 flex items-start gap-2">
          <span className="text-amber-600 font-bold mt-0.5">%</span>
          <span>
            <strong>Commission split:</strong> After the platform fee is deducted, the remaining net is split between the locksmith (their %) and you as manager (100 − locksmith %).
            {" "}e.g. <em>70% split → locksmith keeps £70 per £100 net, you keep £30.</em>
          </span>
        </div>

        {/* Members table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Team Members & Commission</h2>
          </div>

          {company.memberships.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No team members yet</p>
              <p className="text-xs mt-1">Contact your admin to add members to your team.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {company.memberships.map((m) => {
                const ls = m.locksmith;
                const managerCut = 100 - m.locksmithSplit;
                const isEditing = editingId === m.id;

                return (
                  <div key={m.id} className="px-6 py-4 flex flex-wrap items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {ls.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{ls.name}</span>
                        {m.role === "owner" && (
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold uppercase">Owner</span>
                        )}
                        {!ls.isActive && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Inactive</span>
                        )}
                        {!m.acceptedAt && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase">Pending invite</span>
                        )}
                        {ls.isVerified && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase">Verified</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{ls.email}</div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-5 text-xs text-gray-500">
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
                      {ls.performanceScore !== null && (
                        <div className="text-center">
                          <div className={`font-semibold text-sm px-2 py-0.5 rounded ${ls.performanceScore >= 80 ? "bg-green-100 text-green-700" : ls.performanceScore >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {ls.performanceScore}
                          </div>
                          <div>Score</div>
                        </div>
                      )}
                    </div>

                    {/* Commission split */}
                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs">
                        <div className="text-gray-400 mb-1">Locksmith / You</div>
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
                                title="Edit split"
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

        <p className="text-xs text-gray-400 text-center">
          To add or remove team members, contact your LockSafe account manager.
        </p>
      </div>
    </CompanySidebar>
  );
}

export default function CompanyTeamPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>}>
      <CompanyTeamContent />
    </Suspense>
  );
}
