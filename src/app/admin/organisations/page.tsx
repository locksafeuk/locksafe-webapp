"use client";

import { useState, useEffect } from "react";
import { Building2, Users, Home, Plus, ChevronRight, Mail, Phone, Percent } from "lucide-react";

interface OrgRow {
  id: string;
  name: string;
  type: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contractedRate: number | null;
  paymentTerms: number;
  creditBalance: number;
  isActive: boolean;
  createdAt: string;
  _count: { members: number; properties: number; jobs: number };
}

const TYPE_LABELS: Record<string, string> = {
  landlord: "Landlord",
  letting_agency: "Letting Agency",
  property_manager: "Property Manager",
  business: "Business",
};

export default function OrganisationsAdminPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "landlord", contactName: "", contactEmail: "",
    contactPhone: "", contractedRate: "", paymentTerms: "30",
    vatNumber: "", billingEmail: "",
  });
  const [saving, setSaving] = useState(false);

  const adminSecret = typeof window !== "undefined"
    ? localStorage.getItem("adminSecret") ?? ""
    : "";

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/organisations", {
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      const data = await res.json();
      setOrgs(data.organisations ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/admin/organisations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({
          ...form,
          contractedRate: form.contractedRate ? Number(form.contractedRate) : undefined,
          paymentTerms: Number(form.paymentTerms),
        }),
      });
      setShowForm(false);
      setForm({ name: "", type: "landlord", contactName: "", contactEmail: "", contactPhone: "", contractedRate: "", paymentTerms: "30", vatNumber: "", billingEmail: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  const totalJobs = orgs.reduce((s, o) => s + o._count.jobs, 0);
  const totalMembers = orgs.reduce((s, o) => s + o._count.members, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            B2B / Landlord Accounts
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage organisations, properties and contracted rates</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Organisation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{orgs.length}</div>
          <div className="text-sm text-gray-500">Organisations</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{totalMembers}</div>
          <div className="text-sm text-gray-500">Total Members</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{totalJobs}</div>
          <div className="text-sm text-gray-500">Total Jobs</div>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">New Organisation</h2>
          <form onSubmit={createOrg} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-600 mb-1">Organisation Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Contact Name *</label>
              <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Contact Email *</label>
              <input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Contact Phone *</label>
              <input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Contracted Assessment Fee (£)</label>
              <input type="number" min="0" step="0.01" placeholder="29.00 (default)" value={form.contractedRate} onChange={e => setForm(f => ({ ...f, contractedRate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Payment Terms (days)</label>
              <input type="number" min="0" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div className="col-span-2 flex gap-3 justify-end mt-2">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2">Cancel</button>
              <button type="submit" disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                {saving ? "Creating…" : "Create Organisation"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Org list */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : orgs.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No organisations yet.</div>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <div key={org.id} className={`bg-white rounded-xl border ${org.isActive ? "border-gray-200" : "border-gray-100 opacity-60"} p-4 flex items-center gap-4`}>
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm">{org.name}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{TYPE_LABELS[org.type] ?? org.type}</span>
                  {!org.isActive && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{org.contactEmail}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{org.contactPhone}</span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-center text-xs text-gray-500">
                {org.contractedRate && (
                  <div className="flex items-center gap-1 text-green-700 font-medium">
                    <Percent className="w-3 h-3" />
                    £{org.contractedRate.toFixed(2)} rate
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-800">{org._count.members}</div>
                  <div className="flex items-center gap-0.5"><Users className="w-3 h-3" />Members</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{org._count.properties}</div>
                  <div className="flex items-center gap-0.5"><Home className="w-3 h-3" />Props</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{org._count.jobs}</div>
                  <div>Jobs</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
