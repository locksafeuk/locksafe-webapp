"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Banknote,
  RefreshCw,
  Send,
  DollarSign,
  TrendingUp,
  Building,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  FileText,
  Users,
  Briefcase,
} from "lucide-react";

interface Locksmith {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
}

interface Payout {
  id: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  paidAt: string | null;
  locksmith: Locksmith;
  jobIds?: string[];
}

interface PayoutStats {
  totalPaid: number;
  totalPlatformFees: number;
  totalNetPaid: number;
  pendingAmount: number;
  byStatus: Array<{
    status: string;
    _count: number;
    _sum: { amount: number | null };
  }>;
}

interface PendingEarning {
  locksmithId: string;
  locksmithName: string;
  companyName: string | null;
  email: string;
  jobCount: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  jobIds: string[];
  jobs: Array<{
    id: string;
    jobNumber: string;
    total: number;
    completedAt: string;
  }>;
}

interface PendingEarningsTotals {
  totalLocksmiths: number;
  totalJobs: number;
  totalGross: number;
  totalPlatformFees: number;
  totalNet: number;
}

export default function AdminPayoutsPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "history" | "generate">("pending");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Generate payouts state
  const [pendingEarnings, setPendingEarnings] = useState<PendingEarning[]>([]);
  const [earningsTotals, setEarningsTotals] = useState<PendingEarningsTotals | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [selectedLocksmiths, setSelectedLocksmiths] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedLocksmith, setExpandedLocksmith] = useState<string | null>(null);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/payouts");
      const data = await response.json();

      if (data.success) {
        setPayouts(data.payouts);
        setStats(data.stats);
      } else {
        setError(data.error || "Failed to load payouts");
      }
    } catch (err) {
      setError("Failed to connect to server");
      console.error("Error fetching payouts:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingEarnings = async () => {
    try {
      setLoadingEarnings(true);
      const response = await fetch("/api/admin/payouts/generate");
      const data = await response.json();

      if (data.success) {
        setPendingEarnings(data.pendingEarnings);
        setEarningsTotals(data.totals);
      } else {
        console.error("Failed to fetch pending earnings:", data.error);
      }
    } catch (err) {
      console.error("Error fetching pending earnings:", err);
    } finally {
      setLoadingEarnings(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  useEffect(() => {
    if (activeTab === "generate") {
      fetchPendingEarnings();
    }
  }, [activeTab]);

  // Filter payouts by tab
  const pendingPayouts = payouts.filter(p => p.status === "pending" || p.status === "processing");
  const historyPayouts = payouts.filter(p => p.status === "paid" || p.status === "failed");

  const handleSelectAll = () => {
    const readyPayouts = pendingPayouts.filter(p => p.status === "pending").map(p => p.id);
    if (selectedPayouts.length === readyPayouts.length) {
      setSelectedPayouts([]);
    } else {
      setSelectedPayouts(readyPayouts);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedPayouts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleProcessPayouts = async () => {
    if (selectedPayouts.length === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutIds: selectedPayouts }),
      });

      const data = await response.json();

      if (data.success) {
        setSelectedPayouts([]);
        await fetchPayouts();
        alert(`Successfully processed ${data.processedCount} payout(s)!`);
      } else {
        alert(data.error || "Failed to process payouts");
      }
    } catch (err) {
      alert("Failed to process payouts");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessSingle = async (payoutId: string) => {
    setProcessingId(payoutId);
    try {
      const response = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutIds: [payoutId] }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchPayouts();
      } else {
        alert(data.error || "Failed to process payout");
      }
    } catch (err) {
      alert("Failed to process payout");
    } finally {
      setProcessingId(null);
    }
  };

  // Generate payouts handlers
  const handleSelectAllLocksmiths = () => {
    if (selectedLocksmiths.length === pendingEarnings.length) {
      setSelectedLocksmiths([]);
    } else {
      setSelectedLocksmiths(pendingEarnings.map(e => e.locksmithId));
    }
  };

  const handleToggleLocksmith = (locksmithId: string) => {
    setSelectedLocksmiths(prev =>
      prev.includes(locksmithId)
        ? prev.filter(id => id !== locksmithId)
        : [...prev, locksmithId]
    );
  };

  const handleGeneratePayouts = async () => {
    if (selectedLocksmiths.length === 0) {
      alert("Please select at least one locksmith");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/admin/payouts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithIds: selectedLocksmiths }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully created ${data.createdCount} pending payout(s)!`);
        setSelectedLocksmiths([]);
        setActiveTab("pending");
        await fetchPayouts();
        await fetchPendingEarnings();
      } else {
        alert(data.error || "Failed to generate payouts");
      }
    } catch (err) {
      alert("Failed to generate payouts");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (pendingEarnings.length === 0) {
      alert("No pending earnings to generate payouts for");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/admin/payouts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithIds: pendingEarnings.map(e => e.locksmithId) }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully created ${data.createdCount} pending payout(s)!`);
        setSelectedLocksmiths([]);
        setActiveTab("pending");
        await fetchPayouts();
        await fetchPendingEarnings();
      } else {
        alert(data.error || "Failed to generate payouts");
      }
    } catch (err) {
      alert("Failed to generate payouts");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const selectedTotal = pendingPayouts
    .filter(p => selectedPayouts.includes(p.id))
    .reduce((sum, p) => sum + p.netAmount, 0);

  const selectedEarningsTotal = pendingEarnings
    .filter(e => selectedLocksmiths.includes(e.locksmithId))
    .reduce((sum, e) => sum + e.netAmount, 0);

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <AdminSidebar>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-slate-600">Loading payouts...</p>
          </div>
        </div>
      </AdminSidebar>
    );
  }

  if (error) {
    return (
      <AdminSidebar>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchPayouts} className="bg-orange-500 hover:bg-orange-600 text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </AdminSidebar>
    );
  }

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Payouts</h1>
            <p className="text-sm text-slate-500">Manage locksmith payouts</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchPayouts}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1 lg:mb-2">
              <span className="text-xs lg:text-sm text-slate-500">Pending</span>
              <Banknote className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
            </div>
            <div className="text-lg lg:text-2xl font-bold text-orange-600">
              {formatCurrency(stats?.pendingAmount || 0)}
            </div>
            <div className="text-xs text-slate-500">{pendingPayouts.length} payouts</div>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1 lg:mb-2">
              <span className="text-xs lg:text-sm text-slate-500">Total Paid</span>
              <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-green-500" />
            </div>
            <div className="text-lg lg:text-2xl font-bold text-green-600">
              {formatCurrency(stats?.totalNetPaid || 0)}
            </div>
            <div className="text-xs text-green-600">Net to locksmiths</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Platform Revenue</span>
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(stats?.totalPlatformFees || 0)}
            </div>
            <div className="text-xs text-slate-500">Commission earned</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">Total Processed</span>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(stats?.totalPaid || 0)}
            </div>
            <div className="text-xs text-slate-500">Gross amount</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "pending"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Pending ({pendingPayouts.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "history"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            History ({historyPayouts.length})
          </button>
          <button
            onClick={() => setActiveTab("generate")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === "generate"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Plus className="w-4 h-4" />
            Generate Payouts
          </button>
        </div>

        {/* Generate Payouts Tab */}
        {activeTab === "generate" && (
          <>
            {loadingEarnings ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
                <p className="text-slate-600">Loading pending earnings...</p>
              </div>
            ) : pendingEarnings.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">All caught up!</h3>
                <p className="text-slate-500">No completed jobs pending payout. All locksmiths have been paid.</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 opacity-80" />
                      <span className="text-sm opacity-80">Locksmiths</span>
                    </div>
                    <div className="text-2xl font-bold">{earningsTotals?.totalLocksmiths || 0}</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="w-4 h-4 opacity-80" />
                      <span className="text-sm opacity-80">Jobs</span>
                    </div>
                    <div className="text-2xl font-bold">{earningsTotals?.totalJobs || 0}</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="w-4 h-4 opacity-80" />
                      <span className="text-sm opacity-80">Net Payout</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(earningsTotals?.totalNet || 0)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 opacity-80" />
                      <span className="text-sm opacity-80">Platform Fees</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(earningsTotals?.totalPlatformFees || 0)}</div>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedLocksmiths.length === pendingEarnings.length && selectedLocksmiths.length > 0}
                      onChange={handleSelectAllLocksmiths}
                      className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-slate-600">
                      {selectedLocksmiths.length > 0
                        ? `${selectedLocksmiths.length} selected - ${formatCurrency(selectedEarningsTotal)} total`
                        : "Select locksmiths to generate payouts"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {selectedLocksmiths.length > 0 && (
                      <Button
                        onClick={handleGeneratePayouts}
                        disabled={isGenerating}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {isGenerating ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Generate Selected ({selectedLocksmiths.length})
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={handleGenerateAll}
                      disabled={isGenerating}
                      variant="outline"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Generate All ({pendingEarnings.length})
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Pending Earnings List */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="divide-y">
                    {pendingEarnings.map((earning) => (
                      <div key={earning.locksmithId} className="hover:bg-slate-50 transition-colors">
                        <div
                          className={`p-4 cursor-pointer ${
                            selectedLocksmiths.includes(earning.locksmithId) ? "bg-orange-50" : ""
                          }`}
                          onClick={() => setExpandedLocksmith(
                            expandedLocksmith === earning.locksmithId ? null : earning.locksmithId
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={selectedLocksmiths.includes(earning.locksmithId)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleToggleLocksmith(earning.locksmithId);
                              }}
                              className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                            />

                            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                              {getInitials(earning.locksmithName)}
                            </div>

                            <div className="flex-1">
                              <div className="font-medium text-slate-900">{earning.locksmithName}</div>
                              <div className="text-sm text-slate-500">{earning.companyName || earning.email}</div>
                            </div>

                            <div className="text-center">
                              <div className="text-sm font-medium text-slate-900">{earning.jobCount}</div>
                              <div className="text-xs text-slate-500">jobs</div>
                            </div>

                            <div className="text-right">
                              <div className="text-xl font-bold text-slate-900">{formatCurrency(earning.netAmount)}</div>
                              <div className="text-xs text-slate-500">
                                Gross: {formatCurrency(earning.grossAmount)} | Fee: {formatCurrency(earning.platformFee)}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedLocksmith(
                                  expandedLocksmith === earning.locksmithId ? null : earning.locksmithId
                                );
                              }}
                            >
                              {expandedLocksmith === earning.locksmithId ? (
                                <ChevronUp className="w-5 h-5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Job Details */}
                        {expandedLocksmith === earning.locksmithId && (
                          <div className="px-4 pb-4">
                            <div className="bg-slate-50 rounded-lg p-4">
                              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Jobs Included ({earning.jobs.length})
                              </h4>
                              <div className="space-y-2">
                                {earning.jobs.map((job) => (
                                  <div
                                    key={job.id}
                                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Link
                                        href={`/job/${job.id}/report`}
                                        className="font-mono text-sm font-semibold text-orange-600 hover:underline"
                                      >
                                        {job.jobNumber}
                                      </Link>
                                      <span className="text-xs text-slate-500">
                                        Completed {formatDate(job.completedAt)}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-slate-900">
                                      {formatCurrency(job.total)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Pending Payouts */}
        {activeTab === "pending" && (
          <>
            {/* Action Bar */}
            {selectedPayouts.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-orange-600" />
                  <span className="text-orange-800 font-medium">
                    {selectedPayouts.length} payout(s) selected - {formatCurrency(selectedTotal)} total
                  </span>
                </div>
                <Button
                  onClick={handleProcessPayouts}
                  disabled={isProcessing}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Process Selected
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {pendingPayouts.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No pending payouts</h3>
                  <p className="text-slate-500 mb-4">All payouts have been processed.</p>
                  <Button
                    onClick={() => setActiveTab("generate")}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Generate New Payouts
                  </Button>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedPayouts.length === pendingPayouts.filter(p => p.status === "pending").length && selectedPayouts.length > 0}
                        onChange={handleSelectAll}
                        className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-600">Select all pending payouts</span>
                    </div>
                  </div>

                  <div className="divide-y">
                    {pendingPayouts.map((payout) => (
                      <div
                        key={payout.id}
                        className={`p-4 hover:bg-slate-50 transition-colors ${
                          selectedPayouts.includes(payout.id) ? "bg-orange-50" : ""
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedPayouts.includes(payout.id)}
                            onChange={() => handleToggleSelect(payout.id)}
                            disabled={payout.status !== "pending"}
                            className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                          />

                          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                            {getInitials(payout.locksmith.name)}
                          </div>

                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{payout.locksmith.name}</div>
                            <div className="text-sm text-slate-500">{payout.locksmith.companyName || payout.locksmith.email}</div>
                            <div className="text-xs text-slate-400 mt-1">
                              Period: {new Date(payout.periodStart).toLocaleDateString()} - {new Date(payout.periodEnd).toLocaleDateString()}
                              {payout.jobIds && payout.jobIds.length > 0 && (
                                <span className="ml-2">| {payout.jobIds.length} jobs</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xl font-bold text-slate-900">{formatCurrency(payout.netAmount)}</div>
                            <div className="text-xs text-slate-500">
                              Gross: {formatCurrency(payout.amount)} | Fee: {formatCurrency(payout.platformFee)}
                            </div>
                            {payout.status === "pending" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs mt-1">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs mt-1">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Processing
                              </span>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={payout.status !== "pending" || processingId === payout.id}
                            onClick={() => handleProcessSingle(payout.id)}
                          >
                            {processingId === payout.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Payout History */}
        {activeTab === "history" && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {historyPayouts.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No payout history</h3>
                <p className="text-slate-500">Processed payouts will appear here.</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-medium text-slate-900">Payout History</h3>
                  <div className="flex gap-2">
                    <select className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none">
                      <option>All Status</option>
                      <option>Paid</option>
                      <option>Failed</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                          Locksmith
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                          Jobs
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                          Amount
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                          Status
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                          Processed
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                          Period
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {historyPayouts.map((payout) => (
                        <tr key={payout.id} className="hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                {getInitials(payout.locksmith.name)}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">{payout.locksmith.name}</div>
                                <div className="text-xs text-slate-500">{payout.locksmith.companyName || payout.locksmith.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">
                              <Briefcase className="w-3 h-3" />
                              {payout.jobIds?.length || 0}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="font-bold text-slate-900">{formatCurrency(payout.netAmount)}</span>
                          </td>
                          <td className="px-4 py-4">
                            {payout.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                <CheckCircle2 className="w-3 h-3" />
                                Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                                <XCircle className="w-3 h-3" />
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-slate-900">
                              {payout.paidAt ? formatDate(payout.paidAt) : formatDate(payout.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-xs text-slate-500">
                              {new Date(payout.periodStart).toLocaleDateString()} - {new Date(payout.periodEnd).toLocaleDateString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Building className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Stripe Connect Payouts</h4>
              <p className="text-sm text-blue-700 mt-1">
                Payouts are processed through Stripe Connect. Funds typically arrive in locksmith bank accounts within 2-3 business days.
                Failed payouts may require the locksmith to update their bank details in their Stripe dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* Cron Info Box */}
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-slate-900">Automatic Payout Generation</h4>
              <p className="text-sm text-slate-600 mt-1">
                Payouts can be auto-generated weekly via cron. Set up a cron job at{" "}
                <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
                  cron-job.org
                </a>{" "}
                to POST to <code className="bg-slate-200 px-1 rounded text-xs">/api/cron/generate-payouts</code> with{" "}
                <code className="bg-slate-200 px-1 rounded text-xs">Authorization: Bearer YOUR_CRON_SECRET</code> header.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
