"use client";
import { NotifyNoLocksmithModal } from "@/components/admin/NotifyNoLocksmithModal";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Eye,
  Loader2,
  MapPin,
  PenTool,
  Phone,
  RefreshCw,
  Save,
  Search,
  Send,
  Square,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { extractUkPostcode, isCoordinatePair, normalizeUkPostcode } from "@/lib/location-display";

interface Job {
  id: string;
  jobNumber: string;
  customer: { name: string; phone: string; email?: string | null } | null;
  locksmith: {
    name: string;
    id: string;
    companyName?: string | null;
    phone?: string | null;
  } | null;
  status: string;
  problemType: string;
  propertyType: string;
  address: string;
  postcode: string;
  latitude?: number | null;
  longitude?: number | null;
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
  noLocksmithNotifiedAt?: string | null;
  noLocksmithNotifiedChannels?: string[];
}

interface JobApplication {
  id: string;
  status: string;
  eta?: number | null;
  assessmentFee?: number | null;
  locksmith: {
    id: string;
    name: string;
    company?: string | null;
    rating?: number | null;
    verified?: boolean;
  } | null;
}

interface JobSummary {
  statusCounts: Record<string, number>;
  awaitingSignature: number;
  overdueSignature: number;
  noLocksmithAvailable: number;
}

interface Locksmith {
  id: string;
  name: string;
  companyName?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  baseLat?: number | null;
  baseLng?: number | null;
  distanceMiles?: number | null;
  priorityGroup?: number;
}

const statusColors: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  PENDING: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
  ACCEPTED: { bg: "bg-blue-100", text: "text-blue-700", label: "Accepted" },
  ARRIVED: { bg: "bg-purple-100", text: "text-purple-700", label: "Arrived" },
  DIAGNOSING: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    label: "Diagnosing",
  },
  QUOTED: { bg: "bg-cyan-100", text: "text-cyan-700", label: "Quote Sent" },
  QUOTE_ACCEPTED: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Quote Accepted",
  },
  QUOTE_DECLINED: {
    bg: "bg-red-100",
    text: "text-red-700",
    label: "Quote Declined",
  },
  IN_PROGRESS: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    label: "In Progress",
  },
  PENDING_CUSTOMER_CONFIRMATION: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    label: "Awaiting Signature",
  },
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

const NO_LOCKSMITH_STATUS = "NO_LOCKSMITH_AVAILABLE";

function getDisplayPostcode(job: Pick<Job, "postcode" | "address">): string {
  const rawPostcode = typeof job.postcode === "string" ? job.postcode.trim() : "";
  if (rawPostcode && !isCoordinatePair(rawPostcode)) {
    const normalized = normalizeUkPostcode(rawPostcode);
    if (normalized) return normalized;
  }
  return extractUkPostcode(job.address) || "Postcode missing";
}
const noLocksmithStatusConfig = {
  bg: "bg-rose-100",
  text: "text-rose-700",
  label: "No Locksmith Available",
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
  const { toast, toasts, dismiss } = useToast();

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
  const [availableLocksmiths, setAvailableLocksmiths] = useState<Locksmith[]>(
    [],
  );
  const [isLocksmithsLoading, setIsLocksmithsLoading] = useState(false);
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

  // Notify-no-locksmith modal state
  const [notifyJob, setNotifyJob] = useState<Job | null>(null);
  // Applicants for the job currently open in the assign modal.
  const [modalApplications, setModalApplications] = useState<JobApplication[]>([]);
  const [modalAppsLoading, setModalAppsLoading] = useState(false);

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

  const haversineMiles = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const earthRadiusMiles = 3958.8;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
  };

  const geocodeJobLocation = async (job: Job) => {
    try {
      if (job.latitude != null && job.longitude != null) {
        return { lat: job.latitude, lng: job.longitude };
      }

      const query = `${job.address}, ${job.postcode}`.trim();
      const response = await fetch("/api/admin/geocode-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) return null;

      return {
        lat: Number(data.lat),
        lng: Number(data.lng),
      };
    } catch {
      return null;
    }
  };

  const fetchLocksmiths = async (job: Job) => {
    try {
      setIsLocksmithsLoading(true);
      const response = await fetch("/api/locksmiths");
      const data = await response.json();

      if (data.success && data.locksmiths) {
        const targetLocation = await geocodeJobLocation(job);

        const sorted = (data.locksmiths as Locksmith[])
          .map((ls) => {
            const priorityGroup =
              ls.isActive !== false && ls.isAvailable === true
                ? 0
                : ls.isActive !== false && ls.isAvailable === false
                  ? 1
                  : 2;

            const distanceMiles =
              targetLocation != null &&
              typeof ls.baseLat === "number" &&
              typeof ls.baseLng === "number"
                ? haversineMiles(
                    targetLocation.lat,
                    targetLocation.lng,
                    ls.baseLat,
                    ls.baseLng,
                  )
                : null;

            return {
              ...ls,
              priorityGroup,
              distanceMiles,
            };
          })
          .sort((a, b) => {
            const groupDelta = (a.priorityGroup || 0) - (b.priorityGroup || 0);
            if (groupDelta !== 0) return groupDelta;

            const aDist = a.distanceMiles;
            const bDist = b.distanceMiles;

            if (aDist == null && bDist == null) {
              return a.name.localeCompare(b.name);
            }
            if (aDist == null) return 1;
            if (bDist == null) return -1;

            if (aDist !== bDist) return aDist - bDist;
            return a.name.localeCompare(b.name);
          });

        setAvailableLocksmiths(sorted);
      }
    } catch (error) {
      console.error("Error fetching locksmiths:", error);
      setAvailableLocksmiths([]);
    } finally {
      setIsLocksmithsLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchJobs is stable; intentional re-fetch on filter/page change
  useEffect(() => {
    fetchJobs();
  }, [statusFilter, currentPage]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: debounced search re-runs fetchJobs by design
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on filter/page/search change
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
      if (remaining < 0)
        return { text: "Overdue", color: "text-red-600 bg-red-50" };
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      if (hours < 2)
        return {
          text: `${Math.floor(remaining / 60000)}m`,
          color: "text-red-500 bg-red-50",
        };
      if (hours < 24)
        return { text: `${hours}h`, color: "text-amber-500 bg-amber-50" };
      return {
        text: `${Math.floor(hours / 24)}d`,
        color: "text-green-600 bg-green-50",
      };
    } catch {
      return null;
    }
  };

  const getStatusConfigForJob = (job: Job) => {
    if (job.status === "CANCELLED" && job.noLocksmithNotifiedAt) {
      return noLocksmithStatusConfig;
    }
    return statusColors[job.status] || statusColors.PENDING;
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedJobs.size === jobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(jobs.map((j) => j.id)));
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
      const promises = Array.from(selectedJobs).map((jobId) =>
        fetch(`/api/jobs/${jobId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        }),
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
      status:
        job.status === "CANCELLED" && job.noLocksmithNotifiedAt
          ? NO_LOCKSMITH_STATUS
          : job.status,
      problemType: job.problemType,
      propertyType: job.propertyType,
      postcode: job.postcode,
      address: job.address,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;
    try {
      let statusToPersist = editFormData.status;

      if (editFormData.status === NO_LOCKSMITH_STATUS) {
        const channels: Array<"sms" | "email"> = [];
        if (editingJob.customer?.phone) channels.push("sms");
        if (editingJob.customer?.email) channels.push("email");

        if (channels.length > 0) {
          const notifyResponse = await fetch(
            `/api/admin/jobs/${editingJob.id}/notify-no-locksmith`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ channels }),
            },
          );

          if (!notifyResponse.ok) {
            toast({
              title: "No-locksmith notification failed",
              description:
                "Job will still be moved out of Pending, but notification was not sent.",
              variant: "error",
            });
          }
        }

        statusToPersist = "CANCELLED";
      }

      const response = await fetch(`/api/jobs/${editingJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editFormData,
          status: statusToPersist,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (response.ok) {
        if (editFormData.status === NO_LOCKSMITH_STATUS) {
          toast({
            title: "Job marked: No Locksmith Available",
            description:
              "The job was moved out of Pending and customer notification was attempted.",
          });
        }
        setEditingJob(null);
        fetchJobs();
      } else {
        const message =
          payload?.error || payload?.message || "Failed to update job";
        alert(message);
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
    fetchLocksmiths(job);
    // Load who has applied to this job so the admin can see + pick an applicant.
    setModalApplications([]);
    setModalAppsLoading(true);
    fetch(`/api/jobs/${job.id}/applications`)
      .then((r) => r.json())
      .then((data) => setModalApplications(data.applications || []))
      .catch(() => setModalApplications([]))
      .finally(() => setModalAppsLoading(false));
  };

  const handleAssignLocksmith = async () => {
    if (!assignModalJob || !selectedLocksmithId) return;
    setIsAssigning(true);
    try {
      const response = await fetch(
        `/api/admin/jobs/${assignModalJob.id}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locksmithId: selectedLocksmithId,
          }),
        },
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setAssignModalJob(null);
        setSelectedLocksmithId("");
        fetchJobs();
        alert(
          `Locksmith has been notified and must accept or decline the assignment for job ${assignModalJob.jobNumber}`,
        );
      } else {
        alert(data.error || "Failed to assign locksmith");
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

  const topClosestLocksmiths = availableLocksmiths
    .filter((ls) => ls.distanceMiles != null)
    .slice()
    .sort((a, b) => (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 3);

  const liveDispatchCount =
    (summary?.statusCounts.ACCEPTED || 0) + (summary?.statusCounts.EN_ROUTE || 0);
  const liveOnSiteCount =
    (summary?.statusCounts.ARRIVED || 0) +
    (summary?.statusCounts.DIAGNOSING || 0) +
    (summary?.statusCounts.IN_PROGRESS || 0);

  return (
    <div className="p-4 lg:p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
            Job Management
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-slate-500">{jobs.length} jobs</p>
            {(summary?.noLocksmithAvailable || 0) > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border border-rose-200">
                No locksmith notified: {summary?.noLocksmithAvailable || 0}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchJobs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/admin/jobs/create">
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Create Job</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Live OPS Quick Access */}
      <Link
        href="/admin/ops"
        className="block bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-xl p-4 lg:p-5 mb-4 lg:mb-6 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-xs lg:text-sm font-semibold uppercase tracking-wide text-sky-100">
                Live OPS
              </span>
            </div>
            <h2 className="text-base lg:text-lg font-bold">Dispatch and Coverage Map</h2>
            <p className="text-xs lg:text-sm text-sky-100 mt-1">
              Track active jobs and locksmith movement in real time.
            </p>
          </div>
          <div className="text-right min-w-[112px]">
            <div className="text-2xl font-bold leading-none">{liveDispatchCount}</div>
            <div className="text-xs text-sky-100">En Route / Accepted</div>
            <div className="text-sm font-semibold mt-2">{liveOnSiteCount}</div>
            <div className="text-xs text-sky-100">On Site</div>
          </div>
        </div>
      </Link>

      {/* Summary Cards with Skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-4 lg:mb-6">
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
        </div>
      ) : (
        summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-4 lg:mb-6">
            <button
              type="button"
              onClick={() => setStatusFilter("PENDING_CUSTOMER_CONFIRMATION")}
              className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm text-left hover:shadow-md transition-shadow ${statusFilter === "PENDING_CUSTOMER_CONFIRMATION" ? "ring-2 ring-orange-500" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <PenTool className="w-4 h-4 text-amber-500" />
                <span className="text-xs lg:text-sm text-slate-500">
                  Awaiting Signature
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">
                {summary.awaitingSignature}
              </div>
              {summary.overdueSignature > 0 && (
                <div className="text-xs text-red-600 mt-1">
                  {summary.overdueSignature} overdue
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PENDING")}
              className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm text-left hover:shadow-md transition-shadow ${statusFilter === "PENDING" ? "ring-2 ring-orange-500" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs lg:text-sm text-slate-500">
                  Pending
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">
                {summary.statusCounts.PENDING || 0}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("IN_PROGRESS")}
              className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm text-left hover:shadow-md transition-shadow ${statusFilter === "IN_PROGRESS" ? "ring-2 ring-orange-500" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-xs lg:text-sm text-slate-500">
                  In Progress
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">
                {summary.statusCounts.IN_PROGRESS || 0}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(NO_LOCKSMITH_STATUS)}
              className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm text-left hover:shadow-md transition-shadow ${statusFilter === NO_LOCKSMITH_STATUS ? "ring-2 ring-orange-500" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-rose-500" />
                <span className="text-xs lg:text-sm text-slate-500">
                  No Locksmith
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">
                {summary.noLocksmithAvailable || 0}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`bg-white rounded-xl p-3 lg:p-4 shadow-sm text-left hover:shadow-md transition-shadow ${statusFilter === "all" ? "ring-2 ring-orange-500" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs lg:text-sm text-slate-500">
                  All Jobs
                </span>
              </div>
              <div className="text-xl lg:text-2xl font-bold text-slate-900">
                {Object.values(summary.statusCounts).reduce((a, b) => a + b, 0)}
              </div>
            </button>
          </div>
        )
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
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter jobs by status"
              title="Filter jobs by status"
              className="flex-1 lg:flex-none px-3 lg:px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
            >
              <option value="all">All Statuses</option>
              <option value={NO_LOCKSMITH_STATUS}>No Locksmith Available</option>
              {Object.entries(statusColors).map(([status, { label }]) => (
                <option key={status} value={status}>
                  {label}
                </option>
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
              const displayPostcode = getDisplayPostcode(job);
              const statusConfig = getStatusConfigForJob(job);
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
                        <Link
                          href={`/job/${job.id}/report`}
                          className="font-mono text-sm font-semibold text-orange-600 hover:underline"
                        >
                          {job.jobNumber}
                        </Link>
                        <span
                          className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">
                      {getTimeAgo(job.createdAt)}
                    </span>
                  </div>

                  <div className="text-sm text-slate-600 mb-2">
                    {job.address}, {displayPostcode}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">
                      {job.address}, {job.postcode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-400 mb-0.5">
                        Customer
                      </div>
                      <div className="font-medium text-slate-900 truncate">
                        {job.customer?.name || "-"}
                      </div>
                      {job.customer?.phone && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="w-3 h-3" />
                          {job.customer.phone}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-0.5">
                        Locksmith
                      </div>
                      <div className="font-medium text-slate-900 truncate">
                        {job.locksmith?.name || "Unassigned"}
                      </div>
                      {job.locksmith?.phone && (
                        <div className="mt-1">
                          <WhatsAppButton
                            phone={job.locksmith.phone}
                            message={`Hi ${job.locksmith.name}, regarding job #${job.jobNumber} at ${job.address}, ${displayPostcode} — `}
                            iconOnly
                            size="sm"
                            context={{ targetType: "locksmith", targetId: job.locksmith.id, jobId: job.id }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div className="text-sm">
                      <span className="text-slate-500">Total: </span>
                      <span className="font-bold text-slate-900">
                        {job.quote?.total || (job.locksmith && job.assessmentFee)
                          ? `£${(job.quote?.total || job.assessmentFee || 0).toFixed(2)}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {deadline && (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${deadline.color}`}
                        >
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
                      {job.noLocksmithNotifiedAt ? (
                        <span
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                          title={`Notified ${getTimeAgo(job.noLocksmithNotifiedAt)} via ${(job.noLocksmithNotifiedChannels || []).join(" + ")}`}
                        >
                          ✉ Notified
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setNotifyJob(job)}
                          className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded"
                          title="Notify customer: no locksmith available"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
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
                      <Link
                        href={`/job/${job.id}/report`}
                        className="text-orange-600 text-sm font-medium flex items-center gap-1"
                      >
                        View
                        <Eye className="w-4 h-4" />
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
                        {selectedJobs.size === jobs.length &&
                        jobs.length > 0 ? (
                          <CheckSquare className="w-5 h-5 text-orange-500" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Job
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Customer
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Locksmith
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Location
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Amount
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Created
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map((job) => {
                    const displayPostcode = getDisplayPostcode(job);
                    const statusConfig = getStatusConfigForJob(job);
                    const deadline = getDeadlineStatus(
                      job.confirmationDeadline,
                    );

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
                          <Link
                            href={`/job/${job.id}/report`}
                            className="font-mono text-sm font-semibold text-orange-600 hover:underline"
                          >
                            {job.jobNumber}
                          </Link>
                          <div className="text-xs text-slate-500">
                            {problemLabels[job.problemType] || job.problemType}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">
                            {job.customer?.name || "-"}
                          </div>
                          {job.customer?.phone && (
                            <div className="text-xs text-slate-500">
                              {job.customer.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-900">
                            {job.locksmith?.name || "Unassigned"}
                          </div>
                          {job.locksmith?.companyName && (
                            <div className="text-xs text-slate-500">
                              {job.locksmith.companyName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-600 truncate max-w-[150px]">
                            {job.address}
                          </div>
                          <div className="text-xs text-slate-500">
                            {displayPostcode}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                          >
                            {statusConfig.label}
                          </span>
                          {deadline && (
                            <div
                              className={`mt-1 text-xs font-medium ${deadline.color} px-2 py-0.5 rounded`}
                            >
                              {deadline.text}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-semibold text-slate-900">
                            {job.quote?.total || (job.locksmith && job.assessmentFee)
                              ? `£${(job.quote?.total || job.assessmentFee || 0).toFixed(2)}`
                              : "—"}
                          </div>
                          {job.totalPaid && job.totalPaid > 0 && (
                            <div className="text-xs text-green-600">
                              Paid: £{job.totalPaid.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm text-slate-600">
                            {formatDate(job.createdAt)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {getTimeAgo(job.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {job.locksmith?.phone && (
                              <WhatsAppButton
                                phone={job.locksmith.phone}
                                message={`Hi ${job.locksmith.name}, regarding job #${job.jobNumber} at ${job.address}, ${displayPostcode} — `}
                                iconOnly
                                size="sm"
                                context={{ targetType: "locksmith", targetId: job.locksmith.id, jobId: job.id }}
                              />
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
                            {job.noLocksmithNotifiedAt ? (
                              <span
                                className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                                title={`Notified ${getTimeAgo(job.noLocksmithNotifiedAt)} via ${(job.noLocksmithNotifiedChannels || []).join(" + ")}`}
                              >
                                ✉
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setNotifyJob(job)}
                                className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded"
                                title="Notify customer: no locksmith available"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
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
                            <Link
                              href={`/job/${job.id}/report`}
                              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                            >
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
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingJob(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                Edit Job {editingJob.jobNumber}
              </h3>
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                aria-label="Close edit job modal"
                title="Close"
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, status: e.target.value })
                  }
                  aria-label="Job status"
                  title="Job status"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value={NO_LOCKSMITH_STATUS}>No Locksmith Available</option>
                  {Object.entries(statusColors).map(([status, { label }]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Problem Type
                </label>
                <select
                  value={editFormData.problemType}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      problemType: e.target.value,
                    })
                  }
                  aria-label="Problem type"
                  title="Problem type"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {Object.entries(problemLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Postcode
                </label>
                <input
                  type="text"
                  value={editFormData.postcode}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      postcode: e.target.value,
                    })
                  }
                  title="Postcode"
                  placeholder="Enter postcode"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                <textarea
                  value={editFormData.address}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      address: e.target.value,
                    })
                  }
                  rows={2}
                  title="Address"
                  placeholder="Enter address"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button
                variant="outline"
                onClick={() => setEditingJob(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Locksmith Modal */}
      {assignModalJob && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setAssignModalJob(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 lg:p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Assign Locksmith
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Locksmith will be notified to accept or decline
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalJob(null)}
                aria-label="Close assign locksmith modal"
                title="Close"
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 lg:p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 lg:p-4">
                <div className="text-sm font-semibold text-slate-900 mb-1">
                  {assignModalJob.jobNumber}
                </div>
                <div className="text-xs text-slate-600 mb-1">
                  {problemLabels[assignModalJob.problemType] ||
                    assignModalJob.problemType}
                </div>
                <div className="text-xs text-slate-500">
                  {assignModalJob.address}, {assignModalJob.postcode}
                </div>
                {assignModalJob.customer && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <div className="text-xs text-slate-500">
                      Customer:{" "}
                      <span className="text-slate-700 font-medium">
                        {assignModalJob.customer.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Applicants — who has applied to this job (read-only list + "Use" to pre-select) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Applicants{modalApplications.length > 0 ? ` (${modalApplications.length})` : ""}
                </label>
                {modalAppsLoading ? (
                  <div className="text-sm text-slate-500 py-2">Loading applicants…</div>
                ) : modalApplications.length === 0 ? (
                  <div className="text-sm text-slate-500 py-2">No applications yet.</div>
                ) : (
                  <div className="space-y-1.5">
                    {modalApplications.map((app) => (
                      <div
                        key={app.id}
                        className="rounded-lg border border-slate-200 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {app.locksmith?.name || "Unknown"}
                            {app.locksmith?.verified && (
                              <span className="ml-1 text-xs text-green-600">✓</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {app.locksmith?.company || ""}
                            {app.eta != null ? ` · ETA ${app.eta}m` : ""}
                            {app.assessmentFee != null ? ` · £${app.assessmentFee}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              app.status === "accepted"
                                ? "bg-green-100 text-green-700"
                                : app.status === "admin_assigned"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {app.status}
                          </span>
                          {app.locksmith?.id && (
                            <button
                              type="button"
                              onClick={() => setSelectedLocksmithId(app.locksmith!.id)}
                              className="text-xs font-medium text-blue-600 hover:underline"
                            >
                              Use
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Locksmith
                </label>
                {isLocksmithsLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-10 h-10 text-slate-300 mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-slate-500">Finding closest locksmiths...</p>
                  </div>
                ) : availableLocksmiths.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">
                      No locksmiths found
                    </p>
                  </div>
                ) : (
                  <>
                    {topClosestLocksmiths.length > 0 && (
                      <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Top 3 Closest Locksmiths
                        </div>
                        <div className="space-y-1.5">
                          {topClosestLocksmiths.map((ls, index) => {
                            const status = ls.isActive !== false
                              ? (ls.isAvailable ? "Available" : "Unavailable")
                              : "Other";

                            const statusClass = status === "Available"
                              ? "text-emerald-700"
                              : status === "Unavailable"
                                ? "text-amber-700"
                                : "text-slate-600";

                            return (
                              <div key={ls.id} className="flex items-center justify-between text-xs">
                                <div className="text-slate-700">
                                  <span className="font-semibold text-slate-900">#{index + 1}</span> {ls.name}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={statusClass}>{status}</span>
                                  <span className="font-medium text-slate-900">{(ls.distanceMiles ?? 0).toFixed(1)} mi</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mb-2">
                      Sorted by nearest distance in this order: Available, Unavailable, then Other locksmiths.
                    </div>
                    <select
                      value={selectedLocksmithId}
                      onChange={(e) => setSelectedLocksmithId(e.target.value)}
                      aria-label="Select locksmith"
                      title="Select locksmith"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                    >
                      <option value="">Choose a locksmith...</option>
                      <optgroup label="Available">
                        {availableLocksmiths
                          .filter((ls) => ls.priorityGroup === 0)
                          .map((ls) => (
                            <option key={ls.id} value={ls.id}>
                              {ls.name}
                              {ls.companyName ? ` (${ls.companyName})` : ""}
                              {ls.distanceMiles != null
                                ? ` - ${ls.distanceMiles.toFixed(1)} mi`
                                : " - distance n/a"}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Unavailable">
                        {availableLocksmiths
                          .filter((ls) => ls.priorityGroup === 1)
                          .map((ls) => (
                            <option key={ls.id} value={ls.id}>
                              {ls.name}
                              {ls.companyName ? ` (${ls.companyName})` : ""}
                              {ls.distanceMiles != null
                                ? ` - ${ls.distanceMiles.toFixed(1)} mi`
                                : " - distance n/a"}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Other Locksmiths">
                        {availableLocksmiths
                          .filter((ls) => ls.priorityGroup === 2)
                          .map((ls) => (
                            <option key={ls.id} value={ls.id}>
                              {ls.name}
                              {ls.companyName ? ` (${ls.companyName})` : ""}
                              {ls.distanceMiles != null
                                ? ` - ${ls.distanceMiles.toFixed(1)} mi`
                                : " - distance n/a"}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </>
                )}
              </div>

              {selectedLocksmithId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-800">
                      <p className="font-medium mb-1">Assignment Process:</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                        <li>
                          Locksmith receives notification (SMS, email, push)
                        </li>
                        <li>They must accept or decline the assignment</li>
                        <li>If accepted, customer gets payment link</li>
                        <li>Job proceeds once payment is received</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 lg:p-6 border-t flex gap-3">
              <Button
                variant="outline"
                onClick={() => setAssignModalJob(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignLocksmith}
                disabled={!selectedLocksmithId || isAssigning}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Assign Job
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteJobId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteJobId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Delete Job
              </h3>
              <button
                type="button"
                onClick={() => setDeleteJobId(null)}
                aria-label="Close delete job modal"
                title="Close"
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium mb-2">
                  Are you sure you want to delete this job?
                </p>
                <p className="text-sm text-red-600">
                  This action will permanently delete the job and all associated
                  data including quotes, photos, signatures, and payments. This
                  cannot be undone.
                </p>
              </div>
              <div className="text-sm text-slate-600">
                <p>
                  Job ID:{" "}
                  <span className="font-mono text-slate-900">
                    {deleteJobId}
                  </span>
                </p>
                {jobs.find((j) => j.id === deleteJobId)?.jobNumber && (
                  <p>
                    Job Number:{" "}
                    <span className="font-semibold text-slate-900">
                      {jobs.find((j) => j.id === deleteJobId)?.jobNumber}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteJobId(null)}
                className="flex-1"
              >
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

      {/* Notify-No-Locksmith Modal */}
      <NotifyNoLocksmithModal
        job={
          notifyJob
            ? {
                id: notifyJob.id,
                jobNumber: notifyJob.jobNumber,
                postcode: notifyJob.postcode,
                problemType: notifyJob.problemType,
                customer: notifyJob.customer
                  ? {
                      name: notifyJob.customer.name,
                      phone: notifyJob.customer.phone,
                      email: notifyJob.customer.email ?? null,
                    }
                  : null,
              }
            : null
        }
        onClose={() => setNotifyJob(null)}
        onSent={() => fetchJobs()}
        toast={toast}
      />

      {/* Toast Notifications */}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function AdminJobsLoading() {
  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
            Job Management
          </h1>
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
