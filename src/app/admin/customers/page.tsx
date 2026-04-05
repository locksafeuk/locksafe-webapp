"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  Search,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  User,
  UserCheck,
  Users,
  CreditCard,
  Calendar,
  Briefcase,
  Star,
  TrendingUp,
  Clock,
  Filter,
  Download,
  ExternalLink,
  Trash2,
  X,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  emailVerified: boolean;
  hasAccount: boolean;
  hasStripe: boolean;
  createdVia: string;
  createdAt: string;
  updatedAt: string;
  jobCount: number;
  reviewCount: number;
  lastJob: {
    id: string;
    jobNumber: string;
    status: string;
    createdAt: string;
  } | null;
}

interface CustomerStats {
  total: number;
  verified: number;
  withAccount: number;
  thisMonth: number;
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  emailVerified: boolean;
  hasAccount: boolean;
  hasStripe: boolean;
  stripeCustomerId: string | null;
  createdVia: string;
  createdAt: string;
  updatedAt: string;
  jobs: Array<{
    id: string;
    jobNumber: string;
    status: string;
    problemType: string;
    propertyType: string;
    address: string;
    postcode: string;
    assessmentFee: number;
    quoteTotal: number | null;
    quoteAccepted: boolean;
    locksmith: { id: string; name: string } | null;
    createdAt: string;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    locksmith: { id: string; name: string };
    createdAt: string;
  }>;
  stats: {
    totalJobs: number;
    completedJobs: number;
    totalSpent: number;
    totalReviews: number;
    avgRating: number | null;
  };
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;

  // Delete state
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", itemsPerPage.toString());

      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter === "verified") params.set("verified", "true");
      if (statusFilter === "unverified") params.set("verified", "false");
      if (statusFilter === "hasAccount") params.set("hasAccount", "true");
      if (statusFilter === "guest") params.set("hasAccount", "false");
      if (sourceFilter !== "all") params.set("source", sourceFilter);

      const response = await fetch(`/api/admin/customers?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setCustomers(data.customers || []);
        setStats(data.stats || null);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, sourceFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchCustomerDetail = async (customerId: string) => {
    try {
      setDetailLoading(true);
      const response = await fetch(`/api/admin/customers/${customerId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedCustomer(data.customer);
      }
    } catch (error) {
      console.error("Error fetching customer detail:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Delete customer handler
  const handleDeleteCustomer = async (customerId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setDeleteCustomerId(null);
        setSelectedCustomer(null);
        fetchCustomers();
      } else {
        alert(data.error || "Failed to delete customer");
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      alert("Failed to delete customer");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
      ACCEPTED: { bg: "bg-blue-100", text: "text-blue-700", label: "Accepted" },
      EN_ROUTE: { bg: "bg-blue-100", text: "text-blue-700", label: "En Route" },
      ARRIVED: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Arrived" },
      DIAGNOSING: { bg: "bg-purple-100", text: "text-purple-700", label: "Diagnosing" },
      QUOTED: { bg: "bg-orange-100", text: "text-orange-700", label: "Quoted" },
      QUOTE_ACCEPTED: { bg: "bg-green-100", text: "text-green-700", label: "Quote Accepted" },
      QUOTE_DECLINED: { bg: "bg-red-100", text: "text-red-700", label: "Quote Declined" },
      IN_PROGRESS: { bg: "bg-blue-100", text: "text-blue-700", label: "In Progress" },
      PENDING_CUSTOMER_CONFIRMATION: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Awaiting Signature" },
      COMPLETED: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
      SIGNED: { bg: "bg-green-100", text: "text-green-700", label: "Signed" },
      CANCELLED: { bg: "bg-slate-100", text: "text-slate-700", label: "Cancelled" },
    };
    const config = statusConfig[status] || { bg: "bg-slate-100", text: "text-slate-700", label: status };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "phone":
        return <Phone className="w-4 h-4 text-blue-500" />;
      case "app":
        return <User className="w-4 h-4 text-purple-500" />;
      default:
        return <Users className="w-4 h-4 text-orange-500" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Customer Management</h1>
            <p className="text-sm text-slate-500">{total} registered customers</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchCustomers}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs lg:text-sm text-slate-500">Total Customers</span>
            </div>
            <div className="text-xl lg:text-2xl font-bold text-slate-900">{stats?.total || 0}</div>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-green-500" />
              <span className="text-xs lg:text-sm text-slate-500">Verified</span>
            </div>
            <div className="text-xl lg:text-2xl font-bold text-green-600">{stats?.verified || 0}</div>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-blue-500" />
              <span className="text-xs lg:text-sm text-slate-500">With Account</span>
            </div>
            <div className="text-xl lg:text-2xl font-bold text-blue-600">{stats?.withAccount || 0}</div>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <span className="text-xs lg:text-sm text-slate-500">This Month</span>
            </div>
            <div className="text-xl lg:text-2xl font-bold text-orange-600">{stats?.thisMonth || 0}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-3 lg:p-4 mb-4 lg:mb-6 border border-slate-100">
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 lg:pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 lg:flex-none px-3 lg:px-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
              >
                <option value="all">All Customers</option>
                <option value="verified">Email Verified</option>
                <option value="unverified">Email Unverified</option>
                <option value="hasAccount">With Account</option>
                <option value="guest">Guest Only</option>
              </select>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 lg:flex-none px-3 lg:px-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
              >
                <option value="all">All Sources</option>
                <option value="web">Web</option>
                <option value="phone">Phone</option>
                <option value="app">App</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">No customers found</h3>
              <p className="text-slate-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Customer
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Contact
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Jobs
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Source
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Last Job
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Joined
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => fetchCustomerDetail(customer.id)}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {getInitials(customer.name)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{customer.name}</div>
                              {customer.hasAccount && (
                                <span className="text-xs text-blue-600">Registered Account</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            {customer.email && (
                              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                <span className="truncate max-w-[160px]">{customer.email}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {customer.phone}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            {customer.emailVerified ? (
                              <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                Unverified
                              </span>
                            )}
                            {customer.hasStripe && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <CreditCard className="w-3 h-3" />
                                Stripe
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-900">{customer.jobCount}</span>
                          </div>
                          {customer.reviewCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {customer.reviewCount} reviews
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {getSourceIcon(customer.createdVia)}
                            <span className="text-sm text-slate-600 capitalize">{customer.createdVia}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {customer.lastJob ? (
                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                #{customer.lastJob.jobNumber}
                              </div>
                              <div className="mt-0.5">
                                {getStatusBadge(customer.lastJob.status)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">No jobs</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-slate-600">{formatDate(customer.createdAt)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden divide-y divide-slate-100">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => fetchCustomerDetail(customer.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {getInitials(customer.name)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{customer.name}</div>
                          <div className="text-sm text-slate-500">{customer.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {getSourceIcon(customer.createdVia)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {customer.emailVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                          <AlertCircle className="w-3 h-3" />
                          Unverified
                        </span>
                      )}
                      {customer.hasAccount && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                          Account
                        </span>
                      )}
                      {customer.hasStripe && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                          Stripe
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Briefcase className="w-4 h-4 text-slate-400" />
                          <span>{customer.jobCount} jobs</span>
                        </div>
                        {customer.reviewCount > 0 && (
                          <div className="flex items-center gap-1 text-slate-600">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            <span>{customer.reviewCount}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-slate-500">{formatDate(customer.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {customers.length > 0 && (
            <div className="px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-slate-500">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, total)} of {total} customers
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-3 py-1 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Customer Detail Modal */}
        {(selectedCustomer || detailLoading) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : selectedCustomer ? (
                <>
                  {/* Modal Header */}
                  <div className="p-6 border-b sticky top-0 bg-white z-10">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-slate-400 to-slate-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                          {getInitials(selectedCustomer.name)}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">{selectedCustomer.name}</h2>
                          <div className="text-slate-500">
                            Customer since {formatDate(selectedCustomer.createdAt)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedCustomer(null)}
                        className="p-2 hover:bg-slate-100 rounded-full"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2">
                      {selectedCustomer.emailVerified ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Email Verified
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> Email Unverified
                        </span>
                      )}
                      {selectedCustomer.hasAccount && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                          <User className="w-4 h-4" /> Registered Account
                        </span>
                      )}
                      {selectedCustomer.hasStripe && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-1">
                          <CreditCard className="w-4 h-4" /> Stripe Connected
                        </span>
                      )}
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium flex items-center gap-1 capitalize">
                        {getSourceIcon(selectedCustomer.createdVia)}
                        {selectedCustomer.createdVia}
                      </span>
                    </div>

                    {/* Contact Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-500">Email</span>
                        </div>
                        <div className="font-medium">{selectedCustomer.email || "Not provided"}</div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-500">Phone</span>
                        </div>
                        <div className="font-medium">{selectedCustomer.phone}</div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <div className="text-2xl font-bold text-slate-900">
                          {selectedCustomer.stats.totalJobs}
                        </div>
                        <div className="text-sm text-slate-500">Total Jobs</div>
                      </div>
                      <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedCustomer.stats.completedJobs}
                        </div>
                        <div className="text-sm text-slate-500">Completed</div>
                      </div>
                      <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <div className="text-2xl font-bold text-orange-600">
                          £{selectedCustomer.stats.totalSpent.toLocaleString()}
                        </div>
                        <div className="text-sm text-slate-500">Total Spent</div>
                      </div>
                      <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <div className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-1">
                          {selectedCustomer.stats.avgRating ? (
                            <>
                              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                              {selectedCustomer.stats.avgRating.toFixed(1)}
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div className="text-sm text-slate-500">Avg Rating</div>
                      </div>
                    </div>

                    {/* Recent Jobs */}
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-slate-400" />
                        Jobs History ({selectedCustomer.jobs.length})
                      </h3>
                      {selectedCustomer.jobs.length > 0 ? (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {selectedCustomer.jobs.map((job) => (
                            <div
                              key={job.id}
                              className="p-3 bg-slate-50 rounded-lg flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-900">#{job.jobNumber}</span>
                                  {getStatusBadge(job.status)}
                                </div>
                                <div className="text-sm text-slate-500 mt-0.5">
                                  {job.problemType} • {job.propertyType} • {job.postcode}
                                </div>
                                {job.locksmith && (
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    Assigned to: {job.locksmith.name}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {job.quoteAccepted && job.quoteTotal
                                    ? `£${job.quoteTotal.toFixed(2)}`
                                    : `£${job.assessmentFee.toFixed(2)}`}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {formatDate(job.createdAt)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          No jobs yet
                        </div>
                      )}
                    </div>

                    {/* Reviews Given */}
                    {selectedCustomer.reviews.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <Star className="w-5 h-5 text-amber-400" />
                          Reviews Given ({selectedCustomer.reviews.length})
                        </h3>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto">
                          {selectedCustomer.reviews.map((review) => (
                            <div key={review.id} className="p-3 bg-slate-50 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`w-4 h-4 ${
                                          star <= review.rating
                                            ? "fill-amber-400 text-amber-400"
                                            : "text-slate-300"
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-sm text-slate-500">
                                    for {review.locksmith.name}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-400">
                                  {formatDate(review.createdAt)}
                                </span>
                              </div>
                              {review.comment && (
                                <p className="text-sm text-slate-600">"{review.comment}"</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 border-t bg-slate-50 flex flex-wrap gap-3">
                    {selectedCustomer.jobs.length > 0 && (
                      <Link href={`/admin/jobs?customerId=${selectedCustomer.id}`}>
                        <Button variant="outline">
                          <Eye className="w-4 h-4 mr-2" />
                          View All Jobs
                        </Button>
                      </Link>
                    )}
                    {selectedCustomer.stripeCustomerId && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          window.open(
                            `https://dashboard.stripe.com/customers/${selectedCustomer.stripeCustomerId}`,
                            "_blank"
                          )
                        }
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Stripe Dashboard
                      </Button>
                    )}
                    {!selectedCustomer.emailVerified && (
                      <Button className="bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Mark as Verified
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                      onClick={() => setDeleteCustomerId(selectedCustomer.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteCustomerId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setDeleteCustomerId(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Delete Customer
                </h3>
                <button type="button" onClick={() => setDeleteCustomerId(null)} className="p-1 hover:bg-slate-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800 font-medium mb-2">
                    Are you sure you want to delete this customer?
                  </p>
                  <p className="text-sm text-red-600">
                    This action will permanently delete the customer account and ALL associated data including jobs, payments, quotes, and reviews. This cannot be undone.
                  </p>
                </div>
                {selectedCustomer && selectedCustomer.id === deleteCustomerId && (
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>Name: <span className="font-semibold text-slate-900">{selectedCustomer.name}</span></p>
                    <p>Email: <span className="font-semibold text-slate-900">{selectedCustomer.email || "Not provided"}</span></p>
                    <p>Jobs: <span className="font-semibold text-slate-900">{selectedCustomer.stats.totalJobs}</span></p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t flex gap-3">
                <Button variant="outline" onClick={() => setDeleteCustomerId(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteCustomer(deleteCustomerId)}
                  disabled={isDeleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  {isDeleting ? "Deleting..." : "Delete Customer"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}
