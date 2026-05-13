"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Loader2,
  Percent,
  Pencil,
  Trash2,
  X,
  Check,
  Building2,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

interface LocksmithMini {
  id: string;
  name: string;
  email: string;
  phone?: string;
  totalJobs?: number;
  totalEarnings?: number;
  rating?: number;
  performanceScore?: number;
}

interface Membership {
  id: string;
  locksmithId: string;
  locksmith: LocksmithMini;
  locksmithSplit: number;
  platformCommissionOverride: number | null;
  role: string;
  isActive: boolean;
  invitedAt: string;
  acceptedAt: string | null;
}

interface Company {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  ownerId: string | null;
  memberships: Membership[];
  vatNumber: string | null;
  registrationNumber: string | null;
  stripeConnectId: string | null;
  stripeConnectOnboarded: boolean;
}

interface TeamData {
  role: "owner" | "member" | "solo";
  company: Company | null;
  myMembership?: { locksmithSplit: number; platformCommissionOverride: number | null };
}

export default function LocksmithTeamPage() {
  const { toast, toasts, dismiss } = useToast();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  // Create team form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    contactPhone: "",
    vatNumber: "",
    registrationNumber: "",
  });

  // Invite member form
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({ locksmithEmail: "", locksmithSplit: "70" });

  // Inline commission edit
  const [editSplit, setEditSplit] = useState<{ memberId: string; value: string } | null>(null);
  const [savingSplit, setSavingSplit] = useState(false);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/locksmith/team");
      const data = await res.json();
      if (data.success) setTeamData(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.contactPhone) {
      toast({ title: "Missing fields", description: "Team name and phone are required", variant: "error" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/locksmith/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Team created!", description: "You're now a team manager" });
        setShowCreate(false);
        loadTeam();
      } else {
        toast({ title: "Error", description: data.error, variant: "error" });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.locksmithEmail) {
      toast({ title: "Email required", variant: "error" });
      return;
    }
    const split = parseFloat(inviteForm.locksmithSplit);
    if (Number.isNaN(split) || split < 0 || split > 100) {
      toast({ title: "Invalid split", description: "Must be 0–100", variant: "error" });
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/locksmith/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithEmail: inviteForm.locksmithEmail, locksmithSplit: split }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Locksmith added", description: `${inviteForm.locksmithEmail} joined your team` });
        setShowInvite(false);
        setInviteForm({ locksmithEmail: "", locksmithSplit: "70" });
        loadTeam();
      } else {
        toast({ title: "Error", description: data.error, variant: "error" });
      }
    } finally {
      setInviting(false);
    }
  };

  const handleSaveSplit = async (memberId: string) => {
    if (!editSplit) return;
    const split = parseFloat(editSplit.value);
    if (Number.isNaN(split) || split < 0 || split > 100) {
      toast({ title: "Invalid split", description: "Must be 0–100", variant: "error" });
      return;
    }
    setSavingSplit(true);
    try {
      const res = await fetch(`/api/locksmith/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithSplit: split }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Commission updated" });
        setEditSplit(null);
        loadTeam();
      } else {
        toast({ title: "Error", description: data.error, variant: "error" });
      }
    } finally {
      setSavingSplit(false);
    }
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from your team?`)) return;
    const res = await fetch(`/api/locksmith/team/members/${memberId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      toast({ title: "Member removed" });
      loadTeam();
    } else {
      toast({ title: "Error", description: data.error, variant: "error" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Solo: no team yet ─────────────────────────────────────────────────────
  if (!teamData || teamData.role === "solo") {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Toaster toasts={toasts} dismiss={dismiss} />
        <div className="text-center py-16">
          <Building2 className="w-14 h-14 mx-auto text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Start a Team</h1>
          <p className="text-gray-500 mt-2 mb-8">
            Create a team to manage other locksmiths, set their commission split, and receive
            your manager cut automatically from every job they complete.
          </p>

          {/* How it works */}
          <div className="bg-blue-50 rounded-xl p-5 text-left mb-8">
            <h2 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" /> How team commissions work
            </h2>
            <ol className="space-y-2 text-sm text-blue-700 list-decimal list-inside">
              <li>LockSafe platform deducts its fee first (e.g. 25% on work quotes)</li>
              <li>You set a <strong>locksmith split %</strong> per team member</li>
              <li>Remaining net is split: locksmith gets their %, you keep the rest</li>
              <li>Example: £100 job → £75 net after 25% → 70% split = <strong>locksmith £52.50, you £22.50</strong></li>
            </ol>
          </div>

          <Button size="lg" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create My Team
          </Button>
        </div>

        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">Create Your Team</h2>
                <button onClick={() => setShowCreate(false)}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team / Trading Name *</label>
                  <Input
                    placeholder="e.g. London Fast Locks Ltd"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone *</label>
                  <Input
                    placeholder="+44 7700 900000"
                    value={createForm.contactPhone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                    <Input
                      placeholder="GB..."
                      value={createForm.vatNumber}
                      onChange={(e) => setCreateForm((f) => ({ ...f, vatNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Co. Reg No.</label>
                    <Input
                      placeholder="12345678"
                      value={createForm.registrationNumber}
                      onChange={(e) => setCreateForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Team
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Member: read-only view ─────────────────────────────────────────────────
  if (teamData.role === "member" && teamData.company) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Toaster toasts={toasts} dismiss={dismiss} />
        <h1 className="text-2xl font-bold text-gray-900 mb-1">My Team</h1>
        <p className="text-gray-500 mb-6">You are a member of this team</p>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-gray-400" />
            <div>
              <p className="font-bold text-gray-900">{teamData.company.name}</p>
              <p className="text-sm text-gray-500">{teamData.company.contactEmail}</p>
            </div>
          </div>

          {teamData.myMembership && (
            <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
              <Percent className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Your commission split</p>
                <p className="text-sm text-green-700">
                  You keep <strong>{teamData.myMembership.locksmithSplit}%</strong> of net earnings
                  after the platform fee. Your manager keeps{" "}
                  <strong>{100 - teamData.myMembership.locksmithSplit}%</strong>.
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Contact your team manager to update your commission split.
          </p>
        </div>
      </div>
    );
  }

  // ── Owner: full management view ───────────────────────────────────────────
  const company = teamData.company!;
  const members = company.memberships.filter((m) => m.role !== "owner");
  const managerSelf = company.memberships.find((m) => m.role === "owner");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Toaster toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Manager
            </span>
          </div>
          <p className="text-gray-500 text-sm">{company.contactEmail}</p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Locksmith
        </Button>
      </div>

      {/* Commission explainer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Percent className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 mb-1">How commission splits work</p>
            <p className="text-sm text-amber-700">
              For each completed job by a team member:
              <br />
              <strong>1.</strong> LockSafe deducts its platform fee (15–25%)
              <br />
              <strong>2.</strong> You set how much of the remaining net goes to the locksmith
              <br />
              <strong>3.</strong> You receive the rest automatically at payout
            </p>
          </div>
        </div>
      </div>

      {/* Myself row */}
      {managerSelf && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{managerSelf.locksmith.name} <span className="text-xs text-purple-600">(you)</span></p>
            <p className="text-xs text-gray-500">{managerSelf.locksmith.email}</p>
          </div>
          <span className="text-sm font-semibold text-purple-700">Manager</span>
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4" /> Team Members
            <span className="text-xs font-normal text-gray-400">({members.length})</span>
          </h2>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No members yet</p>
            <p className="text-xs mt-1">Add locksmiths by their registered email</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map((m) => {
              const managerCut = 100 - m.locksmithSplit;
              return (
                <div key={m.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{m.locksmith.name}</p>
                      <p className="text-xs text-gray-400 truncate">{m.locksmith.email}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span>{m.locksmith.totalJobs ?? 0} jobs</span>
                        <span>£{((m.locksmith.totalEarnings ?? 0) / 100).toFixed(2)} earned</span>
                        {m.locksmith.rating && (
                          <span>★ {m.locksmith.rating.toFixed(1)}</span>
                        )}
                      </div>
                    </div>

                    {/* Commission split control */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {editSplit?.memberId === m.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              className="w-16 h-7 text-center text-sm"
                              type="number"
                              min={0}
                              max={100}
                              step={5}
                              value={editSplit.value}
                              onChange={(e) =>
                                setEditSplit({ memberId: m.id, value: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveSplit(m.id);
                                if (e.key === "Escape") setEditSplit(null);
                              }}
                              autoFocus
                            />
                            <span className="text-gray-500 text-sm">%</span>
                            <button
                              onClick={() => handleSaveSplit(m.id)}
                              disabled={savingSplit}
                              className="text-green-600 hover:text-green-700 disabled:opacity-50"
                            >
                              {savingSplit ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setEditSplit(null)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setEditSplit({ memberId: m.id, value: String(m.locksmithSplit) })
                            }
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                            title="Click to edit"
                          >
                            <span className="text-lg font-bold">{m.locksmithSplit}%</span>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          Locksmith keeps this %
                        </p>
                      </div>

                      {/* Visual bar */}
                      <div className="w-20 hidden sm:block">
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
                          <div
                            className="h-full bg-blue-400 transition-all"
                            style={{ width: `${m.locksmithSplit}%` }}
                          />
                          <div
                            className="h-full bg-amber-400 transition-all"
                            style={{ width: `${managerCut}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                          <span className="text-blue-500">{m.locksmithSplit}%</span>
                          <span className="text-amber-500">{managerCut}%</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveMember(m.id, m.locksmith.name)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Add Locksmith to Team</h2>
              <button onClick={() => setShowInvite(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Locksmith&apos;s Email
                </label>
                <Input
                  type="email"
                  placeholder="locksmith@example.com"
                  value={inviteForm.locksmithEmail}
                  onChange={(e) => setInviteForm((f) => ({ ...f, locksmithEmail: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Must match their registered LockSafe account email
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Their commission split (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={parseInt(inviteForm.locksmithSplit) || 70}
                    onChange={(e) => setInviteForm((f) => ({ ...f, locksmithSplit: e.target.value }))}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="w-12 text-center font-bold text-blue-700">
                    {inviteForm.locksmithSplit}%
                  </span>
                </div>

                {/* Visual split preview */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-2">Split preview (on £100 job, 25% platform fee)</p>
                  <div className="flex gap-2 text-xs">
                    <div className="flex-1 bg-gray-200 rounded p-2 text-center">
                      <p className="text-gray-500">Platform</p>
                      <p className="font-bold text-gray-700">£25.00</p>
                    </div>
                    <div
                      className="flex-1 bg-blue-100 rounded p-2 text-center"
                      style={{ flexGrow: parseInt(inviteForm.locksmithSplit) || 70 }}
                    >
                      <p className="text-blue-600">Locksmith</p>
                      <p className="font-bold text-blue-700">
                        £{(75 * ((parseInt(inviteForm.locksmithSplit) || 70) / 100)).toFixed(2)}
                      </p>
                    </div>
                    <div
                      className="flex-1 bg-amber-100 rounded p-2 text-center"
                      style={{ flexGrow: 100 - (parseInt(inviteForm.locksmithSplit) || 70) }}
                    >
                      <p className="text-amber-600">You</p>
                      <p className="font-bold text-amber-700">
                        £{(75 * (1 - (parseInt(inviteForm.locksmithSplit) || 70) / 100)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleInvite} disabled={inviting}>
                {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add to Team
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
