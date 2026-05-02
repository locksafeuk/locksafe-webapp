"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { markLocksmithWalkthroughSeen } from "@/lib/cookies";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck,
  MapPin,
  PoundSterling,
  Shield,
  Wallet,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";

interface LocksmithWalkthroughProps {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
}

interface Step {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  body: React.ReactNode;
}

const steps: Step[] = [
  {
    id: "welcome",
    icon: Wrench,
    iconBg: "bg-gradient-to-br from-orange-500 to-amber-500",
    iconColor: "text-white",
    title: "Grow Your Locksmith Business",
    body: (
      <div className="space-y-3">
        <p className="text-slate-600">
          LockSafe is the UK's first anti-fraud locksmith platform. Before you
          apply, here's what you need to know about working with us.
        </p>
        <div className="space-y-2 pt-2">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <BadgeCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>Verified leads only</strong> — every customer is vetted
              before you see their job
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <PoundSterling className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>You set your own prices</strong> — assessment fee and work
              quote, every time
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <Wallet className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>No monthly fees</strong> — only pay commission when you
              win a job
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "commission",
    icon: PoundSterling,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "Simple, Transparent Commission",
    body: (
      <div className="space-y-3">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">15%</div>
              <p className="text-green-700 text-sm font-medium">
                Assessment Fee
              </p>
              <p className="text-green-600 text-xs">You keep 85%</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">25%</div>
              <p className="text-green-700 text-sm font-medium">Work Quote</p>
              <p className="text-green-600 text-xs">You keep 75%</p>
            </div>
          </div>
          <div className="text-center text-xs text-green-700 border-t border-green-200 pt-3">
            No subscription. No upfront costs. No hidden charges.
          </div>
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>Pay only when you earn</strong> — commission is taken at
              payout, not upfront
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>Fast payouts</strong> via Stripe Connect — straight to
              your bank
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "how-it-works",
    icon: Briefcase,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    title: "How You Get Jobs",
    body: (
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-blue-700 text-sm">
              1
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                Browse verified jobs
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                See real customer requests in your coverage area, with location
                & problem type.
              </p>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-blue-700 text-sm">
              2
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                Apply with your fee & ETA
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                You set the assessment fee. Customer picks the locksmith that
                works for them.
              </p>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-blue-700 text-sm">
              3
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                Travel & quote
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                GPS-tracked en route. On-site you diagnose and send a
                transparent work quote.
              </p>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-blue-700 text-sm">
              4
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                Complete & get paid
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Digital sign-off, photos, PDF report. Funds release to your
                Stripe account.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            <strong>Heads up:</strong> if you accept a job and don't arrive
            within ETA + 30 minutes, the customer is automatically refunded.
            Show up on time and you keep your assessment fee in full.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "requirements",
    icon: FileCheck,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    title: "What You'll Need to Apply",
    body: (
      <div className="space-y-3">
        <p className="text-slate-600 text-sm">
          The application takes about 5 minutes. Have these ready:
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                Public liability insurance
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Upload your certificate (PDF or image) and expiry date.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <Camera className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                Profile photo
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Helps customers recognise you on arrival and boosts trust.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CreditCard className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                Stripe Connect account
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                We'll guide you through this — needed to receive payouts.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <MapPin className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                Coverage area
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Postcode and radius — only see jobs you can actually take.
              </p>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-600 pt-1">
          Ready? Continue to the application form.
        </p>
      </div>
    ),
  },
];

export function LocksmithWalkthrough({
  open,
  onClose,
  onContinue,
}: LocksmithWalkthroughProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [hasFiredShown, setHasFiredShown] = useState(false);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
      if (!hasFiredShown) {
        setHasFiredShown(true);
        try {
          window.dispatchEvent(
            new CustomEvent("locksafe:locksmith_walkthrough", {
              detail: { event: "shown" },
            }),
          );
        } catch {
          /* ignore */
        }
      }
    }
  }, [open, hasFiredShown]);

  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;
  const current = steps[stepIndex];
  const Icon = current.icon;

  const fireEvent = (event: string) => {
    try {
      window.dispatchEvent(
        new CustomEvent("locksafe:locksmith_walkthrough", {
          detail: { event, step: stepIndex },
        }),
      );
    } catch {
      /* ignore */
    }
  };

  const handleSkip = () => {
    markLocksmithWalkthroughSeen();
    fireEvent("skipped");
    onClose();
  };

  const handleDismiss = (next: boolean) => {
    if (!next) {
      markLocksmithWalkthroughSeen();
      fireEvent("dismissed");
      onClose();
    }
  };

  const handleNext = () => {
    if (isLast) {
      markLocksmithWalkthroughSeen();
      fireEvent("completed");
      onContinue();
      return;
    }
    fireEvent(`step_${stepIndex + 1}`);
    setStepIndex((i) => i + 1);
  };

  const handleBack = () => {
    setStepIndex((i) => Math.max(0, i - 1));
  };

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header with progress + skip */}
        <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">
              Step {stepIndex + 1} of {steps.length}
            </span>
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Skip
            </button>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{
                width: `${((stepIndex + 1) / steps.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-5 sm:py-6 max-h-[65vh] overflow-y-auto">
          <div className="text-center mb-5">
            <div
              className={`w-16 h-16 sm:w-20 sm:h-20 ${current.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-4`}
            >
              <Icon
                className={`w-8 h-8 sm:w-10 sm:h-10 ${current.iconColor}`}
              />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900">
              {current.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Locksmith walkthrough, step {stepIndex + 1} of {steps.length}
            </DialogDescription>
          </div>
          <div>{current.body}</div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={isFirst}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Back</span>
          </Button>
          <Button
            type="button"
            onClick={handleNext}
            className="bg-orange-500 hover:bg-orange-600 text-white flex-1 sm:flex-initial"
          >
            {isLast ? "Continue to Application" : "Next"}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
