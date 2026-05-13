"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { siteConfig } from "@/lib/config";
import {
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  User,
  LogOut,
  Loader2,
  Phone,
  FileText,
  Settings,
  Gift,
  Copy,
  Check,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ClientOnboardingModal } from "@/components/onboarding/ClientOnboardingModal";

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  createdAt: string;
  locksmith?: {
    name: string;
    companyName?: string;
  };
}

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Finding Locksmiths", color: "bg-yellow-100 text-yellow-800" },
  ACCEPTED: { label: "Locksmith En Route", color: "bg-blue-100 text-blue-800" },
  ARRIVED: { label: "Locksmith Arrived", color: "bg-purple-100 text-purple-800" },
  DIAGNOSING: { label: "Diagnosing Issue", color: "bg-purple-100 text-purple-800" },
  QUOTED: { label: "Quote Received", color: "bg-orange-100 text-orange-800" },
  QUOTE_ACCEPTED: { label: "Work Approved", color: "bg-green-100 text-green-800" },
  QUOTE_DECLINED: { label: "Quote Declined", color: "bg-red-100 text-red-800" },
  IN_PROGRESS: { label: "Work In Progress", color: "bg-green-100 text-green-800" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800" },
  SIGNED: { label: "Signed Off", color: "bg-slate-100 text-slate-800" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

export default function CustomerDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout, setOnboardingCompleted } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Referral
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCredits, setReferralCredits] = useState(0);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralStats, setReferralStats] = useState<{ clicks: number; totalReferrals: number; totalEarned: number } | null>(null);

  // LockSafe Cover subscription
  const [subscription, setSubscription] = useState<{ status: string; plan: string; freeCallouts: number; currentPeriodEnd: string } | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login?redirect=/customer/dashboard");
      return;
    }

    if (!authLoading && isAuthenticated && user?.type !== "customer") {
      // Redirect to appropriate dashboard
      if (user?.type === "admin") {
        router.push("/admin");
      } else if (user?.type === "locksmith") {
        router.push("/locksmith/dashboard");
      }
      return;
    }

    if (isAuthenticated && user) {
      fetchJobs();
      fetchReferral();
      fetchSubscription();
      // Check if onboarding is needed
      if (user.onboardingCompleted === false) {
        setShowOnboarding(true);
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`/api/jobs?customerId=${user?.id}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setJobs(data);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const fetchReferral = async () => {
    try {
      const res = await fetch("/api/customer/referral");
      if (res.ok) {
        const data = await res.json();
        setReferralCode(data.code);
        setReferralCredits(data.availableCredits ?? 0);
        setReferralStats({ clicks: data.clicks, totalReferrals: data.totalReferrals, totalEarned: data.totalEarned });
      }
    } catch {
      // non-critical
    }
  };

  const copyReferralLink = () => {
    if (!referralCode) return;
    const url = `${window.location.origin}/ref/${referralCode}`;
    navigator.clipboard.writeText(url);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const fetchSubscription = async () => {
    try {
      if (!user?.id) return;
      const res = await fetch(`/api/subscriptions/status?customerId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription ?? null);
      }
    } catch {
      // non-critical
    }
  };

  async function startCoverCheckout(plan: "cover_monthly" | "cover_annual") {
    if (!user?.id) return;
    setCoverLoading(true);
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: user.id, plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setCoverLoading(false);
    }
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setOnboardingCompleted();
  };

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const activeJobs = jobs.filter((job) =>
    !["COMPLETED", "SIGNED", "CANCELLED", "QUOTE_DECLINED"].includes(job.status)
  );
  const completedJobs = jobs.filter((job) =>
    ["COMPLETED", "SIGNED"].includes(job.status)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Client Onboarding Modal */}
      {showOnboarding && user && (
        <ClientOnboardingModal
          customerId={user.id}
          customerName={user.name}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="section-container py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-6 h-6 text-white"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-slate-900">
                Lock<span className="text-orange-500">Safe</span>
              </span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              <a
                href="tel:07818333989"
                className="hidden sm:flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
              >
                <Phone className="w-4 h-4" />
                07818 333 989
              </a>
              <NotificationBell variant="light" />
              <Link
                href="/customer/settings"
                className="flex items-center gap-2 text-slate-600 hover:text-orange-600 transition-colors p-2"
              >
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 text-slate-600 hover:text-red-600 transition-colors p-2"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="section-container py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Welcome back, {user?.name?.split(" ")[0]}
              </h1>
              <p className="text-slate-600 mt-1">
                Manage your locksmith service requests
              </p>
            </div>
            <Link href="/request">
              <Button className="btn-primary">
                <Plus className="w-4 h-4" />
                New Request
              </Button>
            </Link>
          </div>
        </div>

        {/* Active Jobs */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Active Requests
          </h2>

          {isLoading ? (
            <div className="bg-white rounded-xl p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : activeJobs.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">No Active Requests</h3>
              <p className="text-slate-600 mb-4">
                You don&apos;t have any active locksmith requests at the moment.
              </p>
              <Link href="/request">
                <Button className="btn-primary">
                  <Plus className="w-4 h-4" />
                  Create Request
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/customer/job/${job.id}`}
                  className="bg-white rounded-xl p-5 border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            statusLabels[job.status]?.color || "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {statusLabels[job.status]?.label || job.status}
                        </span>
                        <span className="text-sm text-slate-500">
                          #{job.jobNumber}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900">
                        {problemLabels[job.problemType] || job.problemType}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.postcode}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {job.locksmith && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                            <User className="w-3 h-3 text-green-600" />
                          </div>
                          <span className="text-sm text-slate-700">
                            {job.locksmith.companyName || job.locksmith.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Completed Jobs */}
        {completedJobs.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Completed Jobs
            </h2>
            <div className="grid gap-4">
              {completedJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/customer/job/${job.id}`}
                  className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-all group opacity-75 hover:opacity-100"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Completed
                        </span>
                        <span className="text-sm text-slate-500">
                          #{job.jobNumber}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900">
                        {problemLabels[job.problemType] || job.problemType}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.postcode}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Referral Widget */}
        <section className="mt-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">Refer a Friend — Earn £10</h3>
                {referralCredits > 0 && (
                  <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                    £{referralCredits.toFixed(2)} credits available
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Share your link — your friend gets £10 off their first job, and you earn £10 credit when their job completes.
              </p>
              {referralCode && (
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm font-mono text-purple-700 truncate">
                    {typeof window !== "undefined" ? `${window.location.origin}/ref/${referralCode}` : `/ref/${referralCode}`}
                  </code>
                  <button
                    type="button"
                    onClick={copyReferralLink}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors shrink-0"
                  >
                    {referralCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {referralCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
              {referralStats && (referralStats.totalReferrals > 0 || referralStats.clicks > 0) && (
                <div className="mt-3 flex gap-4 text-xs text-slate-500">
                  <span>{referralStats.clicks} clicks</span>
                  <span>{referralStats.totalReferrals} successful referrals</span>
                  <span className="text-green-700 font-medium">£{referralStats.totalEarned.toFixed(2)} earned</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* LockSafe Cover Widget */}
        <section className="mt-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">LockSafe Cover</h3>
              {subscription && (subscription.status === "active" || subscription.status === "trialing") ? (
                <div>
                  <p className="text-sm text-green-700 font-medium mt-1">
                    Active {subscription.status === "trialing" ? "(Free trial)" : ""}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {subscription.freeCallouts} free callout{subscription.freeCallouts !== 1 ? "s" : ""} remaining · Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB")}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">50% off all callouts</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Priority dispatch</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">1 free callout/month</span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-600 mt-1">
                    Get 50% off all callouts, priority dispatch, and 1 free callout per month.
                  </p>
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={() => startCoverCheckout("cover_monthly")}
                      disabled={coverLoading}
                      className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      {coverLoading ? "Loading…" : "£9.99/month"}
                    </button>
                    <button
                      onClick={() => startCoverCheckout("cover_annual")}
                      disabled={coverLoading}
                      className="border border-amber-300 hover:bg-amber-50 disabled:opacity-50 text-amber-800 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      {coverLoading ? "…" : "£79.99/year (save 33%)"}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">7-day free trial · Cancel anytime</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Help Section */}
        <section className="mt-8 bg-orange-50 rounded-xl p-6 border border-orange-100">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Need Help?</h3>
              <p className="text-sm text-slate-600 mt-1">
                Our support team is available 24/7. Call us at{" "}
                <a href="tel:07818333989" className="text-orange-600 font-medium hover:underline">
                  07818 333 989
                </a>{" "}
                or email{" "}
                <a href={`mailto:${siteConfig.helpEmail}`} className="text-orange-600 font-medium hover:underline">
                  {siteConfig.helpEmail}
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
