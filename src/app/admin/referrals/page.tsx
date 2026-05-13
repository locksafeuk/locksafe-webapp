"use client";

import { useEffect, useState } from "react";
import { Gift, Users, TrendingUp, Clock, CheckCircle2, Loader2, Copy, Check } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface ReferralRow {
  id: string;
  code: string;
  referrerName: string;
  referrerType: string;
  referredName: string | null;
  referredEmail: string | null;
  status: string;
  clickCount: number;
  referrerReward: number;
  referredReward: number;
  convertedAt: string | null;
  rewardedAt: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  active: number;
  converted: number;
  rewarded: number;
  totalClicks: number;
  totalRewardsPaid: number;
  totalDiscountsGiven: number;
}

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  converted: "bg-yellow-100 text-yellow-800",
  rewarded: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-600",
};

export default function AdminReferralsPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/referrals");
      const data = await res.json();
      setRows(data.referrals ?? []);
      setStats(data.stats ?? null);
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
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
        <h1 className="text-2xl font-bold text-gray-900">Referral System</h1>
        <p className="text-sm text-gray-500 mt-1">Track all referral codes, conversions, and rewards</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total codes", value: stats.total, icon: Gift, colour: "text-purple-600 bg-purple-50" },
            { label: "Converted", value: stats.converted, icon: Users, colour: "text-yellow-600 bg-yellow-50" },
            { label: "Rewarded", value: stats.rewarded, icon: CheckCircle2, colour: "text-green-600 bg-green-50" },
            { label: "Total clicks", value: stats.totalClicks, icon: TrendingUp, colour: "text-blue-600 bg-blue-50" },
          ].map(({ label, value, icon: Icon, colour }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${colour}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-700 font-medium">Total rewards paid to referrers</p>
            <p className="text-2xl font-bold text-green-800 mt-1">£{stats.totalRewardsPaid.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700 font-medium">Total discounts given to referred users</p>
            <p className="text-2xl font-bold text-blue-800 mt-1">£{stats.totalDiscountsGiven.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {["all", "active", "converted", "rewarded", "expired"].map((s) => (
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
                {["Code", "Referrer", "Referred", "Status", "Clicks", "Rewards", "Created"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No referrals found
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{row.code}</code>
                        <button
                          onClick={() => copyCode(row.code, row.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {copiedId === row.id ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.referrerName}</p>
                      <p className="text-xs text-gray-400 capitalize">{row.referrerType}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.referredName ? (
                        <>
                          <p className="font-medium text-gray-900">{row.referredName}</p>
                          <p className="text-xs text-gray-400">{row.referredEmail}</p>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLOURS[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.clickCount}</td>
                    <td className="px-4 py-3">
                      {row.status === "rewarded" ? (
                        <div>
                          <p className="text-xs text-green-700 font-medium">+£{row.referrerReward} referrer</p>
                          <p className="text-xs text-blue-700">-£{row.referredReward} referred</p>
                        </div>
                      ) : row.status === "converted" ? (
                        <p className="text-xs text-yellow-700">Pending job completion</p>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(row.createdAt).toLocaleDateString("en-GB")}
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
