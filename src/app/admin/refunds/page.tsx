"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  RotateCcw,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Info,
  CheckCircle2,
} from "lucide-react";

interface Refund {
  id: string;
  amount: number;
  type: string;
  stripePaymentId: string | null;
  createdAt: string;
  refundedAt: string;
  platformFeeKept?: number;
  locksmithOriginalShare?: number;
  locksmithTotalLiability?: number;
  job: {
    id: string;
    jobNumber: string;
    status: string;
    problemType: string;
    address: string;
    postcode: string;
  } | null;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
  } | null;
  locksmith: {
    id: string;
    name: string;
    companyName: string | null;
    email: string;
  } | null;
}

interface RefundStats {
  totalRefunds: number;
  totalRefundedAmount: number;
  platformFeesKept: number;
  locksmithTotalLiability: number;
  byType: Array<{
    type: string;
    count: number;
    amount: number;
    platformFeeKept?: number;
    locksmithLiability?: number;
  }>;
  policyNote?: string;
}

const typeLabels: Record<string, string> = {
  assessment: "Assessment Fee",
  quote: "Quote Payment",
  tip: "Tip",
};

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other",
};

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedRefund, setExpandedRefund] = useState<string | null>(null);

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/refunds?page=${currentPage}&limit=20`);
      const data = await response.json();

      if (data.success) {
        setRefunds(data.refunds);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      } else {
        setError(data.error || "Failed to load refunds");
      }
    } catch (err) {
      setError("Failed to connect to server");
      console.error("Error fetching refunds:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, [currentPage]);

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

  const getTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  if (loading && refunds.length === 0) {
    return (
      <AdminSidebar>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-slate-600">Loading refund history...</p>
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
            <Button onClick={fetchRefunds} className="bg-orange-500 hover:bg-orange-600 text-white">
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
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Refund History</h1>
            <p className="text-sm text-slate-500">Track all processed refunds (no-show policy applied)</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRefunds} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Policy Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-800 font-medium">No-Show Refund Policy</p>
            <p className="text-blue-700 text-sm">
              For no-show refunds, the platform keeps its commission and the locksmith is charged the FULL refund amount.
              This is fair as the locksmith failed to deliver, not the platform.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">Total Refunds</span>
                <RotateCcw className="w-5 h-5 text-slate-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.totalRefunds}</div>
              <div className="text-xs text-slate-500">Processed refunds</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">Customer Refunded</span>
                <DollarSign className="w-5 h-5 text-slate-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalRefundedAmount)}</div>
              <div className="text-xs text-slate-500">Returned to customers</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-green-700">Platform Fees Kept</span>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-600">+{formatCurrency(stats.platformFeesKept)}</div>
              <div className="text-xs text-green-600">Commission retained</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-red-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-red-700">Locksmith Liability</span>
                <Users className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.locksmithTotalLiability)}</div>
              <div className="text-xs text-red-600">Full amount charged to locksmith</div>
            </div>
          </div>
        )}

        {/* Refund Type Breakdown */}
        {stats && stats.byType.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Refunds by Type</h3>
            <div className="flex flex-wrap gap-4">
              {stats.byType.map((item) => (
                <div key={item.type} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {typeLabels[item.type] || item.type}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.count} refunds | {formatCurrency(item.amount)}
                    </div>
                    <div className="text-xs text-green-600">
                      Platform kept: {formatCurrency(item.platformFeeKept || 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refunds List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {refunds.length === 0 ? (
            <div className="p-12 text-center">
              <RotateCcw className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No refunds yet</h3>
              <p className="text-slate-500">Processed refunds will appear here.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Job</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Locksmith</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Refund Amount</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Locksmith Charged</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Refunded</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {refunds.map((refund) => (
                      <tr key={refund.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          {refund.job ? (
                            <div>
                              <Link
                                href={`/job/${refund.job.id}/report`}
                                className="font-mono text-sm font-semibold text-orange-600 hover:underline"
                              >
                                {refund.job.jobNumber}
                              </Link>
                              <div className="text-xs text-slate-500">
                                {problemLabels[refund.job.problemType] || refund.job.problemType}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {typeLabels[refund.type] || refund.type}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {refund.customer ? (
                            <div>
                              <div className="text-sm font-medium text-slate-900">{refund.customer.name}</div>
                              <div className="text-xs text-slate-500">{refund.customer.phone}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {refund.locksmith ? (
                            <div>
                              <div className="text-sm font-medium text-slate-900">{refund.locksmith.name}</div>
                              <div className="text-xs text-slate-500">{refund.locksmith.companyName || refund.locksmith.email}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">No locksmith assigned</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm font-bold text-slate-900">{formatCurrency(refund.amount)}</div>
                          <div className="text-xs text-green-600">
                            Platform kept: {formatCurrency(refund.platformFeeKept || refund.amount * 0.15)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm font-bold text-red-600">
                            {formatCurrency(refund.locksmithTotalLiability || refund.amount)}
                          </div>
                          <div className="text-xs text-slate-500">Full liability</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm text-slate-600">{formatDate(refund.refundedAt)}</div>
                          <div className="text-xs text-slate-400">{getTimeAgo(refund.refundedAt)}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {refund.stripePaymentId && (
                            <a
                              href={`https://dashboard.stripe.com/payments/${refund.stripePaymentId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Stripe
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-slate-100">
                {refunds.map((refund) => (
                  <div key={refund.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        {refund.job ? (
                          <Link
                            href={`/job/${refund.job.id}/report`}
                            className="font-mono text-sm font-semibold text-orange-600 hover:underline"
                          >
                            {refund.job.jobNumber}
                          </Link>
                        ) : (
                          <span className="text-slate-400">No job</span>
                        )}
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          {typeLabels[refund.type] || refund.type}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-900">{formatCurrency(refund.amount)}</div>
                        <div className="text-xs text-slate-500">{getTimeAgo(refund.refundedAt)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-slate-400 mb-0.5">Customer</div>
                        <div className="font-medium text-slate-900">{refund.customer?.name || "-"}</div>
                        {refund.customer?.phone && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />{refund.customer.phone}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-0.5">Locksmith Charged</div>
                        <div className="font-medium text-red-600">
                          {formatCurrency(refund.locksmithTotalLiability || refund.amount)}
                        </div>
                        <div className="text-xs text-green-600">
                          Platform kept: {formatCurrency(refund.platformFeeKept || refund.amount * 0.15)}
                        </div>
                      </div>
                    </div>

                    {refund.job && (
                      <div className="mt-3 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{refund.job.address}, {refund.job.postcode}</span>
                      </div>
                    )}

                    {refund.stripePaymentId && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <a
                          href={`https://dashboard.stripe.com/payments/${refund.stripePaymentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View in Stripe
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-900">No-Show Refund Policy</h4>
              <p className="text-sm text-green-700 mt-1">
                When a locksmith fails to arrive (no-show), they are charged the <strong>FULL refund amount</strong> - not just their share.
                The platform keeps its commission (15% on assessment fees, 25% on work quotes) because the platform did its job of connecting the parties.
                This ensures locksmiths are held accountable for no-shows.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
