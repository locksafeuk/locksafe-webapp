"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, MapPin, Wrench, Home, Building2, Car, CheckCircle, AlertCircle, ArrowRight, Clock, Shield } from "lucide-react";

interface PhoneJobData {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  description: string;
  phoneCollectedData: Record<string, unknown> | null;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
  };
}

const problemTypes = [
  { id: "lockout", label: "Locked Out", icon: "🔐", description: "Can't get in - keys inside or lost" },
  { id: "broken", label: "Broken Lock", icon: "🔧", description: "Lock damaged or not working" },
  { id: "key-stuck", label: "Key Stuck", icon: "🗝️", description: "Key broken or jammed in lock" },
  { id: "lost-keys", label: "Lost Keys", icon: "🔑", description: "Need new keys or locks changed" },
  { id: "lock-change", label: "Lock Change", icon: "🔒", description: "Want to upgrade or replace locks" },
  { id: "security-upgrade", label: "Security Upgrade", icon: "🛡️", description: "Better locks or security" },
  { id: "burglary", label: "After Burglary", icon: "⚠️", description: "Break-in damage repair" },
  { id: "other", label: "Other", icon: "❓", description: "Something else" },
];

const propertyTypes = [
  { id: "house", label: "House", icon: Home },
  { id: "flat", label: "Flat / Apartment", icon: Building2 },
  { id: "commercial", label: "Commercial", icon: Building2 },
  { id: "car", label: "Vehicle", icon: Car },
];

export default function ContinueRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobData, setJobData] = useState<PhoneJobData | null>(null);
  const [step, setStep] = useState(1);

  // Form state
  const [selectedProblem, setSelectedProblem] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [postcode, setPostcode] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchJobData();
  }, [resolvedParams.token]);

  const fetchJobData = async () => {
    try {
      const response = await fetch(`/api/continue-request/${resolvedParams.token}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Invalid or expired link");
        setLoading(false);
        return;
      }

      setJobData(data.job);

      // Pre-fill form with phone-collected data
      if (data.job.problemType) setSelectedProblem(data.job.problemType);
      if (data.job.propertyType) setSelectedProperty(data.job.propertyType);
      if (data.job.postcode) setPostcode(data.job.postcode);
      if (data.job.address) setAddress(data.job.address);
      if (data.job.description) setDescription(data.job.description);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching job data:", err);
      setError("Failed to load your request. Please try again.");
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!postcode || !address || !selectedProblem || !selectedProperty) {
      setError("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/continue-request/${resolvedParams.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemType: selectedProblem,
          propertyType: selectedProperty,
          postcode,
          address,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Failed to submit request");
        setSubmitting(false);
        return;
      }

      // Redirect to job page
      router.push(`/customer/job/${data.jobId}`);
    } catch (err) {
      console.error("Error submitting request:", err);
      setError("Failed to submit your request. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
          <p className="mt-4 text-slate-300">Loading your request...</p>
        </div>
      </div>
    );
  }

  if (error && !jobData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Link Invalid or Expired</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link
            href="/request"
            className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            Start New Request
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-4 text-sm text-slate-500">
            Or call us: <a href="tel:08001234567" className="text-orange-500 font-semibold">0800 123 4567</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-white">
            Lock<span className="text-orange-500">Safe</span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Phone className="h-4 w-4 text-orange-500" />
            <span>24/7 Emergency</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-start gap-4">
            <div className="bg-white/20 rounded-full p-3">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">Complete Your Emergency Request</h1>
              <p className="opacity-90">Hi {jobData?.customer.name}! We spoke on the phone. Just confirm a few details to get a locksmith dispatched.</p>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="bg-white/20 px-3 py-1 rounded-full font-mono">
                  Ref: {jobData?.jobNumber}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center ${s < 3 ? "flex-1" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                  step >= s
                    ? "bg-orange-500 text-white"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    step > s ? "bg-orange-500" : "bg-slate-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Step 1: Problem Type */}
          {step === 1 && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-2">What's the problem?</h2>
              <p className="text-slate-600 mb-6">Select the issue you're facing</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {problemTypes.map((problem) => (
                  <button
                    key={problem.id}
                    type="button"
                    onClick={() => setSelectedProblem(problem.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      selectedProblem === problem.id
                        ? "border-orange-500 bg-orange-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-2xl mb-2 block">{problem.icon}</span>
                    <span className="font-semibold text-slate-900 block text-sm">{problem.label}</span>
                    <span className="text-xs text-slate-500">{problem.description}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!selectedProblem}
                  className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Property & Location */}
          {step === 2 && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Location Details</h2>
              <p className="text-slate-600 mb-6">Confirm your property type and address</p>

              {/* Property Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">Property Type</label>
                <div className="grid grid-cols-4 gap-3">
                  {propertyTypes.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => setSelectedProperty(property.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selectedProperty === property.id
                          ? "border-orange-500 bg-orange-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <property.icon className={`h-6 w-6 mx-auto mb-2 ${
                        selectedProperty === property.id ? "text-orange-500" : "text-slate-400"
                      }`} />
                      <span className="font-medium text-slate-900 text-sm">{property.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Postcode */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Postcode</label>
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                  placeholder="e.g. SW1A 1AA"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-mono"
                />
              </div>

              {/* Address */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 123 High Street, London"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-slate-600 px-4 py-2 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!selectedProperty || !postcode || !address}
                  className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Review Your Request</h2>
              <p className="text-slate-600 mb-6">Check everything looks correct</p>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 rounded-lg p-2">
                    <Wrench className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Problem</p>
                    <p className="font-semibold text-slate-900">
                      {problemTypes.find(p => p.id === selectedProblem)?.label || selectedProblem}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 rounded-lg p-2">
                    <Home className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Property</p>
                    <p className="font-semibold text-slate-900">
                      {propertyTypes.find(p => p.id === selectedProperty)?.label || selectedProperty}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 rounded-lg p-2">
                    <MapPin className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Location</p>
                    <p className="font-semibold text-slate-900">{address}</p>
                    <p className="text-sm text-slate-600">{postcode}</p>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Additional Details (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any extra information that might help the locksmith..."
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Info Box */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900">What happens next?</p>
                    <ul className="mt-2 space-y-1 text-sm text-green-800">
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Local locksmiths will see your request immediately
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        You'll receive quotes with their ETA and assessment fee
                      </li>
                      <li className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        All locksmiths are verified and GPS-tracked
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-slate-600 px-4 py-2 hover:text-slate-900"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Request
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help Text */}
        <p className="text-center text-slate-400 text-sm mt-6">
          Need help? Call us at <a href="tel:08001234567" className="text-orange-400 font-semibold">0800 123 4567</a>
        </p>
      </main>
    </div>
  );
}
