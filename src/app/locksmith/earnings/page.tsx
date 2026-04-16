"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import {
  PoundSterling,
  TrendingUp,
  TrendingDown,
  Calendar,
  Star,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  CreditCard,
  Wallet,
  BarChart3,
  Briefcase,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  ArrowLeft,
  Info,
  ArrowDownRight,
} from "lucide-react";

interface EarningsData {
  totalEarnings: number;
  thisMonth: number;
  lastMonth: number;
  pendingPayout: number;
  averageJobValue: number;
  totalCompletedJobs: number;
  thisMonthJobs: number;
  platformFeeRate?: number;
  locksmithShareRate?: number;
  stripeTransferCount?: number;
  dataSource?: "stripe" | "calculated";
}

interface RecentJob {
  id: string;
  jobNumber: string;
  date: string;
  amount: number;
  totalValue?: number;
  type: string;
  status: string;
}

interface StripeTransfer {
  id: string;
  amount: number;
  currency: string;
  created: string;
  description?: string;
  metadata?: Record<string, string>;
}

interface StripeData {
  connected: boolean;
  onboarded: boolean;
  verified: boolean;
  accountId: string | null;
  status: {
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  } | null;
  balance: {
    available: Array<{ amount: number; currency: string }>;
    pending: Array<{ amount: number; currency: string }>;
  } | null;
  recentPayouts: Array<{
    id: string;
    amount: number;
    status: string;
    arrivalDate: Date;
  }> | null;
  recentTransfers: StripeTransfer[] | null;
}

interface ProfileData {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
  rating: number;
  reviewCount: number;
}

const problemLabels: Record<string, string> = {
  lockout: "Lockout",
  broken: "Lock Repair",
  "key-stuck": "Key Extraction",
  "lost-keys": "Key Replacement",
  burglary: "Security",
  other: "Other",
};

function LocksmithEarningsContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [stripe, setStripe] = useState<StripeData | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/locksmith/profile?locksmithId=${user.id}`);
      const data = await response.json();

      if (data.success) {
        setProfile(data.profile);
        setEarnings(data.earnings);
        setRecentJobs(data.recentJobs || []);
        setStripe(data.stripe);
      } else {
        setError(data.error || "Failed to load data");
      }
    } catch (err) {
      console.error("Error fetching earnings data:", err);
      setError("Failed to load earnings data");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check for Stripe Connect callback
  useEffect(() => {
    const stripeStatus = searchParams.get("stripe_connect");
    if (stripeStatus === "success") {
      setShowSuccessMessage(true);

      // Sync Stripe Connect status with our database
      const syncStripeStatus = async () => {
        if (user?.id) {
          try {
            console.log("[Earnings] Syncing Stripe Connect status after return from onboarding");
            const response = await fetch("/api/stripe-connect", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ locksmithId: user.id }),
            });
            const data = await response.json();
            console.log("[Earnings] Stripe Connect sync result:", data);
          } catch (err) {
            console.error("[Earnings] Failed to sync Stripe status:", err);
          }
        }
        // Refresh data to get updated Stripe status
        fetchData();
      };

      syncStripeStatus();

      // Clear the URL params
      window.history.replaceState({}, "", "/locksmith/earnings");
      setTimeout(() => setShowSuccessMessage(false), 5000);
    } else if (stripeStatus === "refresh") {
      // User needs to complete onboarding
      handleStripeConnect();
    }
  }, [searchParams, fetchData, user?.id]);

  const handleStripeConnect = async () => {
    if (!user?.id || !profile?.email) return;

    setIsConnecting(true);
    try {
      const response = await fetch("/api/stripe-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: profile.email,
          locksmithId: user.id,
          businessProfile: {
            name: profile.companyName || profile.name,
            phone: user.phone || "",
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        setError(data.error || "Failed to start Stripe setup");
      }
    } catch (err) {
      console.error("Error connecting Stripe:", err);
      setError("Failed to connect to Stripe");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    if (!stripe?.accountId) return;

    setIsLoadingDashboard(true);
    try {
      const response = await fetch(`/api/stripe-connect?accountId=${stripe.accountId}&action=login`);
      const data = await response.json();

      if (data.success && data.loginUrl) {
        window.open(data.loginUrl, "_blank");
      } else {
        // Fallback to Stripe dashboard
        window.open("https://dashboard.stripe.com", "_blank");
      }
    } catch {
      window.open("https://dashboard.stripe.com", "_blank");
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString();
  };

  const monthChange = earnings && earnings.lastMonth > 0
    ? ((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth) * 100
    : 0;

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading earnings data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-green-600 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Stripe account connected successfully!</span>
            <button onClick={() => setShowSuccessMessage(false)} className="ml-2 hover:bg-green-700 p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Earnings</h1>
        <p className="text-slate-500">Track your income and manage payouts</p>
      </div>

      <div>
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button onClick={fetchData} className="ml-auto text-red-600 hover:text-red-800">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Platform Fee Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-blue-800 font-medium">Your Earnings</p>
            <p className="text-blue-700 text-sm">
              All earnings shown are your share after platform fees: 15% on assessment fees (you keep 85%) and 25% on work quotes (you keep 75%).
              {earnings?.dataSource === "stripe" && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Live from Stripe
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Stripe Connect Banner - Show if not connected */}
        {!stripe?.connected && (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-1">Set Up Automatic Payouts</h2>
                  <p className="text-purple-100 text-sm max-w-lg">
                    Connect your bank account with Stripe to receive automatic payouts for completed jobs.
                    It only takes a few minutes and your funds will be deposited directly to your account.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleStripeConnect}
                disabled={isConnecting}
                className="bg-white text-purple-600 hover:bg-purple-50 font-semibold px-6"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect with Stripe
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Stripe Pending Verification Banner */}
        {stripe?.connected && !stripe?.status?.payoutsEnabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-amber-900 mb-1">Complete Your Stripe Setup</h2>
                  <p className="text-amber-700 text-sm max-w-lg">
                    Your Stripe account is connected but needs additional information before you can receive payouts.
                    Please complete the verification process.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleStripeConnect}
                disabled={isConnecting}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Complete Setup
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <PoundSterling className="w-4 h-4" />
              Total Earnings
            </div>
            <div className="text-2xl font-bold text-slate-900">
              £{earnings?.totalEarnings.toFixed(2) || "0.00"}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Your {earnings?.locksmithShareRate || 85}% share
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Calendar className="w-4 h-4" />
              This Month
            </div>
            <div className="text-2xl font-bold text-slate-900">
              £{earnings?.thisMonth.toFixed(2) || "0.00"}
            </div>
            {monthChange !== 0 && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${monthChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                {monthChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(monthChange).toFixed(1)}% vs last month
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Wallet className="w-4 h-4" />
              Available Balance
            </div>
            <div className="text-2xl font-bold text-orange-600">
              £{stripe?.balance?.available?.[0]?.amount?.toFixed(2) || "0.00"}
            </div>
            {stripe?.status?.payoutsEnabled ? (
              <div className="text-xs text-green-600 mt-1">Payouts enabled</div>
            ) : (
              <div className="text-xs text-slate-500 mt-1">Connect Stripe to withdraw</div>
            )}
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Briefcase className="w-4 h-4" />
              Completed Jobs
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {earnings?.totalCompletedJobs || 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {earnings?.thisMonthJobs || 0} this month
            </div>
          </div>
        </div>

        {/* Rating Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <div className="text-sm text-slate-500">Your Rating</div>
                {profile && profile.reviewCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-slate-900">{profile.rating.toFixed(1)}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= Math.round(profile.rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-slate-500">({profile.reviewCount} review{profile.reviewCount !== 1 ? "s" : ""})</span>
                  </div>
                ) : (
                  <div className="text-slate-400">No reviews yet</div>
                )}
              </div>
            </div>
            <Link href={`/locksmith/${profile?.id}`} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
              View Profile
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Jobs */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-900">Recent Jobs</h2>
              <Link href="/locksmith/dashboard" className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1">
                View All <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            {recentJobs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No completed jobs yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{problemLabels[job.type] || job.type}</div>
                        <div className="text-xs text-slate-500">{job.jobNumber} · {getTimeAgo(job.date)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">£{job.amount.toFixed(2)}</div>
                      {job.totalValue && job.totalValue !== job.amount && (
                        <div className="text-xs text-slate-400">
                          from £{job.totalValue.toFixed(2)} total
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stripe Status / Quick Stats */}
          <div className="space-y-6">
            {/* Stripe Connected Panel */}
            {stripe?.connected && stripe?.status?.payoutsEnabled && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg text-slate-900">Stripe Payouts</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenStripeDashboard}
                    disabled={isLoadingDashboard}
                  >
                    {isLoadingDashboard ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Dashboard
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-800">Account Verified</span>
                    </div>
                  </div>

                  {stripe.balance && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Available</span>
                        <span className="font-bold text-green-600">
                          £{stripe.balance.available?.[0]?.amount?.toFixed(2) || "0.00"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Pending</span>
                        <span className="font-medium text-slate-700">
                          £{stripe.balance.pending?.[0]?.amount?.toFixed(2) || "0.00"}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Recent Transfers from Stripe */}
                  {stripe.recentTransfers && stripe.recentTransfers.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <h3 className="text-sm font-medium text-slate-700 mb-2">Recent Transfers</h3>
                      <div className="space-y-2">
                        {stripe.recentTransfers.slice(0, 3).map((transfer) => (
                          <div key={transfer.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <ArrowDownRight className="w-4 h-4 text-green-500" />
                              <span className="text-slate-600">
                                {new Date(transfer.created).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                            </div>
                            <span className="font-medium text-green-600">
                              +£{transfer.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Performance Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Performance</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-400" />
                    <span className="text-sm text-slate-600">Rating</span>
                  </div>
                  <span className="font-bold text-slate-900">{profile?.rating?.toFixed(1) || "5.0"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-slate-600">Avg Job Value</span>
                  </div>
                  <span className="font-bold text-slate-900">£{earnings?.averageJobValue?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-500" />
                    <span className="text-sm text-slate-600">Last Month</span>
                  </div>
                  <span className="font-bold text-slate-900">£{earnings?.lastMonth?.toFixed(2) || "0.00"}</span>
                </div>
                {earnings?.stripeTransferCount !== undefined && earnings.stripeTransferCount > 0 && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-green-500" />
                      <span className="text-sm text-slate-600">Stripe Transfers</span>
                    </div>
                    <span className="font-bold text-slate-900">{earnings.stripeTransferCount}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function LocksmithEarningsPage() {
  return (
    <Suspense fallback={
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    }>
      <LocksmithEarningsContent />
    </Suspense>
  );
}
