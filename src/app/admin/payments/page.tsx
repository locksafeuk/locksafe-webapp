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
  CreditCard,
  RefreshCw,
  Search,
  TrendingUp,
  PoundSterling,
  Briefcase,
  Tag,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface Payment {
  id: string;
  type: string;
  amount: number;
  status: string;
  stripePaymentId: string | null;
  createdAt: string;
  job: {
    id: string;
    jobNumber: string;
    assessmentFee: number;
    assessmentPaid: boolean;
    customer: {
      name: string;
      email: string | null;
    };
    locksmith: {
      name: string;
      companyName: string | null;
    } | null;
    quote: {
      total: number;
    } | null;
  };
}

interface PaymentStats {
  totalRevenue: number;
  totalAssessmentFees: number;
  totalWorkPayments: number;
  totalDeductions: number;
  paymentCount: number;
  thisMonth: number;
  lastMonth: number;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "assessment" | "quote">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "succeeded" | "pending" | "failed">("all");

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/payments");
      const data = await response.json();

      if (data.success) {
        setPayments(data.payments);
        setStats(data.stats);
      } else {
        setError(data.error || "Failed to load payments");
      }
    } catch (err) {
      setError("Failed to connect to server");
      console.error("Error fetching payments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Filter payments
  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.job.jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.job.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.job.locksmith?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      filterType === "all" ||
      (filterType === "assessment" && payment.type === "assessment") ||
      (filterType === "quote" && payment.type === "quote");

    const matchesStatus =
      filterStatus === "all" || payment.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3" />
            Succeeded
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "assessment":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Tag className="w-3 h-3" />
            Assessment
          </span>
        );
      case "quote":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            <Briefcase className="w-3 h-3" />
            Work Quote
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {type}
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateDeduction = (payment: Payment) => {
    if (payment.type === "quote" && payment.job.assessmentPaid && payment.job.assessmentFee > 0) {
      return payment.job.assessmentFee;
    }
    return 0;
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Payments</h1>
            <p className="text-sm text-slate-500">Transaction tracking</p>
          </div>
          <Button onClick={fetchPayments} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
            <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
              <div className="flex items-center gap-1 lg:gap-2 text-slate-500 text-xs lg:text-sm mb-1">
                <PoundSterling className="w-3 h-3 lg:w-4 lg:h-4" />
                Revenue
              </div>
              <div className="text-lg lg:text-2xl font-bold text-slate-900">
                £{stats.totalRevenue.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {stats.paymentCount} payments
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
              <div className="flex items-center gap-1 lg:gap-2 text-slate-500 text-xs lg:text-sm mb-1">
                <Tag className="w-3 h-3 lg:w-4 lg:h-4" />
                Assessments
              </div>
              <div className="text-lg lg:text-2xl font-bold text-blue-600">
                £{stats.totalAssessmentFees.toFixed(2)}
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
              <div className="flex items-center gap-1 lg:gap-2 text-slate-500 text-xs lg:text-sm mb-1">
                <Briefcase className="w-3 h-3 lg:w-4 lg:h-4" />
                Work
              </div>
              <div className="text-lg lg:text-2xl font-bold text-purple-600">
                £{stats.totalWorkPayments.toFixed(2)}
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
              <div className="flex items-center gap-1 lg:gap-2 text-slate-500 text-xs lg:text-sm mb-1">
                <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" />
                This Month
              </div>
              <div className="text-lg lg:text-2xl font-bold text-green-600">
                £{stats.thisMonth.toFixed(2)}
              </div>
              {stats.lastMonth > 0 && (
                <div className={`text-xs mt-1 ${stats.thisMonth >= stats.lastMonth ? "text-green-600" : "text-red-600"}`}>
                  {stats.thisMonth >= stats.lastMonth ? "+" : ""}
                  {(((stats.thisMonth - stats.lastMonth) / stats.lastMonth) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by job number, customer, or locksmith..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "all" | "assessment" | "quote")}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
              >
                <option value="all">All Types</option>
                <option value="assessment">Assessment Fees</option>
                <option value="quote">Work Quotes</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "succeeded" | "pending" | "failed")}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="succeeded">Succeeded</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-slate-600">Loading payments...</p>
          </div>
        ) : (
          /* Payments Table */
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Date</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Job</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Customer</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Locksmith</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Type</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">Amount</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">Deduction</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No payments found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment) => {
                      const deduction = calculateDeduction(payment);
                      return (
                        <tr key={payment.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {formatDate(payment.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/jobs?id=${payment.job.id}`}
                              className="font-mono text-sm text-orange-600 hover:underline"
                            >
                              {payment.job.jobNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {payment.job.customer.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {payment.job.locksmith?.name || "-"}
                          </td>
                          <td className="px-4 py-3">
                            {getTypeBadge(payment.type)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-slate-900">
                              £{payment.amount.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {deduction > 0 ? (
                              <span className="text-green-600 font-medium">
                                -£{deduction.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getStatusBadge(payment.status)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {payment.stripePaymentId && (
                              <a
                                href={`https://dashboard.stripe.com/payments/${payment.stripePaymentId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                              >
                                Stripe
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Footer */}
            {filteredPayments.length > 0 && (
              <div className="bg-slate-50 border-t px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  Showing {filteredPayments.length} of {payments.length} payments
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-slate-600">
                    Total: <strong className="text-slate-900">
                      £{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                    </strong>
                  </span>
                  <span className="text-green-600">
                    Deductions: <strong>
                      £{filteredPayments.reduce((sum, p) => sum + calculateDeduction(p), 0).toFixed(2)}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}
