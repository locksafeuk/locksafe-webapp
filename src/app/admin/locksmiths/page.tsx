"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  Search,
  Star,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Shield,
  AlertCircle,
  Eye,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Ban,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  Map,
  List,
  Camera,
  Upload,
  User,
  FileText,
  FileCheck,
  Building2,
  BadgeCheck,
  Calendar,
  Clock,
  Download,
  FileImage,
  Trash2,
  X,
  Send,
} from "lucide-react";
import Image from "next/image";

// Dynamically import AdminCoverageMap to avoid SSR issues with Leaflet
const AdminCoverageMap = dynamic(
  () => import("@/components/maps/CoverageMap").then((mod) => mod.AdminCoverageMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] bg-slate-100 rounded-xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    ),
  }
);

interface Locksmith {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  avatar: string;
  profileImage: string | null;
  rating: number;
  reviewCount: number;
  totalJobs: number;
  totalEarnings: number;
  isVerified: boolean;
  isActive: boolean;
  stripeConnectId: string | null;
  stripeConnectOnboarded: boolean;
  stripeConnectVerified: boolean;
  yearsExperience: number;
  coverageAreas: string[];
  createdAt: string;
  // Location fields
  baseLat: number | null;
  baseLng: number | null;
  baseAddress: string | null;
  coverageRadius: number;
  // Documentation fields
  insuranceDocumentUrl: string | null;
  certificationDocumentUrl: string | null;
  additionalDocumentUrls: string[];
  documentationUploadedAt: string | null;
  onboardingCompleted: boolean;
  termsAcceptedAt: string | null;
  // Insurance expiry tracking
  insuranceExpiryDate: string | null;
  insuranceVerifiedAt: string | null;
  insuranceVerifiedById: string | null;
  insuranceStatus: string;
  // Availability status
  isAvailable: boolean;
  scheduleEnabled: boolean;
  lastAvailabilityChange: string | null;
}

export default function AdminLocksmithsPage() {
  const [locksmiths, setLocksmiths] = useState<Locksmith[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLocksmith, setSelectedLocksmith] = useState<Locksmith | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // View mode: list or map
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Delete state
  const [deleteLocksmithId, setDeleteLocksmithId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Insurance verification state
  const [verifyingInsurance, setVerifyingInsurance] = useState(false);

  // Stripe sync state
  const [syncingStripe, setSyncingStripe] = useState<string | null>(null);

  // Welcome emails state
  const [sendingWelcomeEmails, setSendingWelcomeEmails] = useState(false);

  const fetchLocksmiths = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter === "verified") params.set("verified", "true");
      if (statusFilter === "unverified") params.set("verified", "false");
      if (statusFilter === "active") params.set("status", "active");
      if (statusFilter === "inactive") params.set("status", "inactive");
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/locksmiths?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setLocksmiths(data.locksmiths.map((ls: {
          id: string;
          name: string;
          email: string;
          phone: string;
          companyName: string | null;
          profileImage?: string | null;
          rating: number;
          reviewCount?: number;
          totalJobs: number;
          totalEarnings: number;
          isVerified: boolean;
          isActive: boolean;
          stripeConnectId?: string | null;
          stripeConnectOnboarded: boolean;
          stripeConnectVerified: boolean;
          yearsExperience: number;
          coverageAreas: string[];
          createdAt: string;
          baseLat?: number | null;
          baseLng?: number | null;
          baseAddress?: string | null;
          coverageRadius?: number;
          insuranceDocumentUrl?: string | null;
          certificationDocumentUrl?: string | null;
          additionalDocumentUrls?: string[];
          documentationUploadedAt?: string | null;
          onboardingCompleted?: boolean;
          termsAcceptedAt?: string | null;
          insuranceExpiryDate?: string | null;
          insuranceVerifiedAt?: string | null;
          insuranceVerifiedById?: string | null;
          insuranceStatus?: string;
          isAvailable?: boolean;
          scheduleEnabled?: boolean;
          lastAvailabilityChange?: string | null;
        }) => ({
          id: ls.id,
          name: ls.name,
          email: ls.email,
          phone: ls.phone,
          companyName: ls.companyName,
          avatar: ls.name.split(" ").map((n: string) => n[0]).join(""),
          profileImage: ls.profileImage || null,
          rating: ls.rating,
          reviewCount: ls.reviewCount || 0,
          totalJobs: ls.totalJobs,
          totalEarnings: ls.totalEarnings,
          isVerified: ls.isVerified,
          isActive: ls.isActive,
          stripeConnectId: ls.stripeConnectId || null,
          stripeConnectOnboarded: ls.stripeConnectOnboarded,
          stripeConnectVerified: ls.stripeConnectVerified,
          yearsExperience: ls.yearsExperience,
          coverageAreas: ls.coverageAreas,
          createdAt: ls.createdAt,
          baseLat: ls.baseLat || null,
          baseLng: ls.baseLng || null,
          baseAddress: ls.baseAddress || null,
          coverageRadius: ls.coverageRadius || 10,
          insuranceDocumentUrl: ls.insuranceDocumentUrl || null,
          certificationDocumentUrl: ls.certificationDocumentUrl || null,
          additionalDocumentUrls: ls.additionalDocumentUrls || [],
          documentationUploadedAt: ls.documentationUploadedAt || null,
          onboardingCompleted: ls.onboardingCompleted ?? false,
          termsAcceptedAt: ls.termsAcceptedAt || null,
          insuranceExpiryDate: ls.insuranceExpiryDate || null,
          insuranceVerifiedAt: ls.insuranceVerifiedAt || null,
          insuranceVerifiedById: ls.insuranceVerifiedById || null,
          insuranceStatus: ls.insuranceStatus || "pending",
          isAvailable: ls.isAvailable ?? true,
          scheduleEnabled: ls.scheduleEnabled ?? false,
          lastAvailabilityChange: ls.lastAvailabilityChange || null,
        })));
      }
    } catch (error) {
      console.error("Error fetching locksmiths:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchLocksmiths();
  }, [fetchLocksmiths]);

  // Handle locksmith actions (verify, suspend, etc.)
  const handleLocksmithAction = async (locksmithId: string, action: string) => {
    try {
      setActionLoading(action);

      const response = await fetch(`/api/locksmiths/${locksmithId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setLocksmiths(prev => prev.map(ls => {
          if (ls.id === locksmithId) {
            if (action === "verify") return { ...ls, isVerified: true };
            if (action === "unverify") return { ...ls, isVerified: false };
            if (action === "suspend") return { ...ls, isActive: false };
            if (action === "activate") return { ...ls, isActive: true };
          }
          return ls;
        }));

        // Update selected locksmith if it's the one being modified
        if (selectedLocksmith?.id === locksmithId) {
          setSelectedLocksmith(prev => {
            if (!prev) return null;
            if (action === "verify") return { ...prev, isVerified: true };
            if (action === "unverify") return { ...prev, isVerified: false };
            if (action === "suspend") return { ...prev, isActive: false };
            if (action === "activate") return { ...prev, isActive: true };
            return prev;
          });
        }

        alert(data.message || `Action "${action}" completed successfully`);
      } else {
        alert(data.error || "Action failed");
      }
    } catch (error) {
      console.error("Error performing action:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Delete locksmith handler
  const handleDeleteLocksmith = async (locksmithId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/locksmiths/${locksmithId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setDeleteLocksmithId(null);
        setSelectedLocksmith(null);
        fetchLocksmiths();
      } else {
        alert(data.error || "Failed to delete locksmith");
      }
    } catch (error) {
      console.error("Error deleting locksmith:", error);
      alert("Failed to delete locksmith");
    } finally {
      setIsDeleting(false);
    }
  };

  // Send welcome emails to all locksmiths
  const handleSendWelcomeEmails = async () => {
    if (!confirm("Are you sure you want to send welcome emails to ALL locksmiths on the platform? This cannot be undone.")) {
      return;
    }

    setSendingWelcomeEmails(true);
    try {
      const response = await fetch("/api/admin/locksmiths/send-welcome-emails", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ Successfully sent welcome emails to ${data.totalSent} locksmiths!\n\nTotal: ${data.totalLocksmiths}\nSent: ${data.totalSent}\nFailed: ${data.failed}${data.failed > 0 ? `\n\nFailed emails: ${data.failedEmails.join(", ")}` : ""}`);
      } else {
        alert(`❌ ${data.error || "Failed to send welcome emails"}`);
      }
    } catch (error) {
      console.error("Error sending welcome emails:", error);
      alert("❌ An error occurred while sending welcome emails");
    } finally {
      setSendingWelcomeEmails(false);
    }
  };

  // Insurance verification handler
  const handleInsuranceAction = async (locksmithId: string, action: "verify" | "reject") => {
    setVerifyingInsurance(true);
    try {
      const response = await fetch("/api/admin/verify-insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithId, action }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // Update the selected locksmith with new insurance status
        if (selectedLocksmith && selectedLocksmith.id === locksmithId) {
          setSelectedLocksmith({
            ...selectedLocksmith,
            insuranceStatus: data.locksmith.insuranceStatus,
            insuranceVerifiedAt: data.locksmith.insuranceVerifiedAt,
            insuranceVerifiedById: data.locksmith.insuranceVerifiedById || null,
          });
        }
        // Update the locksmiths list
        setLocksmiths((prev) =>
          prev.map((ls) =>
            ls.id === locksmithId
              ? {
                  ...ls,
                  insuranceStatus: data.locksmith.insuranceStatus,
                  insuranceVerifiedAt: data.locksmith.insuranceVerifiedAt,
                  insuranceVerifiedById: data.locksmith.insuranceVerifiedById || null,
                }
              : ls
          )
        );
        alert(data.message || `Insurance ${action === "verify" ? "verified" : "rejected"} successfully`);
        // Refetch locksmiths to ensure UI is in sync with database
        fetchLocksmiths();
      } else {
        alert(data.error || `Failed to ${action} insurance`);
      }
    } catch (error) {
      console.error(`Error ${action}ing insurance:`, error);
      alert(`Failed to ${action} insurance`);
    } finally {
      setVerifyingInsurance(false);
    }
  };

  // Stripe status sync handler
  const handleSyncStripeStatus = async (locksmithId: string) => {
    setSyncingStripe(locksmithId);
    try {
      const response = await fetch("/api/stripe-connect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithId }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // Update the selected locksmith with new Stripe status
        if (selectedLocksmith && selectedLocksmith.id === locksmithId) {
          setSelectedLocksmith({
            ...selectedLocksmith,
            stripeConnectOnboarded: data.status.onboarded,
            stripeConnectVerified: data.status.verified,
          });
        }
        // Update the locksmiths list
        setLocksmiths((prev) =>
          prev.map((ls) =>
            ls.id === locksmithId
              ? {
                  ...ls,
                  stripeConnectOnboarded: data.status.onboarded,
                  stripeConnectVerified: data.status.verified,
                }
              : ls
          )
        );
        if (data.status.changed) {
          alert(`Stripe status updated: ${data.status.verified ? "Verified" : data.status.onboarded ? "Connected" : "In Progress"}`);
          // Refetch locksmiths to ensure UI is in sync with database
          fetchLocksmiths();
        } else {
          alert("Stripe status is already up to date");
        }
      } else {
        alert(data.error || "Failed to sync Stripe status");
      }
    } catch (error) {
      console.error("Error syncing Stripe status:", error);
      alert("Failed to sync Stripe status");
    } finally {
      setSyncingStripe(null);
    }
  };

  // Filter locksmiths by search and status
  const filteredLocksmiths = locksmiths.filter((ls) => {
    const matchesSearch =
      ls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ls.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ls.companyName?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    // Apply availability filters (client-side for new options)
    let matchesFilter = true;
    if (statusFilter === "available") matchesFilter = ls.isAvailable === true;
    if (statusFilter === "unavailable") matchesFilter = ls.isAvailable === false;
    if (statusFilter === "scheduled") matchesFilter = ls.scheduleEnabled === true;
    if (statusFilter === "stripe_pending") matchesFilter = ls.stripeConnectId !== null && !ls.stripeConnectVerified;
    if (statusFilter === "insurance_pending") matchesFilter = ls.insuranceStatus === "pending" && ls.insuranceDocumentUrl !== null;

    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getLastActiveDiff = (dateString: string | null) => {
    if (!dateString) return "Never";
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Locksmith Management</h1>
            <p className="text-sm text-slate-500">{filteredLocksmiths.length} locksmiths</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchLocksmiths}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white hidden sm:flex">
              <UserPlus className="w-4 h-4 mr-2" />
              Invite
            </Button>
          </div>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
            <div className="text-xs lg:text-sm text-slate-500">Total Locksmiths</div>
            <div className="text-xl lg:text-2xl font-bold text-slate-900">{locksmiths.length}</div>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
            <div className="text-xs lg:text-sm text-slate-500">Verified</div>
            <div className="text-xl lg:text-2xl font-bold text-green-600">
              {locksmiths.filter(ls => ls.isVerified).length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
            <div className="text-xs lg:text-sm text-slate-500">Available Now</div>
            <div className="text-xl lg:text-2xl font-bold text-emerald-600">
              {locksmiths.filter(ls => ls.isAvailable).length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 lg:p-4 shadow-sm">
            <div className="text-xs lg:text-sm text-slate-500">Total Earnings</div>
            <div className="text-xl lg:text-2xl font-bold text-orange-600">
              £{locksmiths.reduce((sum, ls) => sum + ls.totalEarnings, 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-3 lg:p-4 mb-4 lg:mb-6">
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, email, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 lg:pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 lg:flex-none px-3 lg:px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
              >
                <option value="all">All Locksmiths</option>
                <option value="available">Available Now</option>
                <option value="unavailable">Unavailable</option>
                <option value="scheduled">Has Schedule</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
                <option value="active">Account Active</option>
                <option value="inactive">Account Disabled</option>
                <option value="stripe_pending">Stripe Pending</option>
                <option value="insurance_pending">Insurance Pending</option>
              </select>
              {/* View Mode Toggle */}
              <div className="flex border border-slate-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-2.5 lg:px-3 py-2 flex items-center gap-1 text-xs lg:text-sm font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-orange-500 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className={`px-2.5 lg:px-3 py-2 flex items-center gap-1 text-xs lg:text-sm font-medium transition-colors ${
                    viewMode === "map"
                      ? "bg-orange-500 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Map className="w-4 h-4" />
                  <span className="hidden sm:inline">Map</span>
                </button>
              </div>
              {/* Send Welcome Emails Button */}
              <button
                type="button"
                onClick={handleSendWelcomeEmails}
                disabled={sendingWelcomeEmails || locksmiths.length === 0}
                className="px-3 lg:px-4 py-2 flex items-center gap-2 text-xs lg:text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send welcome emails to all locksmiths"
              >
                {sendingWelcomeEmails ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send Welcome Emails</span>
                    <span className="sm:hidden">Welcome</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Coverage Map View */}
        {viewMode === "map" && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Map className="w-5 h-5 text-orange-500" />
                Locksmith Coverage Areas
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {locksmiths.filter(ls => ls.baseLat && ls.baseLng).length} of {locksmiths.length} locksmiths have set their coverage area
              </p>
            </div>
            <div className="p-4">
              <AdminCoverageMap
                locksmiths={locksmiths
                  .filter(ls => ls.baseLat && ls.baseLng)
                  .map(ls => ({
                    id: ls.id,
                    name: ls.name,
                    baseLat: ls.baseLat!,
                    baseLng: ls.baseLng!,
                    coverageRadius: ls.coverageRadius,
                    isVerified: ls.isVerified,
                  }))}
                height="500px"
                onLocksmithClick={(id) => {
                  const locksmith = locksmiths.find(ls => ls.id === id);
                  if (locksmith) setSelectedLocksmith(locksmith);
                }}
              />
            </div>
          </div>
        )}

        {/* Locksmiths Table */}
        {viewMode === "list" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Locksmith
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Rating
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Jobs
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Earnings
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Coverage
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLocksmiths.map((ls) => (
                  <tr
                    key={ls.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedLocksmith(ls)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {ls.profileImage ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden relative">
                            <Image
                              src={ls.profileImage}
                              alt={ls.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                            {ls.avatar}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900">{ls.name}</span>
                            {ls.isVerified && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold border border-green-200">
                                <Shield className="w-3 h-3 fill-green-600 text-green-600" />
                                Verified
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-500">{ls.companyName || "Independent"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        {/* Availability Status */}
                        {ls.isAvailable ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            Available
                            {ls.scheduleEnabled && (
                              <Clock className="w-3 h-3 ml-0.5 text-emerald-600" />
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                            Unavailable
                            {ls.scheduleEnabled && (
                              <Clock className="w-3 h-3 ml-0.5 text-slate-500" />
                            )}
                          </span>
                        )}
                        {/* Account Status */}
                        {ls.isActive ? (
                          <span className="text-xs text-slate-500">Account Active</span>
                        ) : (
                          <span className="text-xs text-red-600">Account Disabled</span>
                        )}
                        {/* Stripe Status with sync option */}
                        <span className="inline-flex items-center gap-1">
                          {ls.stripeConnectOnboarded && ls.stripeConnectVerified ? (
                            <span className="text-xs text-green-600">Stripe Verified</span>
                          ) : ls.stripeConnectOnboarded ? (
                            <span className="text-xs text-purple-600">Stripe Connected</span>
                          ) : ls.stripeConnectId ? (
                            <>
                              <span className="text-xs text-amber-600">Stripe In Progress</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSyncStripeStatus(ls.id);
                                }}
                                disabled={syncingStripe === ls.id}
                                className="p-0.5 rounded hover:bg-amber-100 text-amber-600 transition-colors disabled:opacity-50"
                                title="Sync Stripe Status"
                              >
                                <RefreshCw className={`w-3 h-3 ${syncingStripe === ls.id ? 'animate-spin' : ''}`} />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-red-500">Stripe Not Started</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {ls.reviewCount > 0 ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="font-medium">{ls.rating}</span>
                          <span className="text-slate-400 text-sm">({ls.reviewCount})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">No reviews</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{ls.totalJobs}</div>
                      <div className="text-sm text-slate-500">
                        {ls.yearsExperience} years exp.
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="font-bold text-slate-900">£{ls.totalEarnings.toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-4">
                      {ls.baseLat && ls.baseLng ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-orange-500" />
                          <span className="text-slate-700">{ls.coverageRadius} mi</span>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Showing {filteredLocksmiths.length} locksmiths
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-3 py-1 text-sm">Page 1</span>
              <Button variant="outline" size="sm" disabled>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        )}

        {/* Locksmith Detail Modal */}
        {selectedLocksmith && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="p-6 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      {selectedLocksmith.profileImage ? (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden relative">
                          <Image
                            src={selectedLocksmith.profileImage}
                            alt={selectedLocksmith.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                          {selectedLocksmith.avatar}
                        </div>
                      )}
                      {/* Photo upload overlay */}
                      <label
                        htmlFor="photo-upload"
                        className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                      >
                        <Camera className="w-6 h-6 text-white" />
                      </label>
                      <input
                        type="file"
                        id="photo-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !selectedLocksmith) return;

                          const formData = new FormData();
                          formData.append("file", file);

                          try {
                            setActionLoading("photo");
                            const uploadRes = await fetch("/api/upload", {
                              method: "POST",
                              body: formData,
                            });
                            const uploadData = await uploadRes.json();

                            if (uploadData.success && uploadData.url) {
                              const updateRes = await fetch(`/api/locksmiths/${selectedLocksmith.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ profileImage: uploadData.url }),
                              });
                              const updateData = await updateRes.json();

                              if (updateData.success) {
                                setSelectedLocksmith({ ...selectedLocksmith, profileImage: uploadData.url });
                                setLocksmiths(prev => prev.map(ls =>
                                  ls.id === selectedLocksmith.id ? { ...ls, profileImage: uploadData.url } : ls
                                ));
                                alert("Photo updated successfully!");
                              }
                            }
                          } catch (error) {
                            console.error("Error uploading photo:", error);
                            alert("Failed to upload photo");
                          } finally {
                            setActionLoading(null);
                          }
                        }}
                      />
                      {actionLoading === "photo" && (
                        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-slate-900">{selectedLocksmith.name}</h2>
                        {selectedLocksmith.isVerified && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold border border-green-200">
                            <Shield className="w-4 h-4 fill-green-600 text-green-600" />
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500">{selectedLocksmith.companyName || "Independent"}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {selectedLocksmith.profileImage ? "Hover to change photo" : "Click to add photo"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLocksmith(null)}
                    className="p-2 hover:bg-slate-100 rounded-full"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  {selectedLocksmith.isVerified ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Verified
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Pending Verification
                    </span>
                  )}
                  {selectedLocksmith.isActive ? (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      Currently Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                      Offline
                    </span>
                  )}
                  {/* Stripe Connect Status - detailed with sync button */}
                  <div className="flex items-center gap-2">
                    {selectedLocksmith.stripeConnectOnboarded && selectedLocksmith.stripeConnectVerified ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <CreditCard className="w-4 h-4" /> Stripe Verified
                      </span>
                    ) : selectedLocksmith.stripeConnectOnboarded ? (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <CreditCard className="w-4 h-4" /> Stripe Connected
                      </span>
                    ) : selectedLocksmith.stripeConnectId ? (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <CreditCard className="w-4 h-4" /> Stripe In Progress
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <CreditCard className="w-4 h-4" /> Stripe Not Started
                      </span>
                    )}
                    {/* Sync Stripe Status Button */}
                    {selectedLocksmith.stripeConnectId && (
                      <button
                        type="button"
                        onClick={() => handleSyncStripeStatus(selectedLocksmith.id)}
                        disabled={syncingStripe === selectedLocksmith.id}
                        className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50"
                        title="Sync Stripe Status"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingStripe === selectedLocksmith.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-500">Email</span>
                    </div>
                    <div className="font-medium">{selectedLocksmith.email}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-500">Phone</span>
                    </div>
                    <div className="font-medium">{selectedLocksmith.phone}</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <div className="text-2xl font-bold text-slate-900">{selectedLocksmith.totalJobs}</div>
                    <div className="text-sm text-slate-500">Jobs</div>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <div className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-1">
                      {selectedLocksmith.reviewCount > 0 ? (
                        <>
                          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                          {selectedLocksmith.rating.toFixed(1)}
                        </>
                      ) : (
                        <span className="text-slate-400 text-lg">—</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500">
                      {selectedLocksmith.reviewCount > 0
                        ? `Rating (${selectedLocksmith.reviewCount} review${selectedLocksmith.reviewCount !== 1 ? "s" : ""})`
                        : "No reviews yet"
                      }
                    </div>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">
                      £{selectedLocksmith.totalEarnings.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-500">Total Earned</div>
                  </div>
                </div>

                {/* Coverage Areas */}
                <div>
                  <div className="text-sm text-slate-500 mb-2">Coverage Areas</div>
                  {selectedLocksmith.baseLat && selectedLocksmith.baseLng ? (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 flex items-center gap-2">
                            {selectedLocksmith.coverageRadius} miles radius
                          </div>
                          <p className="text-xs text-slate-500">
                            Coverage distance from base location{selectedLocksmith.baseAddress ? ` (${selectedLocksmith.baseAddress})` : ""}
                          </p>
                        </div>
                      </div>
                      {selectedLocksmith.coverageAreas.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="text-xs text-slate-500 mb-2">Postcode Areas</div>
                          <div className="flex flex-wrap gap-2">
                            {selectedLocksmith.coverageAreas.map((area) => (
                              <span
                                key={area}
                                className="px-3 py-1 bg-white text-slate-700 rounded-full text-sm border border-slate-200"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 rounded-xl border border-dashed border-amber-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="font-medium text-amber-700">Coverage area not set</div>
                          <p className="text-xs text-amber-600">
                            Locksmith hasn&apos;t configured their coverage area yet
                          </p>
                        </div>
                      </div>
                      {selectedLocksmith.coverageAreas.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-amber-200">
                          <div className="text-xs text-slate-500 mb-2">Listed Postcode Areas</div>
                          <div className="flex flex-wrap gap-2">
                            {selectedLocksmith.coverageAreas.map((area) => (
                              <span
                                key={area}
                                className="px-3 py-1 bg-white text-slate-700 rounded-full text-sm border border-slate-200"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Joined: </span>
                    <span className="font-medium">{formatDate(selectedLocksmith.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Experience: </span>
                    <span className="font-medium">{selectedLocksmith.yearsExperience} years</span>
                  </div>
                </div>

                {/* Documentation Section */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-blue-600" />
                    Uploaded Documentation
                  </h3>

                  {/* Onboarding Status */}
                  <div className="mb-4 flex items-center gap-3">
                    {selectedLocksmith.onboardingCompleted ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Onboarding Complete
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Onboarding Pending
                      </span>
                    )}
                    {selectedLocksmith.termsAcceptedAt && (
                      <span className="text-xs text-slate-500">
                        T&C accepted: {formatDate(selectedLocksmith.termsAcceptedAt)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Insurance Document with Expiry */}
                    <div className={`p-4 rounded-xl border-2 ${
                      selectedLocksmith.insuranceStatus === "expired"
                        ? "bg-red-50 border-red-200"
                        : selectedLocksmith.insuranceStatus === "expiring_soon"
                        ? "bg-amber-50 border-amber-200"
                        : selectedLocksmith.insuranceStatus === "verified"
                        ? "bg-green-50 border-green-200"
                        : selectedLocksmith.insuranceDocumentUrl
                        ? "bg-blue-50 border-blue-200"
                        : "bg-slate-50 border-dashed border-slate-300"
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            selectedLocksmith.insuranceStatus === "expired"
                              ? "bg-red-100"
                              : selectedLocksmith.insuranceStatus === "expiring_soon"
                              ? "bg-amber-100"
                              : selectedLocksmith.insuranceStatus === "verified"
                              ? "bg-green-100"
                              : selectedLocksmith.insuranceDocumentUrl
                              ? "bg-blue-100"
                              : "bg-slate-200"
                          }`}>
                            <Building2 className={`w-5 h-5 ${
                              selectedLocksmith.insuranceStatus === "expired"
                                ? "text-red-600"
                                : selectedLocksmith.insuranceStatus === "expiring_soon"
                                ? "text-amber-600"
                                : selectedLocksmith.insuranceStatus === "verified"
                                ? "text-green-600"
                                : selectedLocksmith.insuranceDocumentUrl
                                ? "text-blue-600"
                                : "text-slate-400"
                            }`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-slate-900">Insurance Document</span>
                              {/* Status Badge */}
                              {selectedLocksmith.insuranceStatus === "expired" && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Expired
                                </span>
                              )}
                              {selectedLocksmith.insuranceStatus === "expiring_soon" && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Expiring Soon
                                </span>
                              )}
                              {selectedLocksmith.insuranceStatus === "verified" && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Verified
                                </span>
                              )}
                              {selectedLocksmith.insuranceStatus === "pending" && selectedLocksmith.insuranceDocumentUrl && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                  Pending Review
                                </span>
                              )}
                              {!selectedLocksmith.insuranceDocumentUrl && (
                                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Required</span>
                              )}
                            </div>

                            {/* Expiry Date */}
                            {selectedLocksmith.insuranceExpiryDate && (
                              <div className="flex items-center gap-2 mt-2">
                                <Calendar className={`w-4 h-4 ${
                                  selectedLocksmith.insuranceStatus === "expired"
                                    ? "text-red-500"
                                    : selectedLocksmith.insuranceStatus === "expiring_soon"
                                    ? "text-amber-500"
                                    : "text-slate-400"
                                }`} />
                                <span className={`text-sm ${
                                  selectedLocksmith.insuranceStatus === "expired"
                                    ? "text-red-600 font-medium"
                                    : selectedLocksmith.insuranceStatus === "expiring_soon"
                                    ? "text-amber-600 font-medium"
                                    : "text-slate-600"
                                }`}>
                                  {selectedLocksmith.insuranceStatus === "expired" ? "Expired: " : "Expires: "}
                                  {formatDate(selectedLocksmith.insuranceExpiryDate)}
                                </span>
                                {/* Days until expiry */}
                                {selectedLocksmith.insuranceStatus !== "expired" && (
                                  <span className="text-xs text-slate-400">
                                    ({Math.ceil((new Date(selectedLocksmith.insuranceExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days)
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Verification info */}
                            {selectedLocksmith.insuranceVerifiedAt && (
                              <p className="text-xs text-green-600 mt-1">
                                Verified on {formatDate(selectedLocksmith.insuranceVerifiedAt)}
                              </p>
                            )}

                            {!selectedLocksmith.insuranceDocumentUrl && (
                              <p className="text-xs text-slate-500 mt-1">Not uploaded yet</p>
                            )}

                            {/* Insurance Verification Actions */}
                            {selectedLocksmith.insuranceDocumentUrl && selectedLocksmith.insuranceStatus !== "verified" && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs h-7"
                                  onClick={() => handleInsuranceAction(selectedLocksmith.id, "verify")}
                                  disabled={verifyingInsurance}
                                >
                                  {verifyingInsurance ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                  )}
                                  Verify Insurance
                                </Button>
                              </div>
                            )}
                            {selectedLocksmith.insuranceStatus === "verified" && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs h-7"
                                  onClick={() => handleInsuranceAction(selectedLocksmith.id, "reject")}
                                  disabled={verifyingInsurance}
                                >
                                  {verifyingInsurance ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <XCircle className="w-3 h-3 mr-1" />
                                  )}
                                  Remove Verification
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        {selectedLocksmith.insuranceDocumentUrl ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <a
                              href={selectedLocksmith.insuranceDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              {selectedLocksmith.insuranceDocumentUrl.toLowerCase().endsWith('.pdf') ? (
                                <FileText className="w-4 h-4" />
                              ) : (
                                <FileImage className="w-4 h-4" />
                              )}
                              View
                            </a>
                            <a
                              href={selectedLocksmith.insuranceDocumentUrl}
                              download
                              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 font-medium px-2 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Missing</span>
                        )}
                      </div>
                    </div>

                    {/* Certification Document */}
                    <div className={`p-4 rounded-xl border-2 ${
                      selectedLocksmith.certificationDocumentUrl
                        ? "bg-green-50 border-green-200"
                        : "bg-slate-50 border-dashed border-slate-300"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            selectedLocksmith.certificationDocumentUrl
                              ? "bg-green-100"
                              : "bg-slate-200"
                          }`}>
                            <BadgeCheck className={`w-5 h-5 ${
                              selectedLocksmith.certificationDocumentUrl
                                ? "text-green-600"
                                : "text-slate-400"
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">Locksmith Certification</span>
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Optional</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {selectedLocksmith.certificationDocumentUrl
                                ? "Document uploaded"
                                : "Not uploaded"}
                            </p>
                          </div>
                        </div>
                        {selectedLocksmith.certificationDocumentUrl ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <a
                              href={selectedLocksmith.certificationDocumentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              {selectedLocksmith.certificationDocumentUrl.toLowerCase().endsWith('.pdf') ? (
                                <FileText className="w-4 h-4" />
                              ) : (
                                <FileImage className="w-4 h-4" />
                              )}
                              View
                            </a>
                            <a
                              href={selectedLocksmith.certificationDocumentUrl}
                              download
                              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 font-medium px-2 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </div>

                    {/* Additional Documents */}
                    {selectedLocksmith.additionalDocumentUrls.length > 0 && (
                      <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <span className="font-medium text-slate-900">Additional Documents</span>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {selectedLocksmith.additionalDocumentUrls.length} document(s) uploaded
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {selectedLocksmith.additionalDocumentUrls.map((url, index) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-2 bg-white rounded-lg border hover:border-blue-400 transition-colors"
                            >
                              <span className="text-sm text-slate-700 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-500" />
                                Document {index + 1}
                              </span>
                              <ExternalLink className="w-4 h-4 text-blue-600" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documentation upload date */}
                    {selectedLocksmith.documentationUploadedAt && (
                      <p className="text-xs text-slate-500 text-right">
                        Uploaded on {formatDate(selectedLocksmith.documentationUploadedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-slate-50">
                {/* Insurance & Stripe Actions Row */}
                <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-200">
                  {/* Insurance Verification */}
                  {selectedLocksmith.insuranceDocumentUrl && selectedLocksmith.insuranceStatus !== "verified" && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleInsuranceAction(selectedLocksmith.id, "verify")}
                      disabled={verifyingInsurance}
                    >
                      {verifyingInsurance ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4 mr-2" />
                      )}
                      Verify Insurance
                    </Button>
                  )}
                  {selectedLocksmith.insuranceStatus === "verified" && (
                    <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Insurance Verified
                    </span>
                  )}
                  {/* Stripe Sync */}
                  {selectedLocksmith.stripeConnectId && !selectedLocksmith.stripeConnectVerified && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-purple-600 border-purple-300 hover:bg-purple-50"
                      onClick={() => handleSyncStripeStatus(selectedLocksmith.id)}
                      disabled={syncingStripe === selectedLocksmith.id}
                    >
                      {syncingStripe === selectedLocksmith.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Sync Stripe Status
                    </Button>
                  )}
                  {selectedLocksmith.stripeConnectVerified && (
                    <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Stripe Verified
                    </span>
                  )}
                </div>

                {/* Main Actions Row */}
                <div className="flex flex-wrap gap-3">
                  {!selectedLocksmith.isVerified ? (
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleLocksmithAction(selectedLocksmith.id, "verify")}
                      disabled={actionLoading === "verify"}
                    >
                      {actionLoading === "verify" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      {actionLoading === "verify" ? "Verifying..." : "Verify Locksmith"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      onClick={() => handleLocksmithAction(selectedLocksmith.id, "unverify")}
                      disabled={actionLoading === "unverify"}
                    >
                      {actionLoading === "unverify" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      {actionLoading === "unverify" ? "Removing..." : "Remove Verification"}
                    </Button>
                  )}
                  <Button variant="outline">
                    <Eye className="w-4 h-4 mr-2" />
                    View Jobs
                  </Button>
                  {selectedLocksmith.stripeConnectOnboarded && (
                    <Button variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Stripe Dashboard
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleLocksmithAction(selectedLocksmith.id, "suspend")}
                    disabled={actionLoading === "suspend"}
                  >
                    {actionLoading === "suspend" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Ban className="w-4 h-4 mr-2" />
                    )}
                    {actionLoading === "suspend" ? "Suspending..." : "Suspend"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setDeleteLocksmithId(selectedLocksmith.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteLocksmithId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setDeleteLocksmithId(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Delete Locksmith
                </h3>
                <button type="button" onClick={() => setDeleteLocksmithId(null)} className="p-1 hover:bg-slate-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800 font-medium mb-2">
                    Are you sure you want to delete this locksmith?
                  </p>
                  <p className="text-sm text-red-600">
                    This action will permanently delete the locksmith account and ALL associated data including jobs, quotes, payments, reviews, and applications. This cannot be undone.
                  </p>
                </div>
                {selectedLocksmith && selectedLocksmith.id === deleteLocksmithId && (
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>Name: <span className="font-semibold text-slate-900">{selectedLocksmith.name}</span></p>
                    <p>Company: <span className="font-semibold text-slate-900">{selectedLocksmith.companyName || "Independent"}</span></p>
                    <p>Email: <span className="font-semibold text-slate-900">{selectedLocksmith.email}</span></p>
                    <p>Total Jobs: <span className="font-semibold text-slate-900">{selectedLocksmith.totalJobs}</span></p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t flex gap-3">
                <Button variant="outline" onClick={() => setDeleteLocksmithId(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteLocksmith(deleteLocksmithId)}
                  disabled={isDeleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  {isDeleting ? "Deleting..." : "Delete Locksmith"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}
