"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  KeyRound,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  User,
  ArrowRight,
  Building2,
  Phone,
  CheckCircle2,
  Shield,
  Clock,
  PoundSterling,
  MapPin,
  Navigation,
  ChevronDown,
} from "lucide-react";

// Radius options in miles
const RADIUS_OPTIONS = [
  { value: 5, label: "5 miles" },
  { value: 10, label: "10 miles" },
  { value: 15, label: "15 miles" },
  { value: 20, label: "20 miles" },
  { value: 25, label: "25 miles" },
  { value: 30, label: "30 miles" },
  { value: 50, label: "50 miles" },
];

export default function LocksmithSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Location & Coverage state
  const [baseLat, setBaseLat] = useState<number | null>(null);
  const [baseLng, setBaseLng] = useState<number | null>(null);
  const [baseAddress, setBaseAddress] = useState("");
  const [coverageRadius, setCoverageRadius] = useState(10);
  const [locationLoading, setLocationLoading] = useState(false);
  const [postcode, setPostcode] = useState("");

  // Get current location using browser geolocation
  const getCurrentLocation = async () => {
    setLocationLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setBaseLat(latitude);
        setBaseLng(longitude);

        // Reverse geocode to get address (using a free API)
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          if (data.display_name) {
            // Extract a shorter address
            const parts = data.display_name.split(", ");
            const shortAddress = parts.slice(0, 3).join(", ");
            setBaseAddress(shortAddress);
            // Try to extract postcode
            const postcodeMatch = data.display_name.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}/i);
            if (postcodeMatch) {
              setPostcode(postcodeMatch[0].toUpperCase());
            }
          }
        } catch (err) {
          console.error("Reverse geocoding failed:", err);
          setBaseAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }

        setLocationLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError("Could not get your location. Please enter your postcode manually.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Geocode postcode to coordinates
  const geocodePostcode = async () => {
    if (!postcode.trim()) {
      setError("Please enter a postcode");
      return;
    }

    setLocationLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(postcode)},UK&format=json&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setBaseLat(Number.parseFloat(lat));
        setBaseLng(Number.parseFloat(lon));
        // Extract a shorter address
        const parts = display_name.split(", ");
        const shortAddress = parts.slice(0, 3).join(", ");
        setBaseAddress(shortAddress);
      } else {
        setError("Could not find that postcode. Please check and try again.");
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
      setError("Failed to look up postcode. Please try again.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    // Location validation
    if (!baseLat || !baseLng) {
      setError("Please set your base location to continue");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/locksmiths/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          companyName,
          phone,
          baseLat,
          baseLng,
          baseAddress,
          coverageRadius,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/locksmith/dashboard");
          router.refresh();
        }, 2000);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Welcome to LockSafe!
            </h2>
            <p className="text-slate-600 mb-4">
              Your account has been created successfully.
            </p>
            <p className="text-sm text-slate-500">
              Redirecting to your dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative min-h-screen flex">
        {/* Left Panel - Benefits */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-900 p-12 flex-col justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 mb-12">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-7 h-7 text-white"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">
                Lock<span className="text-orange-500">Safe</span>
              </span>
            </Link>

            <h1 className="text-4xl font-bold text-white mb-6">
              Join the UK's fastest growing locksmith network
            </h1>
            <p className="text-lg text-slate-400 mb-12">
              Get instant access to high-quality job leads in your area. Set
              your own prices and work on your schedule.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Guaranteed Payment
                  </h3>
                  <p className="text-slate-400">
                    Customer's card is verified before you travel. Funds processed securely through Stripe Connect. No more payment disputes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Protection From False Claims
                  </h3>
                  <p className="text-slate-400">
                    GPS proves you arrived. Digital signature confirms customer approved the work. PDF documentation protects you.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <PoundSterling className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Set Your Own Rates
                  </h3>
                  <p className="text-slate-400">
                    You choose your assessment fee and quote prices. Keep 85% of every payment. Weekly payouts to your bank.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Work On Your Schedule
                  </h3>
                  <p className="text-slate-400">
                    Accept jobs when you want, where you want. Full control over your workload and coverage area.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    Local Job Alerts
                  </h3>
                  <p className="text-slate-400">
                    Get notified instantly when new jobs appear in your coverage area. Verified customers only.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800">
            <p className="text-slate-500 text-sm">
              Already a member?{" "}
              <Link
                href="/locksmith/login"
                className="text-orange-500 hover:text-orange-400 font-medium"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="w-full max-w-md my-8">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <Link href="/" className="inline-flex items-center gap-2 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="w-7 h-7 text-white"
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
              <h1 className="text-2xl font-bold text-slate-900">
                Join as a Locksmith
              </h1>
              <p className="text-slate-600 mt-2">
                Create your account and start earning
              </p>
            </div>

            {/* Desktop Title */}
            <div className="hidden lg:block mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Create your account
              </h2>
              <p className="text-slate-600">
                Fill in your details to get started
              </p>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-red-700 text-sm">{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="John Smith"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="companyName"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Company Name{" "}
                    <span className="text-slate-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="companyName"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="Smith's Locksmith Services"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="07123 456789"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {/* Location Section */}
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Your Base Location *
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    This is where you'll receive job notifications from. Jobs within your coverage radius will be shown to you.
                  </p>

                  {baseLat && baseLng ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-3">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-green-800">Location set</p>
                          <p className="text-sm text-green-700">{baseAddress || `${baseLat.toFixed(4)}, ${baseLng.toFixed(4)}`}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBaseLat(null);
                            setBaseLng(null);
                            setBaseAddress("");
                          }}
                          className="text-sm text-green-700 hover:text-green-800 underline"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Use current location button */}
                      <button
                        type="button"
                        onClick={getCurrentLocation}
                        disabled={locationLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl text-orange-700 font-medium transition-colors"
                      >
                        {locationLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Navigation className="w-5 h-5" />
                        )}
                        Use my current location
                      </button>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400">or enter postcode</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>

                      {/* Manual postcode entry */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input
                            type="text"
                            value={postcode}
                            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                            className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                            placeholder="e.g. SW1A 1AA"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={geocodePostcode}
                          disabled={locationLoading || !postcode.trim()}
                          className="bg-slate-900 hover:bg-slate-800 text-white px-4"
                        >
                          {locationLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            "Set"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coverage Radius */}
                <div>
                  <label
                    htmlFor="coverageRadius"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Coverage Radius *
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    How far are you willing to travel for jobs?
                  </p>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                      id="coverageRadius"
                      value={coverageRadius}
                      onChange={(e) => setCoverageRadius(Number(e.target.value))}
                      className="w-full pl-11 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all appearance-none bg-white"
                    >
                      {RADIUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-11 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="Min. 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={loading || !baseLat || !baseLng}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                  {(!baseLat || !baseLng) && (
                    <p className="text-xs text-amber-600 mt-2 text-center">
                      Please set your base location to continue
                    </p>
                  )}
                </div>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                By signing up, you agree to our{" "}
                <Link
                  href="/terms"
                  className="text-orange-600 hover:text-orange-700"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-orange-600 hover:text-orange-700"
                >
                  Privacy Policy
                </Link>
              </div>
            </div>

            {/* Mobile login link */}
            <div className="lg:hidden mt-6 text-center text-slate-600">
              Already have an account?{" "}
              <Link
                href="/locksmith/login"
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
