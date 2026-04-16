"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  MapPin,
  Lock,
  ArrowRight,
  Shield,
  Clock,
  Phone,
  Edit2,
  Check,
} from "lucide-react";

interface OnboardingData {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
  };
  job: {
    id: string;
    jobNumber: string;
    problemType: string;
    propertyType: string;
    address: string;
    postcode: string;
  };
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

const propertyLabels: Record<string, string> = {
  house: "House",
  flat: "Flat/Apartment",
  commercial: "Commercial",
  car: "Vehicle",
};

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [step, setStep] = useState(1);

  // Form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validation
  const passwordsMatch = password === confirmPassword;
  const passwordValid = password.length >= 8;
  const canSubmit = passwordValid && passwordsMatch && !submitting;

  // Fetch onboarding data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/customer/onboard?token=${token}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          setError(result.error || "Invalid or expired onboarding link");
          return;
        }

        setData(result.data);
        setAddress(result.data.job.address);
        setPostcode(result.data.job.postcode);
      } catch (err) {
        setError("Failed to load onboarding data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleSubmit = async () => {
    if (!canSubmit || !data) return;

    setSubmitting(true);

    try {
      const response = await fetch("/api/customer/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          address,
          postcode,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error || "Failed to complete onboarding");
        setSubmitting(false);
        return;
      }

      setSuccess(true);

      // Redirect to job page after a short delay
      setTimeout(() => {
        router.push(`/customer/job/${data.job.id}`);
      }, 2000);
    } catch (err) {
      setError("Failed to complete onboarding");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your account setup...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Link Invalid or Expired
          </h1>
          <p className="text-slate-600 mb-6">
            {error || "This onboarding link is no longer valid."}
          </p>
          <Link href="/login">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Go to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Account Setup Complete!
          </h1>
          <p className="text-slate-600 mb-6">
            Your job {data.job.jobNumber} is now active. Locksmiths in your area
            are being notified.
          </p>
          <div className="flex items-center justify-center gap-2 text-orange-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Redirecting to your job...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-slate-900">
                Lock<span className="text-orange-500">Safe</span>
              </span>
            </Link>
            <a
              href="tel:07818333989"
              className="flex items-center gap-2 text-orange-600 font-semibold text-sm sm:text-base"
            >
              <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">07818 333 989</span>
              <span className="sm:hidden">Call</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Step {step} of 2</span>
            <span className="text-sm text-slate-600">
              {step === 1 ? "Create Password" : "Confirm Details"}
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>

        {/* Job Summary Card */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 sm:p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-orange-600 font-medium mb-1">
                Your Job
              </p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
                {data.job.jobNumber}
              </p>
            </div>
            <div className="px-3 py-1 bg-orange-100 rounded-full text-orange-700 text-sm font-medium">
              {problemLabels[data.job.problemType] || data.job.problemType}
            </div>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
            <span className="text-sm">
              {data.job.address}, {data.job.postcode}
            </span>
          </div>
        </div>

        {/* Step 1: Create Password */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-orange-600" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                Create Your Password
              </h1>
              <p className="text-slate-600">
                Set a secure password to access your account
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {password.length > 0 && !passwordValid && (
                  <p className="text-xs text-red-500 mt-1">
                    Password must be at least 8 characters
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-500 mt-1">
                    Passwords do not match
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!passwordValid || !passwordsMatch}
              className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white py-4 text-base rounded-xl"
            >
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Confirm Details */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-7 h-7 text-orange-600" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                Confirm Job Address
              </h1>
              <p className="text-slate-600">
                Make sure we have the correct location
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">
                    Address
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEditingAddress(!isEditingAddress)}
                    className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    {isEditingAddress ? (
                      <>
                        <Check className="w-4 h-4" /> Done
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-4 h-4" /> Edit
                      </>
                    )}
                  </button>
                </div>
                {isEditingAddress ? (
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base resize-none"
                  />
                ) : (
                  <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
                    {address}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Postcode
                </label>
                {isEditingAddress ? (
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                  />
                ) : (
                  <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono">
                    {postcode}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Type
                </label>
                <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
                  {propertyLabels[data.job.propertyType] ||
                    data.job.propertyType}
                </div>
              </div>
            </div>

            {/* Trust indicators */}
            <div className="bg-slate-50 rounded-xl p-4 mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>Anti-fraud protection with GPS tracking</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <Clock className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>Average response time: 15-30 minutes</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>All locksmiths are verified and insured</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 py-4 text-base rounded-xl"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || !address || !postcode}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-4 text-base rounded-xl"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Setting up...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Help text */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Need help?{" "}
          <a
            href="tel:07818333989"
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Call us
          </a>{" "}
          or email{" "}
          <a
            href="mailto:support@locksafe.uk"
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            support@locksafe.uk
          </a>
        </p>
      </main>
    </div>
  );
}
