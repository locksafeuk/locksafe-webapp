"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
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
  MapPin,
  Navigation,
  ChevronDown,
  CheckCircle2,
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

export default function LocksmithLoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/locksmiths/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh auth context to pick up the new session
        await refreshSession();
        router.push("/locksmith/dashboard");
        router.refresh();
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

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
        setSuccess("Registration successful! Redirecting...");
        // Refresh auth context to pick up the new session
        await refreshSession();
        setTimeout(() => {
          router.push("/locksmith/dashboard");
          router.refresh();
        }, 1500);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">LockSafe</span>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {isLogin ? "Locksmith Portal" : "Join LockSafe"}
          </h1>
          <p className="text-slate-600">
            {isLogin ? "Sign in to manage your jobs" : "Register as a locksmith partner"}
          </p>
        </div>

        {/* Login/Register Card */}
        <div className="bg-white rounded-2xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
          {/* Toggle Tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                isLogin
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                !isLogin
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            {/* Success Alert */}
            {success && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Registration Fields */}
            {!isLogin && (
              <>
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Smith"
                      required={!isLogin}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Company Name Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Company Name <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Smith Locksmiths Ltd"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Phone Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">+44</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="7700 900123"
                      required={!isLogin}
                      className="w-full pl-14 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
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
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Coverage Radius *
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    How far are you willing to travel for jobs?
                  </p>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                      value={coverageRadius}
                      onChange={(e) => setCoverageRadius(Number(e.target.value))}
                      className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none"
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
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isLogin ? "Enter your password" : "Create a password"}
                  required
                  minLength={6}
                  className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {!isLogin && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Must be at least 6 characters
                </p>
              )}
            </div>

            {/* Forgot Password (Login only) */}
            {isLogin && (
              <div className="text-right">
                <Link href="/forgot-password?type=locksmith" className="text-sm text-orange-600 hover:text-orange-700 transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}

            {/* Terms (Register only) */}
            {!isLogin && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-600">
                  I agree to the{" "}
                  <a href="#" className="text-orange-600 hover:underline">Terms of Service</a>
                  {" "}and{" "}
                  <a href="#" className="text-orange-600 hover:underline">Privacy Policy</a>
                </span>
              </label>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || (!isLogin && (!baseLat || !baseLng))}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {isLogin ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            {!isLogin && (!baseLat || !baseLng) && (
              <p className="text-xs text-amber-600 text-center">
                Please set your base location to continue
              </p>
            )}
          </form>

          {/* Benefits (Register only) */}
          {!isLogin && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Why join LockSafe?</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                  Get quality leads directly to your phone
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                  Fast payouts via Stripe Connect
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                  Build your reputation with verified reviews
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer Links */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-900 transition-colors">
            ← Back to website
          </Link>
          <span className="mx-3">•</span>

        </div>
      </div>
    </div>
  );
}
