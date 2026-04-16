"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  Loader2,
  ChevronRight,
  Upload,
  PoundSterling,
  Clock,
  Wallet,
  FileCheck,
  X,
  BadgeCheck,
  Building2,
  Calendar,
  Camera,
  User,
  SkipForward,
} from "lucide-react";

interface LocksmithOnboardingModalProps {
  locksmithId: string;
  locksmithName: string;
  onComplete: () => void;
  onSkip?: () => void;
}

interface UploadedDocument {
  type: "insurance" | "certification" | "additional";
  url: string;
  name: string;
}

interface ProfilePhoto {
  url: string;
  name: string;
}

export function LocksmithOnboardingModal({
  locksmithId,
  locksmithName,
  onComplete,
  onSkip,
}: LocksmithOnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<ProfilePhoto | null>(null);

  // Document uploads
  const [insuranceDoc, setInsuranceDoc] = useState<UploadedDocument | null>(null);
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState<string>("");
  const [certificationDoc, setCertificationDoc] = useState<UploadedDocument | null>(null);
  const [additionalDocs, setAdditionalDocs] = useState<UploadedDocument[]>([]);

  const steps = [
    { id: "welcome", title: "Welcome" },
    { id: "commission", title: "Commission" },
    { id: "stripe", title: "Stripe Connect" },
    { id: "documents", title: "Documents" },
    { id: "terms", title: "Accept Terms" },
  ];

  const handleProfilePhotoUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.url) {
        setProfilePhoto({
          url: data.url,
          name: file.name,
        });
      } else {
        alert("Failed to upload photo. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("An error occurred during upload. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleFileUpload = useCallback(async (
    file: File,
    type: "insurance" | "certification" | "additional"
  ) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.url) {
        const doc: UploadedDocument = {
          type,
          url: data.url,
          name: file.name,
        };

        if (type === "insurance") {
          setInsuranceDoc(doc);
        } else if (type === "certification") {
          setCertificationDoc(doc);
        } else {
          setAdditionalDocs((prev) => [...prev, doc]);
        }
      } else {
        alert("Failed to upload file. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("An error occurred during upload. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const removeAdditionalDoc = (index: number) => {
    setAdditionalDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAcceptTerms = async () => {
    if (!termsAccepted || !insuranceDoc || !insuranceExpiryDate || !profilePhoto) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/locksmith/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locksmithId,
          profilePhotoUrl: profilePhoto.url,
          insuranceDocumentUrl: insuranceDoc?.url,
          insuranceExpiryDate,
          certificationDocumentUrl: certificationDoc?.url,
          additionalDocumentUrls: additionalDocs.map((d) => d.url),
        }),
      });

      const data = await response.json();
      if (data.success) {
        onComplete();
      } else {
        alert(data.error || "Failed to accept terms. Please try again.");
      }
    } catch (error) {
      console.error("Error accepting terms:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedFromWelcome = profilePhoto !== null;
  const canProceedToTerms = insuranceDoc !== null && insuranceExpiryDate !== "";

  const handleSkip = () => {
    // Store skip preference in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(`locksmith-onboarding-skipped-${locksmithId}`, "true");
    }
    onSkip?.();
    onComplete();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center py-4 sm:py-6">
            {/* Profile Photo Upload */}
            <div className="relative mx-auto mb-6">
              <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full mx-auto relative overflow-hidden border-4 transition-colors ${
                profilePhoto ? "border-green-400" : "border-dashed border-slate-300"
              }`}>
                {profilePhoto ? (
                  <Image
                    src={profilePhoto.url}
                    alt="Profile photo"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <User className="w-12 h-12 sm:w-14 sm:h-14 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Upload/Change button */}
              <label className={`absolute bottom-0 right-1/2 translate-x-1/2 translate-y-1/3 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center cursor-pointer transition-all shadow-lg ${
                profilePhoto
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}>
                {isUploading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProfilePhotoUpload(file);
                  }}
                />
              </label>

              {/* Uploaded indicator */}
              {profilePhoto && (
                <div className="absolute -top-1 -right-1 sm:right-[calc(50%-4rem)]">
                  <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Photo upload hint */}
            <div className={`mb-4 px-4 py-2 rounded-full inline-flex items-center gap-2 text-sm ${
              profilePhoto
                ? "bg-green-50 text-green-700"
                : "bg-orange-50 text-orange-700"
            }`}>
              {profilePhoto ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Profile photo uploaded
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Upload your profile photo
                  <span className="bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">Required</span>
                </>
              )}
            </div>

            {profilePhoto && (
              <button
                type="button"
                onClick={() => setProfilePhoto(null)}
                className="text-xs text-slate-500 hover:text-red-500 underline mb-4 block mx-auto"
              >
                Remove photo
              </button>
            )}

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              Welcome to LockSafe, {locksmithName.split(" ")[0]}!
            </h2>
            <p className="text-slate-600 text-base sm:text-lg max-w-md mx-auto">
              Thank you for joining the UK's first anti-fraud locksmith platform. Let's get you set up.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm max-w-sm mx-auto">
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
                <BadgeCheck className="w-5 h-5 text-green-500" />
                <span className="text-slate-700">Verified Platform</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
                <PoundSterling className="w-5 h-5 text-green-500" />
                <span className="text-slate-700">Low Commission</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
                <Wallet className="w-5 h-5 text-green-500" />
                <span className="text-slate-700">Fast Payments</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
                <Shield className="w-5 h-5 text-green-500" />
                <span className="text-slate-700">Anti-Fraud</span>
              </div>
            </div>

            {/* Why profile photo matters */}
            <div className="mt-6 bg-blue-50 rounded-xl p-4 text-sm text-left">
              <p className="text-blue-700">
                <strong>Why a profile photo?</strong> Customers feel more confident booking verified locksmiths with professional photos. It also helps customers recognize you when you arrive.
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="py-4 sm:py-6">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <PoundSterling className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 text-center">
              Platform Commission
            </h2>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">15%</div>
                  <p className="text-green-700 text-sm font-medium">Assessment Fee</p>
                  <p className="text-green-600 text-xs">You keep 85%</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">25%</div>
                  <p className="text-green-700 text-sm font-medium">Work Quote</p>
                  <p className="text-green-600 text-xs">You keep 75%</p>
                </div>
              </div>
              <div className="text-center text-sm text-green-600 border-t border-green-200 pt-3">
                Simple, transparent pricing with no hidden fees
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">No Monthly Fees</p>
                  <p className="text-xs text-slate-600">You only pay when you complete jobs</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">No Subscription</p>
                  <p className="text-xs text-slate-600">Zero upfront costs or hidden charges</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Automatic Calculation</p>
                  <p className="text-xs text-slate-600">Commission is auto-deducted when payment is processed</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 rounded-xl p-4 text-sm">
              <p className="text-blue-700">
                <strong>Example:</strong> For a £40 assessment + £200 work quote:
              </p>
              <ul className="text-blue-700 mt-2 space-y-1">
                <li>• Assessment: You receive <strong>£34</strong> (85% of £40)</li>
                <li>• Work Quote: You receive <strong>£150</strong> (75% of £200)</li>
                <li>• <strong>Total: £184</strong> for a £240 job</li>
              </ul>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="py-4 sm:py-6">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 text-center">
              Stripe Connect Setup
            </h2>
            <p className="text-slate-600 text-center mb-6">
              To receive payments, you'll need to connect your bank account through Stripe.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Why Stripe Connect?</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Stripe is the world's leading payment processor. It ensures secure, fast, and compliant payments directly to your bank account.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">What You'll Need</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Bank account details, government ID, and proof of address. The process takes about 5-10 minutes.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">When to Complete</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    You can start this after accepting terms. You'll find the Stripe setup in your Earnings page.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <strong>Important:</strong> You'll need to complete Stripe onboarding before you can receive payments for completed jobs.
                You can still apply for jobs while Stripe reviews your account.
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="py-4 sm:py-6">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileCheck className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 text-center">
              Upload Documents
            </h2>
            <p className="text-slate-600 text-center mb-6 text-sm">
              Please upload your documentation for verification. This helps us ensure all locksmiths meet our quality standards.
            </p>

            <div className="space-y-4">
              {/* Insurance Document - Required */}
              <div className={`border-2 rounded-xl p-4 transition-colors ${
                insuranceDoc ? "border-green-300 bg-green-50" : "border-dashed border-slate-300"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className={`w-5 h-5 ${insuranceDoc ? "text-green-600" : "text-slate-400"}`} />
                    <span className="font-medium text-slate-900">Insurance Document</span>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Required</span>
                  </div>
                  {insuranceDoc && (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <p className="text-sm text-slate-500 mb-3">
                  Public liability insurance certificate showing your coverage.
                </p>
                {insuranceDoc ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                      <div className="flex items-center gap-2 text-sm text-slate-700 truncate">
                        <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="truncate">{insuranceDoc.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setInsuranceDoc(null);
                          setInsuranceExpiryDate("");
                        }}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Insurance Expiry Date */}
                    <div className="bg-white rounded-lg p-3 border">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-orange-500" />
                          Insurance Expiry Date
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Required</span>
                        </div>
                      </label>
                      <input
                        type="date"
                        value={insuranceExpiryDate}
                        onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm"
                      />
                      {insuranceExpiryDate && (
                        <p className="text-xs text-slate-500 mt-2">
                          Expires: {new Date(insuranceExpiryDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 py-3 px-4 bg-white border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-600">Click to upload</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "insurance");
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Certification Document - Optional */}
              <div className={`border-2 rounded-xl p-4 transition-colors ${
                certificationDoc ? "border-green-300 bg-green-50" : "border-dashed border-slate-300"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className={`w-5 h-5 ${certificationDoc ? "text-green-600" : "text-slate-400"}`} />
                    <span className="font-medium text-slate-900">Locksmith Certification</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  {certificationDoc && (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <p className="text-sm text-slate-500 mb-3">
                  MLA, ALOA, or other locksmith certification documents.
                </p>
                {certificationDoc ? (
                  <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                    <div className="flex items-center gap-2 text-sm text-slate-700 truncate">
                      <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="truncate">{certificationDoc.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCertificationDoc(null)}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 py-3 px-4 bg-white border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-600">Click to upload</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "certification");
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Additional Documents */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-900">Additional Documents</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Optional</span>
                </div>
                <p className="text-sm text-slate-500 mb-3">
                  DBS check, trade certificates, or any other supporting documents.
                </p>
                {additionalDocs.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {additionalDocs.map((doc, index) => (
                      <div key={doc.url} className="flex items-center justify-between bg-green-50 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center gap-2 text-sm text-slate-700 truncate">
                          <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="truncate">{doc.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAdditionalDoc(index)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center justify-center gap-2 py-3 px-4 bg-white border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-600">Add more documents</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "additional");
                    }}
                  />
                </label>
              </div>
            </div>

            {isUploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-orange-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </div>
            )}

            <div className="mt-4 bg-blue-50 rounded-xl p-4 text-sm">
              <p className="text-blue-700">
                <strong>Note:</strong> Our admin team will review your documents before you can start accepting jobs.
                This usually takes 1-2 business days.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="py-4 sm:py-6">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 text-center">
              Accept Terms & Conditions
            </h2>
            <p className="text-slate-600 text-center mb-6">
              To use LockSafe as a locksmith partner, please accept our terms.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto text-sm text-slate-600 border">
              <h4 className="font-semibold text-slate-900 mb-2">Summary of Key Terms:</h4>
              <ul className="space-y-2 list-disc pl-5">
                <li>You are an independent contractor, not an employee of LockSafe.</li>
                <li>LockSafe charges 15% commission on assessment fees and 25% commission on work quotes.</li>
                <li>You must complete Stripe Connect onboarding to receive payments.</li>
                <li>You are required to document all jobs with photos, GPS check-ins, and customer signatures.</li>
                <li>You must arrive within your quoted ETA. Excessive no-shows may result in account suspension.</li>
                <li>For no-show refunds, you are charged the FULL refund amount (100%), not just your share. This includes the platform commission.</li>
                <li>You are responsible for maintaining valid insurance and any required certifications.</li>
                <li>Failure to meet quality standards may result in account termination.</li>
              </ul>
            </div>

            {(!insuranceDoc || !profilePhoto) && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  {!profilePhoto && !insuranceDoc
                    ? "Please upload your profile photo and insurance document in the previous steps before accepting terms."
                    : !profilePhoto
                    ? "Please upload your profile photo in the Welcome step before accepting terms."
                    : "Please upload your insurance document in the previous step before accepting terms."}
                </p>
              </div>
            )}

            <label className={`flex items-start gap-3 p-4 bg-white border-2 rounded-xl cursor-pointer transition-colors ${
              !canProceedToTerms || !profilePhoto ? "opacity-50 cursor-not-allowed border-slate-200" : "border-slate-200 hover:border-orange-300"
            }`}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={!canProceedToTerms || !profilePhoto}
                className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500 mt-0.5"
              />
              <span className="text-sm text-slate-700">
                I have read and agree to the{" "}
                <Link href="/terms" target="_blank" className="text-orange-600 hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="text-orange-600 hover:underline">
                  Privacy Policy
                </Link>
                . I understand the platform commission structure and my obligations as a LockSafe partner.
              </span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative">
        {/* Skip confirmation overlay */}
        {showSkipConfirm && (
          <div className="absolute inset-0 bg-white/95 z-10 flex items-center justify-center p-6 rounded-2xl sm:rounded-3xl">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Skip Setup?</h3>
              <p className="text-slate-600 text-sm mb-6">
                You won't be able to apply for jobs until you complete your profile, upload insurance documents, and set up Stripe payments.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowSkipConfirm(false)}
                  className="flex-1"
                >
                  Continue Setup
                </Button>
                <Button
                  onClick={handleSkip}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white"
                >
                  Skip for Now
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                You can complete this anytime from Settings
              </p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 flex-1">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    index <= currentStep ? "bg-orange-500" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
            {/* Skip button */}
            <button
              type="button"
              onClick={() => setShowSkipConfirm(true)}
              className="ml-4 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <SkipForward className="w-3 h-3" />
              Skip
            </button>
          </div>
          <p className="text-xs text-slate-500 text-center">
            Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-slate-50">
          <div className="flex gap-3">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex-1 sm:flex-none"
              >
                Back
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={(currentStep === 0 && !canProceedFromWelcome) || (currentStep === 3 && !canProceedToTerms)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleAcceptTerms}
                disabled={!termsAccepted || !canProceedToTerms || !profilePhoto || isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Accept & Continue
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
