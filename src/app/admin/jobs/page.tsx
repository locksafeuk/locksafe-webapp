"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  Search,
  MapPin,
  Clock,
  Phone,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  PenTool,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Trash2,
  UserPlus,
  Edit,
  X,
  Save,
} from "lucide-react";

interface Job {
  id: string;
  jobNumber: string;
  customer: { name: string; phone: string; email?: string | null } | null;
  locksmith: { name: string; id: string; companyName?: string | null } | null;
  status: string;
  problemType: string;
  propertyType: string;
  address: string;
  postcode: string;
  assessmentFee: number | null;
  quote: { total: number } | null;
  createdAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  workCompletedAt?: string;
  signedAt?: string;
  confirmationDeadline?: string | null;
  confirmationRemindersSent?: number;
  totalPaid?: number;
}

interface JobSummary {
  statusCounts: Record<string, number>;
  awaitingSignature: number;
  overdueSignature: number;
}

interface Locksmith {
  id: string;
  name: string;
  companyName?: string;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
  ACCEPTED: { bg: "bg-blue-100", text: "text-blue-700", label: "Accepted" },
  ARRIVED: { bg: "bg-purple-100", text: "text-purple-700", label: "Arrived" },
  DIAGNOSING: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Diagnosing" },
  QUOTED: { bg: "bg-cyan-100", text: "text-cyan-700", label: "Quote Sent" },
  QUOTE_ACCEPTED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Quote Accepted" },
  QUOTE_DECLINED: { bg: "bg-red-100", text: "text-red-700", label: "Quote Declined" },
  IN_PROGRESS: { bg: "bg-orange-100", text: "text-orange-700", label: "In Progress" },
  PENDING_CUSTOMER_CONFIRMATION: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Awaiting Signature" },
  COMPLETED: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
  SIGNED: { bg: "bg-green-200", text: "text-green-800", label: "Signed" },
  CANCELLED: { bg: "bg-slate-100", text: "text-slate-700", label: "Cancelled" },
};

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other",
};

// Skeleton loading component
function JobSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-16 bg-slate-200 rounded" />
        </div>
        <div className="h-5 w-5 bg-slate-200 rounded" />
      </div>
      <div className="h-3 w-32 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-48 bg-slate-200 rounded mb-3" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-12 bg-slate-100 rounded" />
        <div className="h-12 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-slate-200 rounded" />
        <div className="h-3 w-24 bg-slate-200 rounded" />
      </div>
      <div className="h-8 w-12 bg-slate-200 rounded" />
    </div>
  );
}

function AdminJobsContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "all";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<JobSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const jobsPerPage = 20;

  // Bulk selection state
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // Edit modal state
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [assignModalJob, setAssignModalJob] = useState<Job | null>(null);
  const [availableLocksmiths, setAvailableLocksmiths] = useState<Locksmith[]>([]);
  const [selectedLocksmithId, setSelectedLocksmithId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [editFormData, setEditFormData] = useState({
    status: "",
    problemType: "",
    propertyType: "",
    postcode: "",
    address: "",
  });

  // Delete modal state
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", jobsPerPage.toString());
      params.set("page", currentPage.toString());

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const response = await fetch(`/api/admin/jobs?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setJobs(data.jobs || []);
        setSummary(data.summary || null);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocksmiths = async () => {
    try {
      const response = await fetch("/api/locksmiths?available=true");
      const data = await response.json();
      if (data.success && data.locksmiths) {
        setAvailableLocksmiths(data.locksmiths);
      }
    } catch (error) {
      console.error("Error fetching locksmiths:", error);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter, currentPage]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery !== "") {
        setCurrentPage(1);
        fetchJobs();
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Clear selection when changing filters
  useEffect(() => {
    setSelectedJobs(new Set());
  }, [statusFilter, currentPage, searchQuery]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid date";
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      const diff = Date.now() - new Date(dateString).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    } catch {
      return "Unknown";
    }
  };

  const getDeadlineStatus = (deadline: string | null | undefined) => {
    if (!deadline) return null;
    try {
      const remaining = new Date(deadline).getTime() - Date.now();
      if (remaining < 0) return { text: "Overdue", color: "text-red-600 bg-red-50" };
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      if (hours < 2) return { text: `${Math.floor(remaining / 60000)}m`, color: "text-red-500 bg-red-50" };
      if (hours < 24) return { text: `${hours}h`, color: "text-amber-500 bg-amber-50" };
      return { text: `${Math.floor(hours / 24)}d`, color: "text-green-600 bg-green-50" };
    } catch {
      return null;
    }
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedJobs.size === jobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(jobs.map(j => j.id)));
    }
  };

  const toggleSelectJob = (jobId: string) => {
    const newSelection = new Set(selectedJobs);
    if (newSelection.has(jobId)) {
      newSelection.delete(jobId);
    } else {
      newSelection.add(jobId);
    }
    setSelectedJobs(newSelection);
  };

  // Bulk actions
  const handleBulkCancel = async () => {
    if (!confirm(`Cancel ${selectedJobs.size} selected jobs?`)) return;
    setIsProcessingBulk(true);
    try {
      const promises = Array.from(selectedJobs).map(jobId =>
        fetch(`/api/jobs/${jobId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        })
      );
      await Promise.all(promises);
      setSelectedJobs(new Set());
      fetchJobs();
    } catch (error) {
      console.error("Bulk cancel error:", error);
      alert("Failed to cancel some jobs");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Edit job handler
  const handleOpenEditModal = (job: Job) => {
    setEditingJob(job);
    setEditFormData({
      status: job.status,
      problemType: job.problemType,
      propertyType: job.propertyType,
      postcode: job.postcode,
      address: job.address,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;
    try {
      const response = await fetch(`/api/jobs/${editingJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      if (response.ok) {
        setEditingJob(null);
        fetchJobs();
      } else {
        alert("Failed to update job");
      }
    } catch (error) {
      console.error("Error updating job:", error);
      alert("Failed to update job");
    }
  };

  // Assign locksmith handler
  const handleOpenAssignModal = (job: Job) => {
    setAssignModalJob(job);
    setSelectedLocksmithId(job.locksmith?.id || "");
    fetchLocksmiths();
  };

  const handleAssignLocksmith = async () => {
    if (!assignModalJob || !selectedLocksmithId) return;
    setIsAssigning(true);
    try {
      const response = await fetch(`/api/jobs/${assignModalJob.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ACCEPTED",
          locksmithId: selectedLocksmithId,
        }),
      });
      if (response.ok) {
        setAssignModalJob(null);
        fetchJobs();
      } else {
        alert("Failed to assign locksmith");
      }
    } catch (error) {
      console.error("Error assigning locksmith:", error);
      alert("Failed to assign locksmith");
    } finally {
      setIsAssigning(false);
    }
  };

  // Delete job handler
  const handleDeleteJob = async (jobId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/jobs/${jobId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setDeleteJobId(null);
        fetchJobs();
      } else {
        alert(data.error || "Failed to delete job");
      }
    } catch (error) {
      console.error("Error deleting job:", error);
      alert("Failed to delete job");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Job Management</h1>
          <p className="text-sm text-slate-500">{jobs.length} jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchJobs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/admin/jobs/create">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
              <UserPlus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Create Job</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards with Skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING_CUSTOMER_CONFIRMATION")}
            className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm text-left hover:shadow-md transition-shadow ${statusFilter === "PENDING_CUSTOMER_CONFIRMATION" ? "ring-2 ring-orange-500" : ""}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <PenTool className="w-4 h-4 text-amber-500" />
              <span className="text-xs lg:text-sm text-slate-500">Awaiting Signature</span>
            </div>
            <div className="text-xl lg:text-2xl font-bold text-slate-900">{summary.awaitingSignature}</div>
            {summary.overdueSignature > 0 && (
              <div className="text-xs text-red-600 mt-1">{summary.overdueSignature} overdue</div>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm text-left hover:shadow-md transition-shadow ${statusFilter === "PENDING" ? "ring-2 ring-orange-500" : ""}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs lg:text-sm text-slate-500">Pending</span>
            </div>
            <div className="text-xl lg:text-2xl font-bold text-slate-900">{summary.statusCounts.PENDING || 0}</div>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("IN_PROGRESS")}
            className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm text-left hover:shadow-md transition-shadow ${statusFilter === "IN_PROGRESS" ? "ring-2 ring-orange-500" : ""}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="text-xs lg:text-sm text-slate-500">In Progress</span>
            </div>
            <div className="text-xl lg:text-2xl font-bold text-slate-900">{summary.statusCounts.IN_PROGRESS || 0}</div>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm text-left hover:shadow-md transition-shadow ${statusFilter === "all" ? "ring-2 ring-orange-500" : ""}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs lg:text-sm text-slate-500">All Jobs</span>
            </div>
            <div className="text-xl lg:text-2xl font-bold text-slate-900">
              {Object.values(summary.statusCounts).reduce((a, b) => a + b, 0)}
            </div>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-3 lg:p-4 mb-4 lg:mb-6">
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search job, customer, postcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 lg:pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="flex-1 lg:flex-none px-3 lg:px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
            >
              <option value="all">All Statuses</option>
              {Object.entries(statusColors).map(([status, { label }]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedJobs.size > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-orange-800">
            {selectedJobs.size} job{selectedJobs.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedJobs(new Set())}
              className="text-slate-600"
            >
              Clear Selection
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkCancel}
              disabled={isProcessingBulk}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              {isProcessingBulk ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1" />
              )}
              Cancel Selected
            </Button>
          </div>
        </div>
      )}

      {/* Loading State with Skeletons */}
      {loading ? (
        <div className="space-y-3">
          <JobSkeleton />
          <JobSkeleton />
          <JobSkeleton />
          <JobSkeleton />
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No jobs found</p>
          <p className="text-slate-500 text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          {/* Jobs List - Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {jobs.map((job) => {
              const statusConfig = statusColors[job.status] || statusColors.PENDING;
              const deadline = getDeadlineStatus(job.confirmationDeadline);

              return (
                <div key={job.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelectJob(job.id)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        {selectedJobs.has(job.id) ? (
                          <CheckSquare className="w-5 h-5 text-orange-500" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </button>
                      <div>
                        <Link href={`/job/${job.id}/report`} className="font-mono text-sm font-semibold text-orange-600 hover:underline">
                          {job.jobNumber}
                        </Link>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{getTimeAgo(job.createdAt)}</span>
                  </div>

                  <div className="text-sm text-slate-600 mb-2">
                    {problemLabels[job.problemType] || job.problemType}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{job.address}, {job.postcode}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-400 mb-0.5">Customer</div>
                      <div className="font-medium text-slate-900 truncate">{job.customer?.name || "-"}</div>
                      {job.customer?.phone && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="w-3 h-3" />{job.customer.phone}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-0.5">Locksmith</div>
                      <div className="font-medium text-slate-900 truncate">{job.locksmith?.name || "Unassigned"}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div className="text-sm">
                      <span className="text-slate-500">Total: </span>
                      <span className="font-bold text-slate-900">
                        £{(job.quote?.total || job.assessmentFee || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {deadline && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${deadline.color}`}>
                          {deadline.text}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(job)}
                        className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded"
                        title="Edit job"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAssignModal(job)}
                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                        title="Assign locksmith"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteJobId(job.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                        title="Delete job"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link href={`/job/${job.id}/report`} className="text-orange-600 text-sm font-medium flex items-center gap-1">
                        View<Eye className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Jobs Table - Desktop */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 w-10">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        {selectedJobs.size === jobs.length && jobs.length > 0 ? (
                          <CheckSquare className="w-5 h-5 text-orange-500" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Job</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Locksmith</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Location</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map((job) => {
                    const statusConfig = statusColors[job.status] || statusColors.PENDING;
                    const deadline = getDeadlineStatus(job.confirmationDeadline);

                    return (
                      <tr key={job.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectJob(job.id)}
                            className="p-1 hover:bg-slate-200 rounded"
                          >
                            {selectedJobs.has(job.id) ? (
                              <CheckSquare className="w-5 h-5 text-orange-500" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/job/${job.id}/report`} className="font-mono text-sm font-semibold text-orange-600 hover:underline">
                            {job.jobNumber}
                          </Link>
                          <div className="text-xs text-slate-500">{problemLabels[job.problemType] || job.problemType}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">{job.customer?.name || "-"}</div>
                          {job.customer?.phone && (
                            <div className="text-xs text-slate-500">{job.customer.phone}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-900">{job.locksmith?.name || "Unassigned"}</div>
                          {job.locksmith?.companyName && (
                            <div className="text-xs text-slate-500">{job.locksmith.companyName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-600 truncate max-w-[150px]">{job.address}</div>
                          <div className="text-xs text-slate-500">{job.postcode}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                            {statusConfig.label}
                          </span>
                          {deadline && (
                            <div className={`mt-1 text-xs font-medium ${deadline.color} px-2 py-0.5 rounded`}>
                              {deadline.text}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-slate-900">
                            £{(job.quote?.total || job.assessmentFee || 0).toFixed(2)}
                          </div>
                          {job.totalPaid && job.totalPaid > 0 && (
                            <div className="text-xs text-green-600">Paid: £{job.totalPaid.toFixed(2)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm text-slate-600">{formatDate(job.createdAt)}</div>
                          <div className="text-xs text-slate-400">{getTimeAgo(job.createdAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(job)}
                              className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded"
                              title="Edit job"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(job)}
                              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                              title="Assign locksmith"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteJobId(job.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                              title="Delete job"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <Link href={`/job/${job.id}/report`} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded">
                              <Eye className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 lg:mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />Previous
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
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingJob(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Edit Job {editingJob.jobNumber}</h3>
              <button type="button" onClick={() => setEditingJob(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {Object.entries(statusColors).map(([status, { label }]) => (
                    <option key={status} value={status}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Problem Type</label>
                <select
                  value={editFormData.problemType}
                  onChange={(e) => setEditFormData({ ...editFormData, problemType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {Object.entries(problemLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Postcode</label>
                <input
                  type="text"
                  value={editFormData.postcode}
                  onChange={(e) => setEditFormData({ ...editFormData, postcode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button variant="outline" onClick={() => setEditingJob(null)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Locksmith Modal */}
      {assignModalJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAssignModalJob(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Assign Locksmith</h3>
              <button type="button" onClick={() => setAssignModalJob(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <div className="text-sm font-medium text-slate-900">{assignModalJob.jobNumber}</div>
                <div className="text-xs text-slate-500">{assignModalJob.address}, {assignModalJob.postcode}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Locksmith</label>
                {availableLocksmiths.length === 0 ? (
                  <p className="text-sm text-slate-500">No available locksmiths found</p>
                ) : (
                  <select
                    value={selectedLocksmithId}
                    onChange={(e) => setSelectedLocksmithId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="">Select a locksmith...</option>
                    {availableLocksmiths.map((ls) => (
                      <option key={ls.id} value={ls.id}>
                        {ls.name} {ls.companyName ? `(${ls.companyName})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button variant="outline" onClick={() => setAssignModalJob(null)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleAssignLocksmith}
                disabled={!selectedLocksmithId || isAssigning}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                {isAssigning ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteJobId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteJobId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Delete Job
              </h3>
              <button type="button" onClick={() => setDeleteJobId(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium mb-2">
                  Are you sure you want to delete this job?
                </p>
                <p className="text-sm text-red-600">
                  This action will permanently delete the job and all associated data including quotes, photos, signatures, and payments. This cannot be undone.
                </p>
              </div>
              <div className="text-sm text-slate-600">
                <p>Job ID: <span className="font-mono text-slate-900">{deleteJobId}</span></p>
                {jobs.find(j => j.id === deleteJobId)?.jobNumber && (
                  <p>Job Number: <span className="font-semibold text-slate-900">{jobs.find(j => j.id === deleteJobId)?.jobNumber}</span></p>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button variant="outline" onClick={() => setDeleteJobId(null)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={() => handleDeleteJob(deleteJobId)}
                disabled={isDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminJobsLoading() {
  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Job Management</h1>
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
      </div>
      <div className="space-y-3">
        <JobSkeleton />
        <JobSkeleton />
        <JobSkeleton />
      </div>
    </div>
  );
}

export default function AdminJobsPage() {
  return (
    <AdminSidebar>
      <Suspense fallback={<AdminJobsLoading />}>
        <AdminJobsContent />
      </Suspense>
    </AdminSidebar>
  );
}
