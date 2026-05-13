"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  Building2,
  ChevronRight,
  Percent,
  Loader2,
  Trash2,
  Pencil,
  X,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface LocksmithMini {
  id: string;
  name: string;
  email: string;
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
  owner: LocksmithMini | null;
  memberships: Membership[];
  isActive: boolean;
  registrationNumber: string | null;
  vatNumber: string | null;
  createdAt: string;
}

export default function LocksmithTeamsPage() {
  const { toast, toasts, dismiss } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Create company form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    contactEmail: "",
    contactPhone: "",
    ownerId: "",
    vatNumber: "",
    registrationNumber: "",
  });

  // Add member form
  const [showAddMember, setShowAddMember] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ locksmithId: "", locksmithSplit: "70" });

  // Edit split inline
  const [editSplit, setEditSplit] = useState<{ memberId: string; value: string } | null>(null);
  const [savingSplit, setSavingSplit] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/locksmith-companies?search=${encodeURIComponent(search)}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setCompanies(data.companies);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(loadCompanies, 300);
    return () => clearTimeout(t);
  }, [loadCompanies]);

  const loadCompanyDetail = async (id: string) => {
    const res = await fetch(`/api/admin/locksmith-companies/${id}`);
    const data = await res.json();
    if (data.success) setSelectedCompany(data.company);
  };

  const handleCreate = async () => {
    if (!newForm.name || !newForm.contactEmail || !newForm.contactPhone) {
        toast({ title: "Missing fields", description: "Name, email and phone are required", variant: "error" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/locksmith-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newForm,
          ownerId: newForm.ownerId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Team created", description: `${data.company.name} is ready` });
        setShowCreate(false);
        setNewForm({ name: "", contactEmail: "", contactPhone: "", ownerId: "", vatNumber: "", registrationNumber: "" });
        loadCompanies();
      } else {
        toast({ title: "Error", description: data.error, variant: "error" });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedCompany || !memberForm.locksmithId) return;
    const split = parseFloat(memberForm.locksmithSplit);
    if (Number.isNaN(split) || split < 0 || split > 100) {
      toast({ title: "Invalid split", description: "Must be 0–100", variant: "error" });
      return;
    }
    setAddingMember(true);
    try {
      const res = await fetch(`/api/admin/locksmith-companies/${selectedCompany.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithId: memberForm.locksmithId, locksmithSplit: split }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Member added" });
        setShowAddMember(false);
        setMemberForm({ locksmithId: "", locksmithSplit: "70" });
        loadCompanyDetail(selectedCompany.id);
      } else {
        toast({ title: "Error", description: data.error, variant: "error" });
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleSaveSplit = async (memberId: string) => {
    if (!selectedCompany || !editSplit) return;
    const split = parseFloat(editSplit.value);
    if (Number.isNaN(split) || split < 0 || split > 100) {
      toast({ title: "Invalid split", description: "Must be 0–100", variant: "error" });
      return;
    }
    setSavingSplit(true);
    try {
      const res = await fetch(
        `/api/admin/locksmith-companies/${selectedCompany.id}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locksmithSplit: split }),
        }
      );
      const data = await res.json();
      if (data.success) {
        toast({ title: "Commission updated" });
        setEditSplit(null);
        loadCompanyDetail(selectedCompany.id);
      } else {
        toast({ title: "Error", description: data.error, variant: "error" });
      }
    } finally {
      setSavingSplit(false);
    }
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!selectedCompany) return;
    if (!confirm(`Remove ${name} from the team?`)) return;
    const res = await fetch(
      `/api/admin/locksmith-companies/${selectedCompany.id}/members/${memberId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      toast({ title: "Member removed" });
      loadCompanyDetail(selectedCompany.id);
    }
  };

  return (
    <AdminSidebar>
    <div className="p-6 max-w-7xl mx-auto">
      <Toaster toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locksmith Teams</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage team accounts and per-member commission splits
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Team
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <p className="text-xs text-gray-500">{total} team{total !== 1 ? "s" : ""}</p>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No teams yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadCompanyDetail(c.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedCompany?.id === c.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.contactEmail}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          <Users className="w-3 h-3 inline mr-0.5" />
                          {c.memberships.length} member{c.memberships.length !== 1 ? "s" : ""}
                        </span>
                        {!c.isActive && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded">Inactive</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Team detail */}
        <div className="lg:col-span-2">
          {!selectedCompany ? (
            <div className="flex items-center justify-center h-64 text-gray-400 border-2 border-dashed rounded-xl">
              <div className="text-center">
                <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Select a team to view details</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Team header */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedCompany.name}</h2>
                    <p className="text-sm text-gray-500">{selectedCompany.contactEmail}</p>
                    {selectedCompany.owner && (
                      <p className="text-xs text-gray-400 mt-1">
                        Manager: <span className="font-medium text-gray-600">{selectedCompany.owner.name}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/company/dashboard?companyId=${selectedCompany.id}`, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> View as Manager
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddMember(true)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Member
                    </Button>
                  </div>
                </div>

                {selectedCompany.vatNumber && (
                  <p className="text-xs text-gray-400 mt-2">VAT: {selectedCompany.vatNumber}</p>
                )}
              </div>

              {/* Commission split legend */}
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
                <Percent className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>Commission split:</strong> After the platform fee is deducted, the
                  remaining net is split between the locksmith (their %) and the manager (100 − locksmith %).
                  e.g. <em>70% split</em> → locksmith keeps £70 per £100 net, manager keeps £30.
                </p>
              </div>

              {/* Members table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium text-gray-500">Locksmith</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500">Split %</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500">Manager %</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500">Jobs</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-500">Earnings</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selectedCompany.memberships.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">{m.locksmith.name}</p>
                          <p className="text-xs text-gray-400">{m.locksmith.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              m.role === "owner"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {m.role}
                          </span>
                        </td>

                        {/* Locksmith split — editable inline */}
                        <td className="px-4 py-3 text-center">
                          {editSplit?.memberId === m.id ? (
                            <div className="flex items-center gap-1 justify-center">
                              <Input
                                className="w-16 h-7 text-center text-sm"
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
                              <span className="text-gray-500">%</span>
                              <button
                                onClick={() => handleSaveSplit(m.id)}
                                disabled={savingSplit}
                                className="text-green-600 hover:text-green-700 disabled:opacity-50"
                              >
                                {savingSplit ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => setEditSplit(null)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                m.role !== "owner" &&
                                setEditSplit({ memberId: m.id, value: String(m.locksmithSplit) })
                              }
                              className={`flex items-center gap-1 mx-auto ${
                                m.role === "owner"
                                  ? "text-gray-400 cursor-default"
                                  : "text-blue-600 hover:text-blue-800 cursor-pointer"
                              }`}
                              title={m.role !== "owner" ? "Click to edit" : "Owner keeps full net"}
                            >
                              <span className="font-semibold">{m.locksmithSplit}%</span>
                              {m.role !== "owner" && <Pencil className="w-3 h-3" />}
                            </button>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center text-gray-500">
                          {m.role === "owner" ? "—" : `${(100 - m.locksmithSplit).toFixed(0)}%`}
                        </td>

                        <td className="px-4 py-3 text-center text-gray-600">
                          {m.locksmith.totalJobs ?? 0}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700">
                          £{((m.locksmith.totalEarnings ?? 0) / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {m.role !== "owner" && (
                            <button
                              onClick={() => handleRemoveMember(m.id, m.locksmith.name)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Remove member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {selectedCompany.memberships.length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>No members yet. Add locksmiths to this team.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create team modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">New Team</h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
                <Input
                  placeholder="e.g. London Fast Locks Ltd"
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email *</label>
                <Input
                  type="email"
                  placeholder="team@example.com"
                  value={newForm.contactEmail}
                  onChange={(e) => setNewForm((f) => ({ ...f, contactEmail: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone *</label>
                <Input
                  placeholder="+44..."
                  value={newForm.contactPhone}
                  onChange={(e) => setNewForm((f) => ({ ...f, contactPhone: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manager Locksmith ID <span className="text-gray-400">(optional)</span>
                </label>
                <Input
                  placeholder="Locksmith MongoDB ID"
                  value={newForm.ownerId}
                  onChange={(e) => setNewForm((f) => ({ ...f, ownerId: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
                  <Input
                    placeholder="GB..."
                    value={newForm.vatNumber}
                    onChange={(e) => setNewForm((f) => ({ ...f, vatNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Co. Reg No.</label>
                  <Input
                    placeholder="12345678"
                    value={newForm.registrationNumber}
                    onChange={(e) => setNewForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Team
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAddMember && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Add Member</h2>
              <button onClick={() => setShowAddMember(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Locksmith ID</label>
                <Input
                  placeholder="MongoDB ID"
                  value={memberForm.locksmithId}
                  onChange={(e) => setMemberForm((f) => ({ ...f, locksmithId: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Locksmith Split % <span className="text-gray-400">(0–100)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={memberForm.locksmithSplit}
                    onChange={(e) => setMemberForm((f) => ({ ...f, locksmithSplit: e.target.value }))}
                  />
                  <span className="text-gray-500 shrink-0">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Manager keeps {100 - (parseFloat(memberForm.locksmithSplit) || 0)}% of net after platform fee
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddMember(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAddMember} disabled={addingMember}>
                {addingMember && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Member
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminSidebar>
  );
}
