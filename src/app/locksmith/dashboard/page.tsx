"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Briefcase,
  PoundSterling,
  Loader2,
  TrendingUp,
  CheckCircle2,
  Star,
  Clock,
  MapPin,
  ChevronRight,
  Wallet,
  ArrowUpRight,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { LocksmithOnboardingModal } from "@/components/onboarding/LocksmithOnboardingModal";
import { AvailabilityToggle } from "@/components/locksmith/AvailabilityToggle";

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  availableJobs: number;
  totalEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  rating: number;
  reviewCount: number;
  pendingApplications: number;
}

interface ActiveJob {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  postcode: string;
  address: string;
  customer: { name: string; phone: string };
  createdAt: string;
  assessmentFee: number | null;
}

interface StripeStatus {
  connected: boolean;
  onboarded: boolean;
  verified: boolean;
  payoutsEnabled: boolean;
}

interface LocationStatus {
  hasLocation: boolean;
  coverageRadius: number;
}

interface InsuranceStatus {
  status: string;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  ARRIVED: "bg-purple-100 text-purple-700",
  DIAGNOSING: "bg-indigo-100 text-indigo-700",
  QUOTED: "bg-cyan-100 text-cyan-700",
  QUOTE_ACCEPTED: "bg-emerald-100 text-emerald-700",
  IN_PROGRESS: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100 text-green-700",
  SIGNED: "bg-green-200 text-green-800",
};

export default function LocksmithDashboard() {
  const { user, setOnboardingCompleted } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus | null>(null);
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    if (user && user.onboardingCompleted === false) {
      setShowOnboarding(true);
    }
  }, [user]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setOnboardingCompleted();
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Fetch jobs
      const jobsResponse = await fetch("/api/jobs");
      const jobsData = await jobsResponse.json();

      // Fetch applications
      const appsResponse = await fetch(`/api/locksmith/applications?locksmithId=${user.id}`);
      const appsData = await appsResponse.json();

      // Fetch profile for Stripe status and rating
      const profileResponse = await fetch(`/api/locksmith/profile?locksmithId=${user.id}`);
      const profileData = await profileResponse.json();

      // Get rating and review count from profile
      let profileRating = 0;
      let profileReviewCount = 0;

      if (profileData.success && profileData.stripe) {
        setStripeStatus({
          connected: profileData.stripe.connected,
          onboarded: profileData.stripe.onboarded,
          verified: profileData.stripe.verified,
          payoutsEnabled: profileData.stripe.status?.payoutsEnabled || false,
        });
      }

      // Check if location is set and get rating/review data
      if (profileData.success && profileData.profile) {
        setLocationStatus({
          hasLocation: !!(profileData.profile.baseLat && profileData.profile.baseLng),
          coverageRadius: profileData.profile.coverageRadius || 10,
        });
        profileRating = profileData.profile.rating || 0;
        profileReviewCount = profileData.profile.reviewCount || 0;

        // Set insurance status
        if (profileData.profile.insuranceExpiryDate) {
          const expiryDate = new Date(profileData.profile.insuranceExpiryDate);
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          setInsuranceStatus({
            status: profileData.profile.insuranceStatus || "pending",
            expiryDate: profileData.profile.insuranceExpiryDate,
            daysUntilExpiry,
          });
        } else {
          setInsuranceStatus({
            status: profileData.profile.insuranceStatus || "pending",
            expiryDate: null,
            daysUntilExpiry: null,
          });
        }
      }

      if (jobsData.success) {
        const allJobs = jobsData.jobs || [];
        const appliedJobIds = new Set((appsData.applications || []).map((a: any) => a.jobId));

        // Filter jobs assigned to this locksmith
        const myActiveJobs = allJobs.filter(
          (job: any) =>
            job.locksmithId === user.id &&
            ["ACCEPTED", "ARRIVED", "DIAGNOSING", "IN_PROGRESS", "QUOTED", "QUOTE_ACCEPTED"].includes(job.status)
        );

        const myCompletedJobs = allJobs.filter(
          (job: any) => job.locksmithId === user.id && ["COMPLETED", "SIGNED"].includes(job.status)
        );

        // Available jobs (PENDING and not applied)
        const availableJobs = allJobs.filter(
          (job: any) => job.status === "PENDING" && !appliedJobIds.has(job.id)
        );

        // Calculate earnings from completed jobs
        const totalEarnings = myCompletedJobs.reduce((sum: number, job: any) => {
          return sum + (job.quote?.total || job.assessmentFee || 0);
        }, 0);

        setActiveJobs(
          myActiveJobs.map((job: any) => ({
            id: job.id,
            jobNumber: job.jobNumber,
            status: job.status,
            problemType: job.problemType,
            postcode: job.postcode,
            address: job.address,
            customer: job.customer || { name: "Customer", phone: "N/A" },
            createdAt: job.createdAt,
            assessmentFee: job.assessmentFee,
          }))
        );

        setStats({
          totalJobs: myCompletedJobs.length + myActiveJobs.length,
          activeJobs: myActiveJobs.length,
          completedJobs: myCompletedJobs.length,
          availableJobs: availableJobs.length,
          totalEarnings: totalEarnings,
          weeklyEarnings: totalEarnings * 0.3,
          monthlyEarnings: totalEarnings * 0.7,
          rating: profileRating,
          reviewCount: profileReviewCount,
          pendingApplications: appsData.applications?.length || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [user?.id, fetchDashboardData]);

  const getTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Locksmith Onboarding Modal */}
      {showOnboarding && user && (
        <LocksmithOnboardingModal
          locksmithId={user.id}
          locksmithName={user.name}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome back, {user?.name || "Locksmith"}</p>
      </div>

      {/* Availability Toggle - Prominent placement */}
      {user?.id && (
        <div className="mb-6 sm:mb-8">
          <AvailabilityToggle
            locksmithId={user.id}
            onToggle={(isAvailable) => {
              console.log("Availability changed:", isAvailable);
            }}
          />
        </div>
      )}

      {/* Location Not Set Banner */}
      {locationStatus && !locationStatus.hasLocation && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Set Your Coverage Area</h3>
                <p className="text-sm text-white/80 mt-1">
                  You need to set your base location to see available jobs in your area.
                </p>
              </div>
            </div>
            <Link href="/locksmith/settings">
              <Button className="w-full sm:w-auto bg-white text-blue-600 hover:bg-blue-50">
                Set Location
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Insurance Expiry Warning Banner */}
      {insuranceStatus && (insuranceStatus.status === "expired" || insuranceStatus.status === "expiring_soon") && (
        <div className={`rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 text-white ${
          insuranceStatus.status === "expired"
            ? "bg-gradient-to-r from-red-500 to-rose-500"
            : "bg-gradient-to-r from-amber-500 to-orange-500"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">
                  {insuranceStatus.status === "expired"
                    ? "Insurance Expired!"
                    : "Insurance Expiring Soon"}
                </h3>
                <p className="text-sm text-white/90 mt-1">
                  {insuranceStatus.status === "expired"
                    ? "Your insurance has expired. Please upload a new insurance certificate to continue accepting jobs."
                    : `Your insurance expires in ${insuranceStatus.daysUntilExpiry} days. Please renew to avoid service interruption.`}
                </p>
              </div>
            </div>
            <Link href="/locksmith/settings">
              <Button className={`w-full sm:w-auto ${
                insuranceStatus.status === "expired"
                  ? "bg-white text-red-600 hover:bg-red-50"
                  : "bg-white text-amber-600 hover:bg-amber-50"
              }`}>
                Update Insurance
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Stripe Setup Banner */}
      {stripeStatus && !stripeStatus.payoutsEnabled && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">
                  {stripeStatus.connected
                    ? stripeStatus.onboarded
                      ? "Verification Pending"
                      : "Complete Your Setup"
                    : "Set Up Payouts"}
                </h3>
                <p className="text-sm text-white/80 mt-1">
                  {stripeStatus.connected
                    ? stripeStatus.onboarded
                      ? "Stripe is reviewing your details. This usually takes 1-2 business days."
                      : "Add your bank details to start receiving payments."
                    : "Connect your bank account to receive payments for completed jobs."}
                </p>
              </div>
            </div>
            <Link href="/locksmith/earnings">
              <Button className="w-full sm:w-auto bg-white text-orange-600 hover:bg-orange-50">
                {stripeStatus.connected ? "Check Status" : "Set Up Now"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-slate-500 text-xs sm:text-sm">Available Jobs</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">{stats?.availableJobs || 0}</div>
          <Link href="/locksmith/jobs" className="text-xs sm:text-sm text-orange-600 flex items-center gap-1 mt-1 hover:underline">
            View jobs
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-slate-500 text-xs sm:text-sm">Total Earnings</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <PoundSterling className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            £{(stats?.totalEarnings || 0).toLocaleString()}
          </div>
          <div className="text-xs sm:text-sm text-green-600 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>£{(stats?.weeklyEarnings || 0).toFixed(0)} this week</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-slate-500 text-xs sm:text-sm">Jobs Completed</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">{stats?.completedJobs || 0}</div>
          <div className="text-xs sm:text-sm text-slate-500 mt-1">All time</div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-slate-500 text-xs sm:text-sm">Your Rating</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
          </div>
          {(stats?.reviewCount || 0) > 0 ? (
            <>
              <div className="text-2xl sm:text-3xl font-bold text-slate-900">{stats?.rating?.toFixed(1) || "0.0"}</div>
              <div className="text-xs sm:text-sm text-amber-600 flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-amber-500" />
                <span>
                  {(stats?.rating || 0) >= 4.5 ? "Excellent" : (stats?.rating || 0) >= 4 ? "Very Good" : (stats?.rating || 0) >= 3 ? "Good" : "Building"}
                </span>
                <span className="text-slate-400">({stats?.reviewCount})</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-xl sm:text-2xl font-bold text-slate-400">--</div>
              <div className="text-xs sm:text-sm text-slate-400 mt-1">
                No reviews yet
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <Link
          href="/locksmith/jobs"
          className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-200 transition-colors">
              <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Find Jobs</h3>
              <p className="text-xs sm:text-sm text-slate-500 truncate">
                {stats?.availableJobs || 0} jobs available
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
          </div>
        </Link>

        <Link
          href="/locksmith/earnings"
          className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <PoundSterling className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Earnings</h3>
              <p className="text-xs sm:text-sm text-slate-500 truncate">View payouts and transactions</p>
            </div>
            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-green-500 transition-colors" />
          </div>
        </Link>

        <Link
          href="/locksmith/jobs"
          className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow group sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Applications</h3>
              <p className="text-xs sm:text-sm text-slate-500 truncate">
                {stats?.pendingApplications || 0} pending responses
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-purple-500 transition-colors" />
          </div>
        </Link>
      </div>

      {/* Active Jobs List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Active Jobs</h2>
            {activeJobs.length > 0 && (
              <span className="text-sm text-slate-500">{activeJobs.length} in progress</span>
            )}
          </div>
        </div>

        {activeJobs.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">No Active Jobs</h3>
            <p className="text-slate-500 text-sm mb-4">
              {(stats?.availableJobs || 0) > 0
                ? `There are ${stats?.availableJobs} jobs available to apply for`
                : "Check back soon for new jobs in your area"}
            </p>
            <Link href="/locksmith/jobs">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                {(stats?.availableJobs || 0) > 0 ? "View Available Jobs" : "Browse Jobs"}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeJobs.slice(0, 5).map((job) => (
              <Link
                key={job.id}
                href={`/locksmith/job/${job.id}/work`}
                className="block p-4 sm:p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-slate-500">{job.jobNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status]}`}
                      >
                        {job.status.replace("_", " ")}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm sm:text-base truncate">
                      {problemLabels[job.problemType] || job.problemType}
                    </h3>
                    <div className="flex items-center flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.postcode}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getTimeAgo(job.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {job.assessmentFee && (
                      <div className="text-base sm:text-lg font-bold text-orange-600">£{job.assessmentFee}</div>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-400 ml-auto mt-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
