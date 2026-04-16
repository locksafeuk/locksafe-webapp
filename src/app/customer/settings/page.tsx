"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Shield,
  Bell,
  X,
} from "lucide-react";
import NotificationSettings from "@/components/notifications/NotificationSettings";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  totalJobs: number;
  totalReviews: number;
  createdAt: string;
}

export default function CustomerSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<"profile" | "password" | "notifications">("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);

  // Resend verification
  const [isResending, setIsResending] = useState(false);

  // Email verification banner dismissal
  const [verificationBannerDismissed, setVerificationBannerDismissed] = useState(false);

  // Check if banner was dismissed in this session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = sessionStorage.getItem("email-verification-banner-dismissed");
      if (dismissed === "true") {
        setVerificationBannerDismissed(true);
      }
    }
  }, []);

  const handleDismissVerificationBanner = () => {
    setVerificationBannerDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("email-verification-banner-dismissed", "true");
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login?redirect=/customer/settings");
      return;
    }

    if (isAuthenticated && user?.type !== "customer") {
      router.push("/");
      return;
    }

    if (isAuthenticated) {
      fetchProfile();
    }
  }, [authLoading, isAuthenticated, user, router]);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/customer/profile");
      const data = await response.json();

      if (data.success) {
        setProfile(data.profile);
        setProfileForm({
          name: data.profile.name,
          phone: data.profile.phone,
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });

      const data = await response.json();

      if (data.success) {
        setProfile(prev => prev ? { ...prev, ...data.profile } : null);
        setMessage({ type: "success", text: "Profile updated successfully!" });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update profile" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to connect. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/customer/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: "Password changed successfully!" });
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to change password" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to connect. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (!profile?.email) return;

    setIsResending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send verification email" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to connect. Please try again." });
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="section-container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/customer/dashboard"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Link>
            </div>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-6 h-6 text-white"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-slate-900 hidden sm:inline">
                Lock<span className="text-orange-500">Safe</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="section-container py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Account Settings
          </h1>
          <p className="text-slate-600 mb-8">
            Manage your profile and account preferences
          </p>

          {/* Email verification banner - dismissible */}
          {profile && !profile.emailVerified && !verificationBannerDismissed && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3 relative animate-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 pr-8">
                <p className="font-medium text-amber-800">Verify your email address</p>
                <p className="text-sm text-amber-700 mt-1">
                  Please verify your email to access all features.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              </div>
              {/* Dismiss button */}
              <button
                type="button"
                onClick={handleDismissVerificationBanner}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-amber-200/50 text-amber-600 hover:text-amber-800 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              {message.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              {message.text}
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => { setActiveTab("profile"); setMessage(null); }}
                className={`flex-1 py-4 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  activeTab === "profile"
                    ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("password"); setMessage(null); }}
                className={`flex-1 py-4 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  activeTab === "password"
                    ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Lock className="w-4 h-4" />
                Password
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("notifications"); setMessage(null); }}
                className={`flex-1 py-4 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  activeTab === "notifications"
                    ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Notifications</span>
              </button>
            </div>

            <div className="p-6">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={profile?.email || ""}
                        disabled
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed"
                      />
                      {profile?.emailVerified && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-medium">Verified</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Email cannot be changed. Contact support if needed.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="btn-primary"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* Password Tab */}
              {activeTab === "password" && (
                <form onSubmit={handleChangePassword} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="At least 8 characters"
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        required
                      />
                    </div>
                    {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                      <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                    )}
                  </div>

                  <div className="pt-4 border-t flex items-center justify-between">
                    <Link href="/forgot-password" className="text-sm text-orange-600 hover:text-orange-700">
                      Forgot your password?
                    </Link>
                    <Button
                      type="submit"
                      disabled={isSaving || passwordForm.newPassword !== passwordForm.confirmPassword}
                      className="btn-primary"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Changing...
                        </>
                      ) : (
                        "Change Password"
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && profile && (
                <NotificationSettings
                  userId={profile.id}
                  userType="customer"
                />
              )}
            </div>
          </div>

          {/* Account Info Card */}
          {profile && (
            <div className="bg-white rounded-2xl shadow-sm p-6 mt-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                Account Information
              </h3>
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Member Since</p>
                  <p className="font-medium text-slate-900">
                    {new Date(profile.createdAt).toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Total Jobs</p>
                  <p className="font-medium text-slate-900">{profile.totalJobs}</p>
                </div>
                <div>
                  <p className="text-slate-500">Reviews Given</p>
                  <p className="font-medium text-slate-900">{profile.totalReviews}</p>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-6 border border-red-100">
            <h3 className="font-semibold text-red-600 mb-4">Danger Zone</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Sign Out</p>
                <p className="text-sm text-slate-500">Sign out of your account on this device</p>
              </div>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
