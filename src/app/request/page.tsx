"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import {
  ArrowRight,
  ArrowLeft,
  MapPin,
  Camera,
  Phone,
  Shield,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Image as ImageIcon,
  Search,
  Home,
  Building2,
  Car,
  Building,
} from "lucide-react";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { captureGPS } from "@/hooks/useGPS";
import { useTrackingEvents } from "@/hooks/useTrackingEvents";
import { getClientAttribution } from "@/lib/marketing/client-attribution";
import { trackEvent } from "@/lib/analytics/track-event";

const problemTypes = [
  { id: "lockout", label: "Locked Out", icon: "🔒", description: "Can't get into your property" },
  { id: "broken", label: "Broken Lock", icon: "🔧", description: "Lock is damaged or not working" },
  { id: "key-stuck", label: "Key Stuck", icon: "🔑", description: "Key is jammed in the lock" },
  { id: "lost-keys", label: "Lost Keys", icon: "🗝️", description: "Need locks changed" },
  { id: "burglary", label: "After Burglary", icon: "🚨", description: "Emergency security needed" },
  { id: "other", label: "Other Issue", icon: "❓", description: "Something else" },
];

// Contact channels. WhatsApp reuses the SAME number + flag as the existing
// job-page "continue on WhatsApp" CTA (src/app/customer/job/[id]/page.tsx), so
// one switch — NEXT_PUBLIC_CUSTOMER_WHATSAPP_CTA — controls WhatsApp sitewide and
// the number is never guessed. Inbound routes to customer Lockie when
// CUSTOMER_WHATSAPP_AGENTIC is on.
const SITE_PHONE_TEL = "+442045771989";
const SITE_PHONE_LABEL = "0204 577 1989";
const WHATSAPP_NUMBER = "447446588587";
const SHOW_WHATSAPP = process.env.NEXT_PUBLIC_CUSTOMER_WHATSAPP_CTA === "true";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hi LockSafe, I'm locked out and need a locksmith.",
)}`;

const propertyTypes = [
  { id: "house", label: "House", icon: Home },
  { id: "flat", label: "Flat/Apartment", icon: Building },
  { id: "commercial", label: "Commercial", icon: Building2 },
  { id: "car", label: "Auto Emergency", icon: Car },
];

// Request type context messages
const requestTypeContext: Record<string, { title: string; subtitle: string; urgentBanner?: boolean }> = {
  emergency: {
    title: "Emergency Lockout Help",
    subtitle: "We'll get a locksmith to you FAST. Average response: 15 minutes.",
    urgentBanner: true,
  },
  auto: {
    title: "Auto Emergency Locksmith Help",
    subtitle: "Locked out of your car? We'll find a nearby auto locksmith fast.",
    urgentBanner: true,
  },
  scheduled: {
    title: "Book a Locksmith",
    subtitle: "Schedule help for today or tomorrow.",
  },
  security: {
    title: "Security Upgrade Request",
    subtitle: "Get quotes for lock changes, upgrades, or security checks.",
  },
  commercial: {
    title: "Commercial/Property Request",
    subtitle: "Perfect for landlords and property managers. Multiple quotes, full documentation.",
  },
};

interface PostcodeAddress {
  line1: string;
  line2?: string;
  line3?: string;
  town: string;
  county?: string;
  postcode: string;
  formatted: string;
}

function RequestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestType = searchParams.get("type") || "emergency";
  const context = requestTypeContext[requestType] || requestTypeContext.emergency;

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { track, trackFormStarted, trackLead } = useTrackingEvents();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formStartTracked, setFormStartTracked] = useState(false);
  const [formData, setFormData] = useState({
    problemType: "",
    propertyType: "",
    postcode: "",
    address: "",
    phone: "",
    name: "",
    description: "",
    photos: [] as string[],
  });

  // Postcode lookup state
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<PostcodeAddress[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);

  // Animation state for selections
  const [recentlySelected, setRecentlySelected] = useState<string | null>(null);

  // Pre-fill form based on request type and user data
  useEffect(() => {
    // Pre-select problem type based on request type
    if (requestType === "emergency") {
      setFormData((prev) => ({ ...prev, problemType: prev.problemType || "lockout" }));
    } else if (requestType === "auto") {
      setFormData((prev) => ({
        ...prev,
        problemType: prev.problemType || "lockout",
        propertyType: prev.propertyType || "car",
      }));
    } else if (requestType === "security") {
      setFormData((prev) => ({ ...prev, problemType: prev.problemType || "lost-keys" }));
    }

    // Pre-select property type for commercial requests
    if (requestType === "commercial") {
      setFormData((prev) => ({ ...prev, propertyType: prev.propertyType || "commercial" }));
    }
  }, [requestType]);

  // Pre-fill form if user is authenticated
  useEffect(() => {
    if (isAuthenticated && user && user.type === "customer") {
      setFormData((prev) => ({
        ...prev,
        name: user.name || prev.name,
        phone: user.phone || prev.phone,
      }));
    }
  }, [isAuthenticated, user]);

  // Track form started when user enters postcode (step 2)
  useEffect(() => {
    if (step === 2 && !formStartTracked) {
      trackFormStarted("job_request");
      setFormStartTracked(true);
    }
  }, [step, formStartTracked, trackFormStarted]);

  // Postcode lookup function — proxies through our server which calls
  // getAddress.io for real PAF addresses (key stays server-side).
  const lookupPostcode = useCallback(async (postcode: string) => {
    const cleanPostcode = postcode.replace(/\s/g, "").toUpperCase();
    if (cleanPostcode.length < 5) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLookingUp(true);
    setPostcodeError(null);

    try {
      const response = await fetch(
        `/api/postcode/lookup?postcode=${encodeURIComponent(cleanPostcode)}`
      );

      if (response.status === 400) {
        setPostcodeError("Invalid postcode. Please check and try again.");
        setAddressSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      if (!response.ok) {
        setPostcodeError("Could not verify postcode. Please enter your address manually.");
        setAddressSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const data: {
        postcode: string;
        addresses: Array<{
          line1: string;
          line2?: string;
          line3?: string;
          town: string;
          county?: string;
          formatted: string;
        }>;
      } = await response.json();

      const mapped: PostcodeAddress[] = (data.addresses || []).map((a) => ({
        line1: a.line1,
        line2: a.line2,
        line3: a.line3,
        town: a.town,
        county: a.county,
        postcode: data.postcode,
        formatted: a.formatted,
      }));

      setAddressSuggestions(mapped);
      setShowSuggestions(mapped.length > 0);
    } catch (error) {
      console.error("Postcode lookup error:", error);
      setPostcodeError("Could not verify postcode. Please enter your address manually.");
      setAddressSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  // Debounced postcode lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.postcode.length >= 5) {
        lookupPostcode(formData.postcode);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.postcode, lookupPostcode]);

  const selectAddress = (address: PostcodeAddress) => {
    setFormData((prev) => ({
      ...prev,
      address: address.formatted,
      postcode: address.postcode,
    }));
    setShowSuggestions(false);
  };

  const handleSelectWithAnimation = (type: "problem" | "property", id: string) => {
    setRecentlySelected(id);
    setTimeout(() => setRecentlySelected(null), 300);

    if (type === "problem") {
      setFormData({ ...formData, problemType: id });
    } else {
      setFormData({ ...formData, propertyType: id });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    trackEvent("booking_submit", { step });

    // Track lead conversion
    trackLead(formData.postcode, 50); // £50 estimated lead value

    // GPS is an anti-fraud nice-to-have, NOT a gate. Cap the wait so the
    // browser geolocation permission prompt can never block/kill the submit —
    // the postcode is geocoded server-side regardless.
    const requestGps = await Promise.race([
      captureGPS(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);

    // Capture marketing attribution — visitor ID + any UTM/gclid present
    // on this page's URL. The server combines this with the visitor's
    // landing session to recover the originating Google/Meta click so
    // the Conversions API can credit it when the job completes.
    const attribution = getClientAttribution();

    // Create the job. Logged-in customers pass customerId; GUESTS pass
    // name+phone and /api/jobs creates the customer for them. Guests used to be
    // redirected to a full password-registration wall here — which killed
    // ~100% of cold ad traffic before a Job row was ever written. The backend
    // already supports anonymous booking, so we just use it.
    const isCustomer = isAuthenticated && user && user.type === "customer";
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isCustomer
            ? { customerId: user.id }
            : { name: formData.name, phone: formData.phone }),
          problemType: formData.problemType,
          propertyType: formData.propertyType,
          postcode: formData.postcode,
          address: formData.address || formData.postcode, // postcode is enough for dispatch geocoding
          description: formData.description,
          photos: formData.photos,
          requestGps, // Customer's GPS at request time (best-effort)
          ...attribution, // visitorId + utm_* + gclid + fbclid
        }),
      });

      const data = await response.json();

      if (response.ok && data.id) {
        track("lead", {
          jobId: data.id,
          postcode: formData.postcode,
          value: 50,
          serviceType: formData.problemType,
        });
        trackEvent("booking_job_created", { jobId: data.id, guest: !isCustomer });
        router.push(`/customer/job/${data.id}`);
        return;
      }

      // Show a real error instead of silently un-spinning the button.
      setSubmitError(
        data.error || "We couldn't submit your request. Please check your details and try again.",
      );
    } catch (error) {
      console.error("Failed to create job:", error);
      setSubmitError("Network error — please check your connection and try again.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="section-container py-3 sm:py-4">
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
              href="tel:+442045771989"
              className="flex items-center gap-2 text-orange-600 font-semibold text-sm sm:text-base"
            >
              <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">+44 20 4577 1989</span>
              <span className="sm:hidden">Call</span>
            </a>
          </div>
        </div>
      </header>

      <main className="section-container py-4 sm:py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Contact hero — call-first (most people call), then WhatsApp
              (Lockie books inbound), then the booking form below. Shown on the
              entry step only. */}
          {step === 1 && (
            <div className="mb-5 sm:mb-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs sm:text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-green-600" /> Insured
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" /> Vetted locksmiths
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-orange-500" /> ~15–30 min
                </span>
              </div>

              <a
                href={`tel:${SITE_PHONE_TEL}`}
                onClick={() => trackEvent("call_click", { source: "request_hero" })}
                className="flex items-center justify-center gap-3 w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-4 px-4 transition-colors"
              >
                <Phone className="w-6 h-6 flex-shrink-0" />
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-base sm:text-lg font-bold">Call now — {SITE_PHONE_LABEL}</span>
                  <span className="text-xs opacity-90">Talk to a locksmith now · 24/7</span>
                </span>
              </a>

              {SHOW_WHATSAPP && (
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("whatsapp_click", { source: "request_hero" })}
                  className="flex items-center justify-center gap-3 w-full rounded-2xl py-3.5 px-4 mt-3 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#25D366", color: "#07331b" }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 flex-shrink-0" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-base font-bold">Chat on WhatsApp</span>
                    <span className="text-xs">Send a photo · we&apos;ll book it for you</span>
                  </span>
                </a>
              )}

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-500">or book online · free · 30 sec</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </div>
          )}

          {/* Urgent Banner for Emergency */}
          {context.urgentBanner && step < 4 && (
            <div className="mb-4 sm:mb-6 bg-red-50 border border-red-200 rounded-xl sm:rounded-lg p-3 sm:p-4 flex items-start sm:items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-red-800 text-sm sm:text-base">{context.title}</p>
                <p className="text-xs sm:text-sm text-red-600">{context.subtitle}</p>
              </div>
            </div>
          )}

          {/* Context Banner for non-emergency */}
          {!context.urgentBanner && step < 4 && (
            <div className="mb-4 sm:mb-6 bg-orange-50 border border-orange-200 rounded-xl sm:rounded-lg p-3 sm:p-4">
              <p className="font-semibold text-orange-800 text-sm sm:text-base">{context.title}</p>
              <p className="text-xs sm:text-sm text-orange-600">{context.subtitle}</p>
            </div>
          )}

          {/* Progress indicator */}
          {step < 4 && (
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm text-slate-600">Step {step} of 3</span>
                <span className="text-xs sm:text-sm text-slate-600">
                  {step === 1 && "Problem Details"}
                  {step === 2 && "Location"}
                  {step === 3 && "Contact Info"}
                </span>
              </div>
              <div className="h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 1: Problem Type */}
          {step === 1 && (
            <div className="space-y-4 sm:space-y-6">
              <div className="text-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">
                  What's the problem?
                </h1>
                <p className="text-sm sm:text-base text-slate-600">
                  Select the issue you're experiencing
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {problemTypes.map((problem) => (
                  <button
                    key={problem.id}
                    type="button"
                    onClick={() => handleSelectWithAnimation("problem", problem.id)}
                    className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.98] ${
                      formData.problemType === problem.id
                        ? "border-orange-500 bg-orange-50 shadow-md shadow-orange-100"
                        : "border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm"
                    } ${recentlySelected === problem.id ? "scale-[0.97]" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-xl sm:text-2xl transition-transform duration-200 ${
                        formData.problemType === problem.id ? "scale-110" : ""
                      }`}>{problem.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-sm sm:text-base">
                          {problem.label}
                        </div>
                        <div className="text-xs sm:text-sm text-slate-500 truncate">
                          {problem.description}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                        formData.problemType === problem.id
                          ? "border-orange-500 bg-orange-500"
                          : "border-slate-300"
                      }`}>
                        {formData.problemType === problem.id && (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-3 sm:space-y-4">
                <label className="block">
                  <span className="text-xs sm:text-sm font-medium text-slate-700">
                    Property Type
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    {propertyTypes.map((type) => {
                      const IconComponent = type.icon;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => handleSelectWithAnimation("property", type.id)}
                          className={`py-3 sm:py-4 px-3 rounded-xl border-2 text-xs sm:text-sm font-medium transition-all duration-200 active:scale-[0.97] flex flex-col items-center gap-2 ${
                            formData.propertyType === type.id
                              ? "border-orange-500 bg-orange-50 text-orange-700 shadow-md shadow-orange-100"
                              : "border-slate-200 text-slate-600 hover:border-orange-300 hover:bg-orange-50/50"
                          } ${recentlySelected === type.id ? "scale-[0.95]" : ""}`}
                        >
                          <IconComponent className={`w-5 h-5 sm:w-6 sm:h-6 transition-all duration-200 ${
                            formData.propertyType === type.id ? "text-orange-500 scale-110" : "text-slate-400"
                          }`} />
                          <span>{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </label>
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!formData.problemType || !formData.propertyType}
                className="w-full btn-primary justify-center py-4 sm:py-6 text-base sm:text-lg"
              >
                Continue
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-4 sm:space-y-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="text-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">
                  Where do you need help?
                </h1>
                <p className="text-sm sm:text-base text-slate-600">
                  Enter your location so we can find nearby locksmiths
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <label className="block">
                  <span className="text-xs sm:text-sm font-medium text-slate-700">
                    Postcode *
                  </span>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. SW1A 1AA"
                      value={formData.postcode}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          postcode: e.target.value.toUpperCase(),
                        })
                      }
                      className={`w-full pl-9 sm:pl-10 pr-10 py-3 text-base border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors ${
                        postcodeError ? "border-red-300 bg-red-50" : "border-slate-300"
                      }`}
                    />
                    {isLookingUp && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500 animate-spin" />
                    )}
                    {!isLookingUp && formData.postcode.length >= 5 && !postcodeError && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                    )}
                  </div>
                  {postcodeError && (
                    <p className="text-xs text-red-500 mt-1">{postcodeError}</p>
                  )}
                </label>

                {/* Address suggestions dropdown */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Search className="w-3 h-3" />
                        Select your address
                      </p>
                      <span className="text-[11px] text-slate-400">
                        {addressSuggestions.length} found
                      </span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {addressSuggestions.map((address, index) => (
                        <button
                          key={`${address.formatted}-${index}`}
                          type="button"
                          onClick={() => selectAddress(address)}
                          className="w-full px-4 py-3 text-left hover:bg-orange-50 border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <div className="text-sm font-medium text-slate-900">{address.line1}</div>
                          <div className="text-xs text-slate-500">
                            {[address.town, address.county, address.postcode].filter(Boolean).join(", ")}
                          </div>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                      className="w-full px-4 py-2 text-xs text-slate-500 hover:text-slate-700 bg-slate-50 border-t border-slate-100"
                    >
                      Enter address manually instead
                    </button>
                  </div>
                )}

                {!isLookingUp &&
                  !postcodeError &&
                  formData.postcode.replace(/\s/g, "").length >= 5 &&
                  addressSuggestions.length === 0 && (
                    <p className="text-xs text-slate-500 -mt-1">
                      We couldn&apos;t find your address automatically — please type it in below.
                    </p>
                  )}

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                    Full Address
                  </label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(address) => setFormData((prev) => ({ ...prev, address }))}
                    postcode={formData.postcode}
                    placeholder="Start typing your house number and street..."
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Type at least 3 characters and pick from the list, or write the full address yourself.
                  </p>
                </div>

                <label className="block">
                  <span className="text-xs sm:text-sm font-medium text-slate-700">
                    Additional Details (Optional)
                  </span>
                  <textarea
                    placeholder="Any other details about the problem..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none mt-1 resize-none"
                  />
                </label>

                <ImageUploader
                  photoType="customer-initial"
                  uploadedBy="customer"
                  maxImages={5}
                  label="Add Photos (Optional)"
                  helpText="Photos help the locksmith prepare and give more accurate quotes"
                  onImagesChange={(urls) => setFormData({ ...formData, photos: urls })}
                />
              </div>

              <Button
                onClick={() => setStep(3)}
                disabled={!formData.postcode}
                className="w-full btn-primary justify-center py-4 sm:py-6 text-base sm:text-lg"
              >
                Continue
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 3: Contact Info */}
          {step === 3 && (
            <div className="space-y-4 sm:space-y-6">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="text-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">
                  Your Contact Details
                </h1>
                <p className="text-sm sm:text-base text-slate-600">
                  So the locksmith can reach you
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <label className="block">
                  <span className="text-xs sm:text-sm font-medium text-slate-700">
                    Your Name *
                  </span>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none mt-1"
                  />
                </label>

                <label className="block">
                  <span className="text-xs sm:text-sm font-medium text-slate-700">
                    Phone Number *
                  </span>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="07XXX XXX XXX"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full pl-9 sm:pl-10 pr-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                  </div>
                </label>
              </div>

              {/* Trust indicators */}
              <div className="bg-slate-100 rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3">
                <div className="flex items-start sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-700">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span>Anti-fraud protection with GPS & photo documentation</span>
                </div>
                <div className="flex items-start sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-700">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span>Average response time: 15-30 minutes</span>
                </div>
                <div className="flex items-start sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span>All locksmiths are verified and insured</span>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!formData.name || !formData.phone || isSubmitting}
                className="w-full btn-primary justify-center py-4 sm:py-6 text-base sm:text-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mr-2" />
                    <span className="truncate">Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <span className="truncate">Find My Locksmith</span>
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 flex-shrink-0" />
                  </>
                )}
              </Button>

              {submitError && (
                <p className="text-sm text-center text-red-600 mt-3" role="alert">
                  {submitError}
                </p>
              )}

              {!isAuthenticated && !authLoading && (
                <p className="text-xs sm:text-sm text-center text-slate-600">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      // Store request and redirect to login
                      const pendingRequest = {
                        problemType: formData.problemType,
                        propertyType: formData.propertyType,
                        postcode: formData.postcode,
                        address: formData.address,
                        description: formData.description,
                        name: formData.name,
                        phone: formData.phone,
                      };
                      sessionStorage.setItem("pending_request", JSON.stringify(pendingRequest));
                      router.push("/login");
                    }}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Login here
                  </button>
                </p>
              )}

              <p className="text-[10px] sm:text-xs text-center text-slate-500 px-4">
                By submitting, you agree to our{" "}
                <Link href="/terms" className="underline">
                  Terms & Conditions
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
              </p>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="text-center space-y-4 sm:space-y-6 py-8 sm:py-12">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">
                  Request Submitted!
                </h1>
                <p className="text-sm sm:text-base text-slate-600">
                  We're finding locksmiths in your area
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 sm:p-6 text-left max-w-md mx-auto">
                <h3 className="font-semibold text-slate-900 mb-2 sm:mb-3 text-sm sm:text-base">What happens next?</h3>
                <ol className="space-y-2 text-xs sm:text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 sm:w-5 sm:h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] sm:text-xs flex-shrink-0 mt-0.5">1</span>
                    <span>Nearby locksmiths will apply with their assessment fee and ETA</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 sm:w-5 sm:h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] sm:text-xs flex-shrink-0 mt-0.5">2</span>
                    <span>Choose a locksmith and pay their assessment fee to confirm</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 sm:w-5 sm:h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] sm:text-xs flex-shrink-0 mt-0.5">3</span>
                    <span>Once on-site, you'll receive a quote for the actual work</span>
                  </li>
                </ol>
              </div>

              <div className="animate-pulse mb-4">
                <p className="text-sm sm:text-base text-slate-600">
                  Searching for locksmiths near {formData.postcode}...
                </p>
              </div>

              <Link href="/customer/job/demo-job">
                <Button className="btn-primary text-sm sm:text-base py-3 sm:py-4 px-6">
                  View Available Locksmiths
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>

              <div className="pt-2 sm:pt-4">
                <Link href="/" className="text-slate-500 hover:text-slate-700 text-xs sm:text-sm">
                  Back to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function RequestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    }>
      <RequestPageContent />
    </Suspense>
  );
}
