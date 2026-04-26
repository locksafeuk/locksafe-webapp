"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  UserPlus,
  Users,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Home,
  Building,
  Building2,
  Car,
  Clock,
  Zap,
  Calendar,
  X,
  Check,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  onboardingCompleted: boolean;
  emailVerified: boolean;
  jobCount: number;
}

const problemTypes = [
  { id: "lockout", label: "Locked Out", icon: "🔒", description: "Can't get into property" },
  { id: "broken", label: "Broken Lock", icon: "🔧", description: "Lock damaged or not working" },
  { id: "key-stuck", label: "Key Stuck", icon: "🔑", description: "Key jammed in lock" },
  { id: "lost-keys", label: "Lost Keys", icon: "🗝️", description: "Need locks changed" },
  { id: "burglary", label: "After Burglary", icon: "🚨", description: "Emergency security needed" },
  { id: "other", label: "Other Issue", icon: "❓", description: "Something else" },
];

const propertyTypes = [
  { id: "house", label: "House", icon: Home },
  { id: "flat", label: "Flat/Apartment", icon: Building },
  { id: "commercial", label: "Commercial", icon: Building2 },
  { id: "car", label: "Vehicle", icon: Car },
];

const urgencyLevels = [
  { id: "emergency", label: "Emergency", icon: Zap, description: "Needs immediate help", color: "text-red-600 bg-red-50 border-red-200" },
  { id: "urgent", label: "Urgent", icon: Clock, description: "Within a few hours", color: "text-amber-600 bg-amber-50 border-amber-200" },
  { id: "scheduled", label: "Scheduled", icon: Calendar, description: "Can wait / book ahead", color: "text-blue-600 bg-blue-50 border-blue-200" },
];

export default function AdminCreateJobPage() {
  const router = useRouter();

  // Step management
  const [step, setStep] = useState(1);

  // Customer selection state
  const [customerMode, setCustomerMode] = useState<"search" | "create">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Job details
  const [jobDetails, setJobDetails] = useState({
    problemType: "",
    propertyType: "",
    urgency: "emergency",
    postcode: "",
    address: "",
    description: "",
  });

  // Postcode lookup
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [postcodeValid, setPostcodeValid] = useState(false);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);

  // Address suggestions from getAddress.io (via /api/postcode/lookup proxy)
  interface AddressSuggestion {
    line1: string;
    town: string;
    county?: string;
    postcode: string;
    formatted: string;
  }
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ jobNumber: string; isNewCustomer: boolean } | null>(null);

  // Customer search
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/admin/jobs/create?search=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.customers || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchCustomers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchCustomers]);

  // Postcode lookup — uses our proxy which calls getAddress.io for real
  // PAF-quality addresses (key stays server-side). Returns a list of real
  // addresses for the picker; we never fabricate one.
  const lookupPostcode = useCallback(async (postcode: string) => {
    const cleanPostcode = postcode.replace(/\s/g, "").toUpperCase();
    if (cleanPostcode.length < 5) {
      setPostcodeValid(false);
      setPostcodeError(null);
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
        setPostcodeValid(false);
        setPostcodeError("Invalid postcode");
        setAddressSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      if (!response.ok) {
        setPostcodeValid(false);
        setPostcodeError("Could not verify postcode");
        setAddressSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const data: {
        postcode: string;
        addresses: Array<{
          line1: string;
          town: string;
          county?: string;
          formatted: string;
        }>;
      } = await response.json();

      const mapped: AddressSuggestion[] = (data.addresses || []).map((a) => ({
        line1: a.line1,
        town: a.town,
        county: a.county,
        postcode: data.postcode,
        formatted: a.formatted,
      }));

      setPostcodeValid(true);
      setAddressSuggestions(mapped);
      setShowSuggestions(mapped.length > 0);
    } catch (error) {
      console.error("Postcode lookup error:", error);
      setPostcodeError("Could not verify postcode");
      setAddressSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  // Debounced postcode lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (jobDetails.postcode.length >= 5) {
        lookupPostcode(jobDetails.postcode);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [jobDetails.postcode, lookupPostcode]);

  // Step validation
  const isStep1Valid = () => {
    if (customerMode === "search") {
      return selectedCustomer !== null;
    }
    return newCustomer.name.trim().length > 0 && newCustomer.phone.trim().length > 0;
  };

  const isStep2Valid = () => {
    return (
      jobDetails.problemType &&
      jobDetails.propertyType &&
      jobDetails.postcode.length >= 5 &&
      jobDetails.address.trim().length > 0
    );
  };

  // Form submission
  const handleSubmit = async () => {
    if (!isStep2Valid()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, unknown> = {
        ...jobDetails,
      };

      if (customerMode === "search" && selectedCustomer) {
        payload.customerId = selectedCustomer.id;
      } else {
        payload.customerName = newCustomer.name;
        payload.customerPhone = newCustomer.phone;
        payload.customerEmail = newCustomer.email || undefined;
      }

      const response = await fetch("/api/admin/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setSubmitError(data.error || "Failed to create job");
        return;
      }

      setSubmitSuccess({
        jobNumber: data.job.jobNumber,
        isNewCustomer: data.job.customer.isNew,
      });
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitError("An error occurred while creating the job");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (submitSuccess) {
    return (
      <AdminSidebar>
        <div className="p-4 lg:p-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Job Created Successfully!
              </h1>
              <p className="text-lg font-mono text-orange-600 mb-4">
                {submitSuccess.jobNumber}
              </p>
              {submitSuccess.isNewCustomer ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-2" />
                  <p className="text-sm text-amber-800">
                    New customer will receive an onboarding email and SMS to set up their account.
                    The job will become active once they complete the setup.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-800">
                    The job is now active. Locksmiths in the area have been notified.
                  </p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/admin/jobs">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Jobs
                  </Button>
                </Link>
                <Button
                  onClick={() => {
                    setSubmitSuccess(null);
                    setStep(1);
                    setSelectedCustomer(null);
                    setNewCustomer({ name: "", phone: "", email: "" });
                    setJobDetails({
                      problemType: "",
                      propertyType: "",
                      urgency: "emergency",
                      postcode: "",
                      address: "",
                      description: "",
                    });
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Create Another Job
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AdminSidebar>
    );
  }

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/jobs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Create New Job</h1>
            <p className="text-sm text-slate-500">
              Create a job for an existing or new customer
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Step {step} of 2</span>
              <span className="text-sm text-slate-600">
                {step === 1 ? "Select Customer" : "Job Details"}
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-500"
                style={{ width: `${(step / 2) * 100}%` }}
              />
            </div>
          </div>

          {/* Step 1: Customer Selection */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
              {/* Mode toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode("search");
                    setSelectedCustomer(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                    customerMode === "search"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="hidden sm:inline">Existing Customer</span>
                  <span className="sm:hidden">Existing</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode("create");
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                    customerMode === "create"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                  <span className="hidden sm:inline">New Customer</span>
                  <span className="sm:hidden">New</span>
                </button>
              </div>

              {customerMode === "search" ? (
                <div className="space-y-4">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, phone, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500 animate-spin" />
                    )}
                  </div>

                  {/* Selected customer */}
                  {selectedCustomer && (
                    <div className="bg-orange-50 border-2 border-orange-500 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {selectedCustomer.name}
                            </p>
                            <p className="text-sm text-slate-600">
                              {selectedCustomer.phone}
                              {selectedCustomer.email && ` • ${selectedCustomer.email}`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(null)}
                          className="p-1 hover:bg-orange-100 rounded"
                        >
                          <X className="w-5 h-5 text-slate-500" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search results */}
                  {searchResults.length > 0 && !selectedCustomer && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {searchResults.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900">
                                {customer.name}
                              </p>
                              <p className="text-sm text-slate-500">
                                {customer.phone}
                                {customer.email && ` • ${customer.email}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-400">
                                {customer.jobCount} job{customer.jobCount !== 1 ? "s" : ""}
                              </span>
                              {customer.onboardingCompleted && (
                                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                  Verified
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                    <div className="text-center py-8 text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>No customers found</p>
                      <button
                        type="button"
                        onClick={() => setCustomerMode("create")}
                        className="mt-2 text-orange-600 hover:text-orange-700 text-sm font-medium"
                      >
                        Create new customer instead
                      </button>
                    </div>
                  )}

                  {!selectedCustomer && searchQuery.length < 2 && (
                    <p className="text-sm text-slate-500 text-center py-4">
                      Enter at least 2 characters to search
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, name: e.target.value })
                      }
                      placeholder="Full name"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="tel"
                        value={newCustomer.phone}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, phone: e.target.value })
                        }
                        placeholder="07XXX XXX XXX"
                        className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email (Optional)
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={newCustomer.email}
                        onChange={(e) =>
                          setNewCustomer({ ...newCustomer, email: e.target.value })
                        }
                        placeholder="customer@email.com"
                        className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Email is required for onboarding link. Customer will receive SMS if no email.
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setStep(2)}
                disabled={!isStep1Valid()}
                className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white py-4 text-base rounded-xl"
              >
                Continue to Job Details
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Job Details */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
              {/* Customer summary */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-slate-500 mb-1">Creating job for</p>
                <p className="font-semibold text-slate-900">
                  {customerMode === "search"
                    ? selectedCustomer?.name
                    : newCustomer.name}
                </p>
                <p className="text-sm text-slate-600">
                  {customerMode === "search"
                    ? selectedCustomer?.phone
                    : newCustomer.phone}
                </p>
              </div>

              <div className="space-y-6">
                {/* Problem Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Problem Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {problemTypes.map((problem) => (
                      <button
                        key={problem.id}
                        type="button"
                        onClick={() =>
                          setJobDetails({ ...jobDetails, problemType: problem.id })
                        }
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          jobDetails.problemType === problem.id
                            ? "border-orange-500 bg-orange-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{problem.icon}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">
                              {problem.label}
                            </p>
                            <p className="text-xs text-slate-500 truncate hidden sm:block">
                              {problem.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Property Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Property Type *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {propertyTypes.map((type) => {
                      const IconComponent = type.icon;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() =>
                            setJobDetails({ ...jobDetails, propertyType: type.id })
                          }
                          className={`py-3 px-2 sm:px-4 rounded-xl border-2 text-center transition-all ${
                            jobDetails.propertyType === type.id
                              ? "border-orange-500 bg-orange-50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <IconComponent
                            className={`w-5 h-5 mx-auto mb-1 ${
                              jobDetails.propertyType === type.id
                                ? "text-orange-500"
                                : "text-slate-400"
                            }`}
                          />
                          <p className="text-xs sm:text-sm font-medium text-slate-700">
                            {type.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Urgency
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {urgencyLevels.map((level) => {
                      const IconComponent = level.icon;
                      return (
                        <button
                          key={level.id}
                          type="button"
                          onClick={() =>
                            setJobDetails({ ...jobDetails, urgency: level.id })
                          }
                          className={`py-3 px-2 rounded-xl border-2 text-center transition-all ${
                            jobDetails.urgency === level.id
                              ? `${level.color} border-current`
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <IconComponent className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xs sm:text-sm font-medium">
                            {level.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Postcode */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Postcode *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={jobDetails.postcode}
                      onChange={(e) =>
                        setJobDetails({
                          ...jobDetails,
                          postcode: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="SW1A 1AA"
                      className={`w-full pl-12 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-base ${
                        postcodeError
                          ? "border-red-300 bg-red-50"
                          : postcodeValid
                          ? "border-green-300 bg-green-50"
                          : "border-slate-300"
                      }`}
                    />
                    {isLookingUp && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500 animate-spin" />
                    )}
                    {postcodeValid && !isLookingUp && (
                      <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                    )}
                  </div>
                  {postcodeError && (
                    <p className="text-xs text-red-500 mt-1">{postcodeError}</p>
                  )}
                </div>

                {/* Address suggestions */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Search className="w-3 h-3" />
                        Select address ({addressSuggestions.length} found) or enter manually below
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {addressSuggestions.map((address, index) => (
                        <button
                          key={`${address.formatted}-${index}`}
                          type="button"
                          onClick={() => {
                            setJobDetails({
                              ...jobDetails,
                              address: address.formatted,
                              postcode: address.postcode,
                            });
                            setShowSuggestions(false);
                          }}
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
                      className="w-full px-4 py-2 text-xs text-slate-500 hover:text-slate-700 bg-slate-50"
                    >
                      Enter address manually instead
                    </button>
                  </div>
                )}

                {!isLookingUp &&
                  !postcodeError &&
                  postcodeValid &&
                  addressSuggestions.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No address suggestions available — please type the address below.
                    </p>
                  )}

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full Address *
                  </label>
                  <AddressAutocomplete
                    value={jobDetails.address}
                    onChange={(address) => setJobDetails({ ...jobDetails, address })}
                    postcode={jobDetails.postcode}
                    placeholder="Start typing house number and street..."
                    inputClassName="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base resize-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Type at least 3 characters and pick from the list, or write the full address yourself.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    value={jobDetails.description}
                    onChange={(e) =>
                      setJobDetails({ ...jobDetails, description: e.target.value })
                    }
                    placeholder="Any additional information about the problem..."
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base resize-none"
                  />
                </div>


              </div>

              {/* Error message */}
              {submitError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {submitError}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 text-base rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!isStep2Valid() || isSubmitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-4 text-base rounded-xl"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Job
                      <CheckCircle2 className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminSidebar>
  );
}
