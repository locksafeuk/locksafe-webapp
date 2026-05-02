"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { markWalkthroughSeen } from "@/lib/cookies";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  FileText,
  MapPin,
  RefreshCcw,
  Shield,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";

interface FirstVisitWalkthroughProps {
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
    icon: Shield,
    iconBg: "bg-gradient-to-br from-orange-500 to-amber-500",
    iconColor: "text-white",
    title: "Welcome to LockSafe",
    body: (
      <div className="space-y-3">
        <p className="text-slate-600">
          The UK's first anti-fraud locksmith platform. Before you submit your
          request, here's what makes us different.
        </p>
        <div className="space-y-2 pt-2">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>Verified locksmiths</strong> — insured &
              background-checked
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>Transparent pricing</strong> — full quote before any work
              starts
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>Legally-binding documentation</strong> on every job
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "verified",
    icon: BadgeCheck,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    title: "Only Verified Locksmiths",
    body: (
      <div className="space-y-3">
        <p className="text-slate-600">
          Every locksmith on LockSafe is vetted before they can apply for your
          job. No cowboys.
        </p>
        <div className="space-y-2 pt-2">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              Public liability insurance verified & expiry-tracked
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              Live GPS tracking — see your locksmith en route
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Star className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              Real customer ratings & reviews on every profile
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              Photos, signatures & a PDF report for every job
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "assessment-fee",
    icon: CreditCard,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    title: "How the Assessment Fee Works",
    body: (
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            The <strong>assessment fee</strong> covers the locksmith's travel
            and time to diagnose your problem. It's paid{" "}
            <strong>upfront</strong> when you confirm a booking.
          </p>
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>Separate from the work quote</strong> — you'll get a full
              repair quote on-site, with no obligation.
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>You choose the price</strong> — multiple locksmiths apply
              with their own fees. Pick what works for you.
            </span>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              <strong>No hidden charges</strong> — what you see is what you pay.
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "refund",
    icon: RefreshCcw,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "Auto-Refund Guarantee",
    body: (
      <div className="space-y-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-800">
              If they don't show up, you get your money back
            </h3>
          </div>
          <p className="text-sm text-green-700">
            If a locksmith fails to arrive within their agreed ETA plus a
            30-minute grace period, you receive a{" "}
            <strong>full automatic refund</strong> of your assessment fee.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              <strong>Note:</strong> Once the locksmith arrives the assessment
              fee is earned. You can still decline the work quote — you're never
              forced to commit to the repair.
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-600 pt-1">
          Ready to get help? Submit your request and verified locksmiths in your
          area will start applying.
        </p>
      </div>
    ),
  },
];

export function FirstVisitWalkthrough({
  open,
  onClose,
  onContinue,
}: FirstVisitWalkthroughProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [hasFiredShown, setHasFiredShown] = useState(false);

  // Reset to first step every time the modal opens fresh
  useEffect(() => {
    if (open) {
      setStepIndex(0);
      if (!hasFiredShown) {
        setHasFiredShown(true);
        try {
          window.dispatchEvent(
            new CustomEvent("locksafe:walkthrough", {
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
        new CustomEvent("locksafe:walkthrough", {
          detail: { event, step: stepIndex },
        }),
      );
    } catch {
      /* ignore */
    }
  };

  const handleSkip = () => {
    markWalkthroughSeen();
    fireEvent("skipped");
    onClose();
  };

  const handleDismiss = (next: boolean) => {
    if (!next) {
      markWalkthroughSeen();
      fireEvent("dismissed");
      onClose();
    }
  };

  const handleNext = () => {
    if (isLast) {
      markWalkthroughSeen();
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
          {/* Progress bar */}
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
              First-visit walkthrough, step {stepIndex + 1} of {steps.length}
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
            {isLast ? "Continue to Request" : "Next"}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
