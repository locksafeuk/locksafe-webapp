"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Zap,
  Gift,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Crown,
  Star,
} from "lucide-react";

interface SubscriptionStatus {
  isSubscriber: boolean;
  plan: string | null;
  status: string | null;
  freeCallouts: number;
  freeCalloutsTotal: number;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface ApiSubscription {
  status: string;
  plan: string;
  freeCallouts: number;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export default function CoverClient() {
  const { user } = useAuth();
  const router = useRouter();

  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      router.replace("/login");
      return;
    }
    fetch(`/api/subscriptions/status?customerId=${user.id}`)
      .then((r) => r.json())
      .then((data: { subscription: ApiSubscription | null }) => {
        const sub = data.subscription;
        if (sub) {
          setSubStatus({
            isSubscriber: ["active", "trialing"].includes(sub.status),
            plan: sub.plan,
            status: sub.status,
            freeCallouts: sub.freeCallouts,
            freeCalloutsTotal: 1,
            trialEnd: null,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          });
        } else {
          setSubStatus({
            isSubscriber: false,
            plan: null,
            status: null,
            freeCallouts: 0,
            freeCalloutsTotal: 1,
            trialEnd: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          });
        }
      })
      .catch(() => setError("Failed to load subscription status."))
      .finally(() => setLoading(false));
  }, [user, router]);

  const handleCheckout = async (plan: "cover_monthly" | "cover_annual") => {
    if (!user?.id) return;
    setCheckoutLoading(plan);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: user.id, plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Failed to start checkout. Please try again.");
      }
    } catch {
      setError("Failed to start checkout. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!user?.id || !confirm("Cancel your LockSafe Cover? Your benefits stay active until the end of the billing period.")) return;
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        setSubStatus((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
      } else {
        setError(data.error ?? "Failed to cancel. Contact support.");
      }
    } catch {
      setError("Failed to cancel. Contact support.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const isActive = subStatus?.isSubscriber && !subStatus?.cancelAtPeriodEnd;
  const isCanceling = subStatus?.isSubscriber && subStatus?.cancelAtPeriodEnd;
  const planLabel =
    subStatus?.plan === "cover_annual" ? "Annual Plan" : "Monthly Plan";

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <div className="bg-white border-b border-orange-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/customer/dashboard">
            <button className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            <span className="font-semibold text-slate-900">LockSafe Cover</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Active subscriber view */}
        {isActive && subStatus && (
          <div className="bg-white rounded-2xl shadow-sm border border-green-200 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Crown className="w-7 h-7" />
                <h1 className="text-xl font-bold">You&apos;re Covered!</h1>
              </div>
              <p className="opacity-90">{planLabel} · {subStatus.status === "trialing" ? "Free trial active" : "Active"}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-orange-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-orange-600">50%</div>
                  <div className="text-xs text-slate-500 mt-1">off every callout</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-green-600">
                    {subStatus.freeCallouts}/{subStatus.freeCalloutsTotal}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">free callouts left</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <div className="text-2xl font-bold text-blue-600">⚡</div>
                  <div className="text-xs text-slate-500 mt-1">priority dispatch</div>
                </div>
              </div>

              {subStatus.currentPeriodEnd && (
                <p className="text-sm text-slate-500 text-center">
                  Renews on{" "}
                  {new Date(subStatus.currentPeriodEnd).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}

              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleCancel}
              >
                Cancel Cover
              </Button>
            </div>
          </div>
        )}

        {/* Canceling (still active until period end) */}
        {isCanceling && subStatus && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h2 className="font-semibold text-amber-900 mb-1">Cover ending soon</h2>
            <p className="text-sm text-amber-700">
              Your Cover will remain active until{" "}
              {subStatus.currentPeriodEnd
                ? new Date(subStatus.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "the end of your billing period"}
              . After that you&apos;ll return to standard pricing.
            </p>
            <Button
              className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => handleCheckout(subStatus.plan === "cover_annual" ? "cover_annual" : "cover_monthly")}
              disabled={!!checkoutLoading}
            >
              Reactivate Cover
            </Button>
          </div>
        )}

        {/* Non-subscriber — pricing + benefits */}
        {!subStatus?.isSubscriber && (
          <>
            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-semibold">
                <Shield className="w-4 h-4" />
                Protect your home from unexpected locksmith costs
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900">LockSafe Cover</h1>
              <p className="text-slate-600 max-w-lg mx-auto">
                Save money every time you need a locksmith. Get half-price callouts, priority
                dispatch, and one free callout every month.
              </p>
            </div>

            {/* Benefits */}
            <div className="grid gap-4">
              {[
                {
                  icon: <Shield className="w-6 h-6 text-orange-500" />,
                  title: "50% off every callout",
                  description: "Your assessment fee is halved automatically at checkout — every single time.",
                  bg: "bg-orange-50",
                },
                {
                  icon: <Zap className="w-6 h-6 text-blue-500" />,
                  title: "Priority dispatch",
                  description:
                    "Your jobs reach more locksmiths in a wider area so you get help faster.",
                  bg: "bg-blue-50",
                },
                {
                  icon: <Gift className="w-6 h-6 text-green-500" />,
                  title: "1 free callout per month",
                  description: "Once a month, your assessment fee is completely waived. Resets automatically.",
                  bg: "bg-green-50",
                },
                {
                  icon: <Star className="w-6 h-6 text-amber-500" />,
                  title: "Cancel any time",
                  description: "No lock-ins. Cancel whenever you like — your benefits stay until the period ends.",
                  bg: "bg-amber-50",
                },
              ].map((b) => (
                <div key={b.title} className="bg-white rounded-xl border border-slate-100 p-5 flex gap-4">
                  <div className={`${b.bg} p-3 rounded-xl flex-shrink-0 h-12 w-12 flex items-center justify-center`}>
                    {b.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{b.title}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing cards */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Monthly */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col">
                <h2 className="font-bold text-slate-900 text-lg">Monthly</h2>
                <div className="mt-2 mb-4">
                  <span className="text-4xl font-extrabold text-orange-500">£9.99</span>
                  <span className="text-slate-400 ml-1">/month</span>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {["50% off callouts", "Priority dispatch", "1 free callout/month", "Cancel anytime"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => handleCheckout("cover_monthly")}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading === "cover_monthly" ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading...</>
                  ) : (
                    "Start 7-day free trial"
                  )}
                </Button>
                <p className="text-xs text-center text-slate-400 mt-2">No charge for 7 days. Cancel anytime.</p>
              </div>

              {/* Annual */}
              <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 flex flex-col text-white relative overflow-hidden">
                <div className="absolute top-3 right-3 bg-white text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  SAVE £40
                </div>
                <h2 className="font-bold text-lg">Annual</h2>
                <div className="mt-2 mb-4">
                  <span className="text-4xl font-extrabold">£79.99</span>
                  <span className="opacity-75 ml-1">/year</span>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {["Everything in Monthly", "2 months free vs monthly", "Annual receipt for expenses", "Priority support"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm opacity-90">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full bg-white text-orange-600 hover:bg-orange-50"
                  onClick={() => handleCheckout("cover_annual")}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading === "cover_annual" ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading...</>
                  ) : (
                    "Start 7-day free trial"
                  )}
                </Button>
                <p className="text-xs text-center opacity-70 mt-2">No charge for 7 days. Cancel anytime.</p>
              </div>
            </div>

            {/* Trust bar */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
              {["No lock-in contracts", "Cancel in 1 click", "Secure via Stripe", "Active on next callout"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
