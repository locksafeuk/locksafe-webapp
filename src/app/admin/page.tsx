"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Briefcase,
  Loader2,
  TrendingUp,
  CheckCircle2,
  PoundSterling,
  PenTool,
  AlertTriangle,
  Phone,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  totalRevenue: number;
  totalLocksmiths: number;
  activeLocksmiths: number;
  totalCustomers: number;
  pendingPayouts: number;
}

interface AwaitingSignatureJob {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  address: string;
  postcode: string;
  createdAt: string;
  workCompletedAt: string | null;
  confirmationDeadline: string | null;
  confirmationRemindersSent: number;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  locksmith: {
    name: string;
    companyName: string | null;
  } | null;
  quote: {
    total: number;
  } | null;
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other",
};

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [awaitingSignatureJobs, setAwaitingSignatureJobs] = useState<AwaitingSignatureJob[]>([]);
  const [signatureLoading, setSignatureLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchAwaitingSignatureJobs();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/stats");
      const data = await response.json();
      if (data.success) {
        setStats({
          totalJobs: data.stats.overview?.totalJobs || 0,
          activeJobs: data.stats.jobsByStatus?.inProgress || 0,
          completedJobs: data.stats.jobsByStatus?.completed || 0,
          totalRevenue: data.stats.overview?.monthlyRevenue || 0,
          totalLocksmiths: data.stats.overview?.totalLocksmiths || 0,
          activeLocksmiths: data.stats.overview?.totalLocksmiths || 0,
          totalCustomers: data.stats.overview?.totalCustomers || 0,
          pendingPayouts: 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchAwaitingSignatureJobs = async () => {
    try {
      const response = await fetch("/api/admin/jobs?awaitingSignature=true&limit=10");
      const data = await response.json();
      if (data.success) {
        setAwaitingSignatureJobs(data.jobs);
      }
    } catch (error) {
      console.error("Failed to fetch awaiting signature jobs:", error);
    } finally {
      setSignatureLoading(false);
    }
  };

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return { text: "No deadline", color: "text-slate-500" };
    const remaining = new Date(deadline).getTime() - Date.now();
    if (remaining < 0) return { text: "Overdue", color: "text-red-600" };
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours < 2) return { text: `${Math.floor(remaining / 60000)}m left`, color: "text-red-500" };
    if (hours < 24) return { text: `${hours}h left`, color: "text-amber-500" };
    return { text: `${Math.floor(hours / 24)}d left`, color: "text-green-600" };
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Welcome back, Admin User</p>
        </div>

        {/* Stats Grid */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
                <div className="h-6 lg:h-8 bg-slate-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <span className="text-slate-500 text-xs lg:text-sm">Total Jobs</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-lg lg:rounded-xl flex items-center justify-center">
                  <Briefcase className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600" />
                </div>
              </div>
              <div className="text-xl lg:text-3xl font-bold text-slate-900">{stats.totalJobs}</div>
              <div className="text-xs lg:text-sm text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" />
                <span>{stats.activeJobs} active</span>
              </div>
            </div>
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <span className="text-slate-500 text-xs lg:text-sm">Revenue</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-100 rounded-lg lg:rounded-xl flex items-center justify-center">
                  <PoundSterling className="w-4 h-4 lg:w-5 lg:h-5 text-green-600" />
                </div>
              </div>
              <div className="text-xl lg:text-3xl font-bold text-slate-900">
                £{(stats.totalRevenue || 0).toLocaleString()}
              </div>
              <div className="text-xs lg:text-sm text-slate-500 mt-1">This month</div>
            </div>
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <span className="text-slate-500 text-xs lg:text-sm">Locksmiths</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-lg lg:rounded-xl flex items-center justify-center">
                  <Users className="w-4 h-4 lg:w-5 lg:h-5 text-purple-600" />
                </div>
              </div>
              <div className="text-xl lg:text-3xl font-bold text-slate-900">{stats.totalLocksmiths}</div>
              <div className="text-xs lg:text-sm text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3 lg:w-4 lg:h-4" />
                <span>{stats.activeLocksmiths} verified</span>
              </div>
            </div>
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <span className="text-slate-500 text-xs lg:text-sm">Customers</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-orange-100 rounded-lg lg:rounded-xl flex items-center justify-center">
                  <Users className="w-4 h-4 lg:w-5 lg:h-5 text-orange-600" />
                </div>
              </div>
              <div className="text-xl lg:text-3xl font-bold text-slate-900">{stats.totalCustomers}</div>
              <div className="text-xs lg:text-sm text-slate-500 mt-1">Registered users</div>
            </div>
          </div>
        ) : null}

        {/* Jobs Awaiting Signature */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm mb-6 lg:mb-8 overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <PenTool className="w-5 h-5 lg:w-6 lg:h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base lg:text-lg font-bold text-slate-900">Jobs Awaiting Signature</h2>
                  <p className="text-xs lg:text-sm text-slate-500">
                    {awaitingSignatureJobs.length} job{awaitingSignatureJobs.length !== 1 ? "s" : ""} pending confirmation
                  </p>
                </div>
              </div>
              <Link
                href="/admin/jobs?status=PENDING_CUSTOMER_CONFIRMATION"
                className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1"
              >
                View All
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          {signatureLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Loading jobs...</p>
            </div>
          ) : awaitingSignatureJobs.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">All caught up!</p>
              <p className="text-slate-500 text-sm">No jobs awaiting customer signature.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {awaitingSignatureJobs.map((job) => {
                const deadlineStatus = getDeadlineStatus(job.confirmationDeadline);
                const isOverdue = deadlineStatus.text === "Overdue";
                return (
                  <div
                    key={job.id}
                    className={`p-4 lg:p-5 hover:bg-slate-50 transition-colors ${isOverdue ? "bg-red-50" : ""}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Link
                            href={`/admin/jobs?id=${job.id}`}
                            className="font-mono text-sm font-semibold text-orange-600 hover:underline"
                          >
                            {job.jobNumber}
                          </Link>
                          {isOverdue && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Overdue
                            </span>
                          )}
                          {job.confirmationRemindersSent > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                              {job.confirmationRemindersSent} reminder{job.confirmationRemindersSent !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 mb-1">
                          {problemLabels[job.problemType] || job.problemType}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">
                            {job.address}, {job.postcode}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:flex gap-3 lg:gap-6">
                        <div className="min-w-0">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Customer</div>
                          <div className="text-sm font-medium text-slate-900 truncate">{job.customer.name}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />
                            {job.customer.phone}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Locksmith</div>
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {job.locksmith?.name || "Not assigned"}
                          </div>
                          {job.locksmith?.companyName && (
                            <div className="text-xs text-slate-500 truncate">{job.locksmith.companyName}</div>
                          )}
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Quote</div>
                          <div className="text-sm font-bold text-slate-900">
                            {job.quote ? `£${job.quote.total.toFixed(2)}` : "-"}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Deadline</div>
                          <div className={`text-sm font-medium ${deadlineStatus.color}`}>{deadlineStatus.text}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          <Link
            href="/admin/jobs"
            className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Manage Jobs</h3>
                <p className="text-xs lg:text-sm text-slate-500">View and manage all jobs</p>
              </div>
            </div>
          </Link>
          <Link
            href="/admin/locksmiths"
            className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Locksmiths</h3>
                <p className="text-xs lg:text-sm text-slate-500">Verify and manage locksmiths</p>
              </div>
            </div>
          </Link>
          <Link
            href="/admin/payouts"
            className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1"
          >
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <PoundSterling className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Payouts</h3>
                <p className="text-xs lg:text-sm text-slate-500">Process locksmith payouts</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </AdminSidebar>
  );
}
