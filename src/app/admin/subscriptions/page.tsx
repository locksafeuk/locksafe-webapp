"use client";

import { useEffect, useState } from "react";
import { Shield, Crown, Loader2, XCircle } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface SubscriptionRow {
  id: string;
  customerId: string;
  plan: string;
  status: string;
  freeCallouts: number;
  freeCalloutsTotal: number;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  customer: {
    name: string;
    email: string | null;
    phone: string;
  };
}

interface Stats {
  total: number;
  active: number;
  trialing: number;
  canceled: number;
  mrr: number;
}

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-blue-100 text-blue-800",
  canceled: "bg-gray-100 text-gray-600",
  past_due: "bg-red-100 text-red-800",
};

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/subscriptions");
      const data = await res.json();
      setRows(data.subscriptions ?? []);
      setStats(data.stats ?? null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async (customerId: string, customerName: string) => {
    if (!confirm(`Cancel Cover for ${customerName}? This will set cancel_at_period_end.`)) return;
    setActionLoading(customerId);
    try {
      await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, action: "cancel" }),
      });
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <AdminSidebar>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LockSafe Cover Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage active Cover subscribers</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total", value: stats.total, colour: "text-gray-600 bg-gray-50" },
              { label: "Active", value: stats.active, colour: "text-green-700 bg-green-50" },
              { label: "Trialing", value: stats.trialing, colour: "text-blue-700 bg-blue-50" },
              { label: "Canceled", value: stats.canceled, colour: "text-red-700 bg-red-50" },
              { label: "Est. MRR", value: `£${stats.mrr.toFixed(2)}`, colour: "text-orange-700 bg-orange-50" },
            ].map(({ label, value, colour }) => (
              <div key={label} className={`rounded-xl border border-gray-200 p-4 ${colour.split(" ")[1]} bg-opacity-50`}>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-xl font-bold mt-1 ${colour.split(" ")[0]}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 border-b border-gray-200">
          {["all", "active", "trialing", "canceled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                filter === s
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {s === "all" ? `All (${rows.length})` : `${s} (${rows.filter((r) => r.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Customer", "Plan", "Status", "Free Callouts", "Renews", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                      No subscriptions found
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Crown className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{row.customer.name}</p>
                            <p className="text-xs text-gray-400">{row.customer.email ?? row.customer.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-orange-500" />
                          <span className="capitalize text-gray-700">
                            {row.plan === "cover_annual" ? "Annual" : "Monthly"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLOURS[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {row.cancelAtPeriodEnd ? "canceling" : row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-center">
                        {row.freeCallouts}/{row.freeCalloutsTotal}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(row.currentPeriodEnd).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {!row.cancelAtPeriodEnd && row.status !== "canceled" && (
                          <button
                            onClick={() => handleCancel(row.customerId, row.customer.name)}
                            disabled={actionLoading === row.customerId}
                            className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
