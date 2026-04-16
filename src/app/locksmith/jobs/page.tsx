"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  MapPin,
  Clock,
  User,
  Loader2,
  PoundSterling,
  RefreshCw,
  X,
  CheckCircle2,
  Users,
  AlertCircle,
  ChevronRight,
  Bell,
  Eye,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { StripeVerificationModal } from "@/components/payments/StripeVerificationModal";
import { useJobNotifications } from "@/hooks/useJobNotifications";

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  customer: { name: string; phone: string };
  createdAt: string;
  applicationCount: number;
  distanceMiles?: number | null;
}

interface MyApplication {
  id: string;
  jobId: string;
  assessmentFee: number;
  eta: number;
  status: string;
  appliedAt: string;
  job: {
    jobNumber: string;
    problemType: string;
    postcode: string;
    address: string;
    customer: { name: string };
  };
}

interface StripeStatus {
  connected: boolean;
  onboarded: boolean;
  verified: boolean;
  payoutsEnabled: boolean;
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

export default function AvailableJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [selectedJobForView, setSelectedJobForView] = useState<Job | null>(null);

  // Apply modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyingToJob, setApplyingToJob] = useState<Job | null>(null);
  const [assessmentFeeInput, setAssessmentFeeInput] = useState("");
  const [etaInput, setEtaInput] = useState("30");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stripe verification modal
  const [showStripeVerificationModal, setShowStripeVerificationModal] = useState(false);

  // New job notification
  const [newJobAlert, setNewJobAlert] = useState<string | null>(null);

  // Subscribe to job notifications
  const { isConnected } = useJobNotifications({
    locksmithId: user?.id,
    enabled: !!user?.id,
    onNewJob: (notification) => {
      // Show alert banner
      setNewJobAlert(`New job: ${notification.data.problemType} in ${notification.data.postcode}`);

      // Refresh jobs list
      fetchJobs();

      // Auto-hide after 10 seconds
      setTimeout(() => setNewJobAlert(null), 10000);
    },
  });

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);

      const currentAppliedJobIds: string[] = [];
      let hasLocation = false;

      if (user?.id) {
        // Fetch applications
        const appsResponse = await fetch(`/api/locksmith/applications?locksmithId=${user.id}`);
        const appsData = await appsResponse.json();
        if (appsData.success && appsData.applications) {
          setMyApplications(appsData.applications);
          for (const app of appsData.applications) {
            currentAppliedJobIds.push(app.jobId);
          }
          setAppliedJobIds(new Set(currentAppliedJobIds));
        }

        // Fetch profile for Stripe status and location
        const profileResponse = await fetch(`/api/locksmith/profile?locksmithId=${user.id}`);
        const profileData = await profileResponse.json();
        if (profileData.success && profileData.stripe) {
          setStripeStatus({
            connected: profileData.stripe.connected,
            onboarded: profileData.stripe.onboarded,
            verified: profileData.stripe.verified,
            payoutsEnabled: profileData.stripe.status?.payoutsEnabled || false,
          });
        }
        if (profileData.success && profileData.profile?.baseLat && profileData.profile?.baseLng) {
          hasLocation = true;
        }
      }

      // Always fetch jobs - allow viewing without Stripe
      const jobsUrl = user?.id && hasLocation
        ? `/api/jobs?status=PENDING&availableForLocksmith=${user.id}`
        : "/api/jobs?status=PENDING";

      const response = await fetch(jobsUrl);
      const data = await response.json();

      if (data.success) {
        const pendingJobs = data.jobs
          .filter((job: any) => !currentAppliedJobIds.includes(job.id))
          .map((job: any) => ({
            id: job.id,
            jobNumber: job.jobNumber,
            status: job.status,
            problemType: job.problemType,
            propertyType: job.propertyType,
            postcode: job.postcode,
            address: job.address,
            customer: job.customer || { name: "Customer", phone: "N/A" },
            createdAt: job.createdAt,
            applicationCount: job._count?.applications || 0,
            distanceMiles: job.distanceMiles || null,
          }));

        setJobs(pendingJobs);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleOpenApplyModal = (job: Job) => {
    if (appliedJobIds.has(job.id)) {
      return;
    }

    // Show job details first, then prompt for Stripe if needed
    if (!stripeStatus?.payoutsEnabled) {
      setSelectedJobForView(job);
      return;
    }

    setApplyingToJob(job);
    setAssessmentFeeInput("");
    setEtaInput("30");
    setShowApplyModal(true);
  };

  const handleViewJobDetails = (job: Job) => {
    setSelectedJobForView(job);
  };

  const handleSubmitApplication = async () => {
    if (!applyingToJob || !assessmentFeeInput || !user?.id) {
      return;
    }

    if (appliedJobIds.has(applyingToJob.id)) {
      setShowApplyModal(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${applyingToJob.id}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locksmithId: user.id,
          assessmentFee: Number.parseFloat(assessmentFeeInput),
          eta: Number.parseInt(etaInput),
          message: null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAppliedJobIds((prev) => new Set([...prev, applyingToJob.id]));
        setJobs(jobs.filter((job) => job.id !== applyingToJob.id));
        fetchJobs();
      }
    } catch (error) {
      console.error("Error submitting application:", error);
    } finally {
      setShowApplyModal(false);
      setApplyingToJob(null);
      setIsSubmitting(false);
    }
  };

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
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* New Job Alert Banner */}
      {newJobAlert && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-4 mb-6 text-white flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5" />
            <span className="font-medium">{newJobAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setNewJobAlert(null)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Available Jobs</h1>
          <p className="text-slate-500">
            {stripeStatus?.payoutsEnabled
              ? "Apply for jobs in your area"
              : "Browse jobs - Set up Stripe to apply"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchJobs} className="text-slate-600">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="hidden sm:inline">{isConnected ? 'Live updates' : 'Connecting...'}</span>
          </div>
        </div>
      </div>

      {/* Stripe Setup Alert - updated messaging */}
      {stripeStatus && !stripeStatus.payoutsEnabled && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-amber-800 font-medium">Complete Stripe setup to apply for jobs</p>
              <p className="text-xs text-amber-600 mt-0.5">
                You can browse all available jobs now. Set up Stripe to start applying and receiving payments.
              </p>
            </div>
            <Link href="/locksmith/earnings">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white whitespace-nowrap">
                Set Up Stripe
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Available Jobs */}
      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-slate-900">
          {jobs.length} {jobs.length === 1 ? "Job" : "Jobs"} Available
        </h2>

        {jobs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">No Available Jobs</h3>
            <p className="text-slate-500 text-sm">Check back soon for new jobs in your area</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-slate-500">{job.jobNumber}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Awaiting Offers
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-base sm:text-lg">
                      {problemLabels[job.problemType] || job.problemType}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Users className="w-4 h-4" />
                    <span className="text-lg font-bold">{job.applicationCount}</span>
                    <span className="text-xs text-slate-500">
                      {job.applicationCount === 1 ? "offer" : "offers"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-3 sm:gap-4 text-sm text-slate-600 mb-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {job.postcode}
                  </span>
                  {job.distanceMiles !== null && job.distanceMiles !== undefined && (
                    <span className="flex items-center gap-1 text-orange-600 font-medium">
                      {job.distanceMiles} miles
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {getTimeAgo(job.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {job.customer.name}
                  </span>
                </div>

                <p className="text-sm text-slate-500 truncate mb-4">{job.address}</p>

                <div className="flex gap-2">
                  {/* View Details button - always available */}
                  <Button
                    variant="outline"
                    onClick={() => handleViewJobDetails(job)}
                    className="flex-1 sm:flex-none text-slate-600"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>

                  {/* Apply button */}
                  <Button
                    onClick={() => handleOpenApplyModal(job)}
                    disabled={appliedJobIds.has(job.id)}
                    className={`flex-1 sm:flex-none ${
                      stripeStatus?.payoutsEnabled
                        ? "bg-orange-500 hover:bg-orange-600 text-white"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    <PoundSterling className="w-4 h-4 mr-2" />
                    {appliedJobIds.has(job.id) ? "Applied" : stripeStatus?.payoutsEnabled ? "Apply" : "Set Up to Apply"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Applications */}
      {myApplications.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Your Pending Applications ({myApplications.length})
          </h2>

          <div className="grid gap-4">
            {myApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-2xl shadow-sm border border-amber-200 p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-slate-500">{app.job.jobNumber}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Awaiting Customer
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900">
                      {problemLabels[app.job.problemType] || app.job.problemType}
                    </h3>
                    <p className="text-sm text-slate-500 truncate">{app.job.address}</p>
                    <p className="text-xs text-slate-400 mt-1">Applied {getTimeAgo(app.appliedAt)}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-orange-600">£{app.assessmentFee}</div>
                    <div className="text-xs text-slate-500">ETA: {app.eta} min</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Details Modal - for viewing without applying */}
      {selectedJobForView && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setSelectedJobForView(null)}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900">Job Details</h2>
              <button
                type="button"
                onClick={() => setSelectedJobForView(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-slate-500">{selectedJobForView.jobNumber}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    {selectedJobForView.applicationCount} offers
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 text-lg mb-1">
                  {problemLabels[selectedJobForView.problemType] || selectedJobForView.problemType}
                </h3>
                <p className="text-sm text-slate-600">{selectedJobForView.propertyType}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{selectedJobForView.postcode}</p>
                    <p className="text-sm text-slate-600">{selectedJobForView.address}</p>
                    {selectedJobForView.distanceMiles !== null && (
                      <p className="text-sm text-orange-600 font-medium mt-1">
                        {selectedJobForView.distanceMiles} miles from your location
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{selectedJobForView.customer.name}</p>
                    <p className="text-sm text-slate-500">Customer</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Posted {getTimeAgo(selectedJobForView.createdAt)}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(selectedJobForView.createdAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stripe prompt if not set up */}
              {(!stripeStatus || !stripeStatus.payoutsEnabled) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Set up Stripe to apply</p>
                      <p className="text-xs text-amber-600 mt-1">
                        Complete your payment setup to start applying for jobs and receiving payments.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex gap-3 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setSelectedJobForView(null)}
                className="flex-1"
              >
                Close
              </Button>
              {stripeStatus?.payoutsEnabled ? (
                <Button
                  onClick={() => {
                    setSelectedJobForView(null);
                    handleOpenApplyModal(selectedJobForView);
                  }}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <PoundSterling className="w-4 h-4 mr-2" />
                  Apply Now
                </Button>
              ) : (
                <Link href="/locksmith/earnings" className="flex-1">
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Set Up Stripe
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && applyingToJob && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setShowApplyModal(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900">Apply for Job</h2>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-500 mb-1">{applyingToJob.jobNumber}</div>
                <div className="font-semibold text-slate-900">
                  {problemLabels[applyingToJob.problemType] || applyingToJob.problemType}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  {applyingToJob.address}, {applyingToJob.postcode}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Your Assessment Fee
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  This fee covers your travel and diagnostic time.
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                    £
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="e.g. 35"
                    value={assessmentFeeInput}
                    onChange={(e) => setAssessmentFeeInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-lg font-semibold"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Typical range: £25-£49</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estimated Time of Arrival
                </label>
                <select
                  value={etaInput}
                  onChange={(e) => setEtaInput(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
                <strong>How it works:</strong>
                <ol className="mt-2 space-y-1 list-decimal list-inside text-blue-700">
                  <li>Customer sees your fee and ETA</li>
                  <li>They pay the assessment fee to confirm</li>
                  <li>You diagnose and create a work quote</li>
                  <li>Customer accepts or declines the quote</li>
                </ol>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex gap-3 flex-shrink-0 sticky bottom-0">
              <Button
                variant="outline"
                onClick={() => setShowApplyModal(false)}
                className="flex-1 py-3"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitApplication}
                disabled={!assessmentFeeInput || isSubmitting}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Verification Modal */}
      <StripeVerificationModal
        isOpen={showStripeVerificationModal}
        onClose={() => setShowStripeVerificationModal(false)}
        locksmithId={user?.id || ""}
        stripeStatus={stripeStatus || undefined}
      />
    </div>
  );
}
