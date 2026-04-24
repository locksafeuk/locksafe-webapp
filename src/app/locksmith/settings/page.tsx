"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Bell,
  Shield,
  CreditCard,
  ChevronRight,
  Loader2,
  Camera,
  Save,
  CheckCircle2,
  AlertCircle,
  Building2,
  Star,
  Navigation,
  ChevronDown,
  Map,
  FileText,
  Upload,
  X,
  Calendar,
  BadgeCheck,
  Clock,
  PoundSterling,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { AvailabilityToggle } from "@/components/locksmith/AvailabilityToggle";
import { AvailabilitySchedule } from "@/components/locksmith/AvailabilitySchedule";

// Dynamically import CoverageMap to avoid SSR issues with Leaflet
const CoverageMap = dynamic(
  () => import("@/components/maps/CoverageMap").then((mod) => mod.CoverageMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[250px] bg-slate-100 rounded-xl flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    ),
  }
);

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

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  rating: number;
  reviewCount: number;
  totalJobs: number;
  isVerified: boolean;
  coverageAreas: string[];
  profileImage: string | null;
  // Location & Coverage
  baseLat: number | null;
  baseLng: number | null;
  baseAddress: string | null;
  coverageRadius: number;
  // Pricing
  defaultAssessmentFee: number | null;
  // Insurance & Documentation
  insuranceDocumentUrl: string | null;
  insuranceExpiryDate: string | null;
  insuranceStatus: string | null;
  insuranceVerifiedAt: string | null;
  certificationDocumentUrl: string | null;
}

export default function LocksmithSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [coverageAreas, setCoverageAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Location & Coverage state
  const [baseLat, setBaseLat] = useState<number | null>(null);
  const [baseLng, setBaseLng] = useState<number | null>(null);
  const [baseAddress, setBaseAddress] = useState("");
  const [coverageRadius, setCoverageRadius] = useState(10);
  const [locationLoading, setLocationLoading] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [showLocationEditor, setShowLocationEditor] = useState(false);

  // Pricing state
  const [defaultAssessmentFee, setDefaultAssessmentFee] = useState<string>("");

  // Insurance state
  const [insuranceDocumentUrl, setInsuranceDocumentUrl] = useState<string | null>(null);
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState<string>("");
  const [insuranceStatus, setInsuranceStatus] = useState<string | null>(null);
  const [insuranceVerifiedAt, setInsuranceVerifiedAt] = useState<string | null>(null);
  const [uploadingInsurance, setUploadingInsurance] = useState(false);
  const [savingInsurance, setSavingInsurance] = useState(false);

  // Certification document state
  const [certificationDocumentUrl, setCertificationDocumentUrl] = useState<string | null>(null);
  const [uploadingCertification, setUploadingCertification] = useState(false);

  // Notification settings
  const [notifications, setNotifications] = useState({
    newJobs: true,
    applicationUpdates: true,
    paymentAlerts: true,
    marketingEmails: false,
  });

  // Push notifications
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    permission: pushPermission,
    isLoading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    showLocalNotification,
  } = usePushNotifications(user?.id);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`/api/locksmith/profile?locksmithId=${user.id}`);
        const data = await response.json();

        if (data.success && data.profile) {
          setProfile(data.profile);
          setName(data.profile.name || "");
          setPhone(data.profile.phone || "");
          setCompanyName(data.profile.companyName || "");
          setCoverageAreas(data.profile.coverageAreas || []);
          setProfileImage(data.profile.profileImage || null);
          // Location
          setBaseLat(data.profile.baseLat || null);
          setBaseLng(data.profile.baseLng || null);
          setBaseAddress(data.profile.baseAddress || "");
          setCoverageRadius(data.profile.coverageRadius || 10);
          // Pricing
          setDefaultAssessmentFee(data.profile.defaultAssessmentFee ? data.profile.defaultAssessmentFee.toString() : "");
          // Insurance
          setInsuranceDocumentUrl(data.profile.insuranceDocumentUrl || null);
          setInsuranceExpiryDate(data.profile.insuranceExpiryDate ? data.profile.insuranceExpiryDate.split("T")[0] : "");
          setInsuranceStatus(data.profile.insuranceStatus || null);
          setInsuranceVerifiedAt(data.profile.insuranceVerifiedAt || null);
          // Certification
          setCertificationDocumentUrl(data.profile.certificationDocumentUrl || null);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

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

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          if (data.display_name) {
            const parts = data.display_name.split(", ");
            const shortAddress = parts.slice(0, 3).join(", ");
            setBaseAddress(shortAddress);
          }
        } catch (err) {
          console.error("Reverse geocoding failed:", err);
          setBaseAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }

        setLocationLoading(false);
        setShowLocationEditor(false);
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
        const parts = display_name.split(", ");
        const shortAddress = parts.slice(0, 3).join(", ");
        setBaseAddress(shortAddress);
        setShowLocationEditor(false);
        setPostcode("");
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

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/locksmith/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locksmithId: user.id,
          name,
          phone,
          companyName,
          coverageAreas,
          baseLat,
          baseLng,
          baseAddress,
          coverageRadius,
          defaultAssessmentFee: defaultAssessmentFee ? Number.parseFloat(defaultAssessmentFee) : null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage("Profile updated successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || "Failed to update profile");
      }
    } catch (err) {
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please upload a JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > 4.5 * 1024 * 1024) {
      setError("Image must be smaller than 4.5MB");
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "profile");
      formData.append("uploadedBy", "locksmith");

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (uploadData.success) {
        // Update profile with new image
        const updateResponse = await fetch("/api/locksmith/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locksmithId: user.id,
            profileImage: uploadData.url,
          }),
        });

        const updateData = await updateResponse.json();

        if (updateData.success) {
          setProfileImage(uploadData.url);
          setSuccessMessage("Profile photo updated successfully");
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setError("Failed to save profile photo");
        }
      } else {
        setError(uploadData.error || "Failed to upload photo");
      }
    } catch (err) {
      setError("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addCoverageArea = () => {
    if (newArea.trim() && !coverageAreas.includes(newArea.trim().toUpperCase())) {
      setCoverageAreas([...coverageAreas, newArea.trim().toUpperCase()]);
      setNewArea("");
    }
  };

  const removeCoverageArea = (area: string) => {
    setCoverageAreas(coverageAreas.filter((a) => a !== area));
  };

  // Handle insurance document upload
  const handleInsuranceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPEG, PNG, WebP, or PDF file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File must be smaller than 10MB");
      return;
    }

    setUploadingInsurance(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "insurance");
      formData.append("uploadedBy", "locksmith");

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (uploadData.success) {
        setInsuranceDocumentUrl(uploadData.url);
        setSuccessMessage("Insurance document uploaded. Please set the expiry date and save.");
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(uploadData.error || "Failed to upload document");
      }
    } catch (err) {
      setError("Failed to upload document");
    } finally {
      setUploadingInsurance(false);
    }
  };

  // Save insurance details
  const handleSaveInsurance = async () => {
    if (!user?.id || !insuranceDocumentUrl || !insuranceExpiryDate) {
      setError("Please upload a document and set an expiry date");
      return;
    }

    // Validate expiry date is in the future
    const expiryDate = new Date(insuranceExpiryDate);
    if (expiryDate <= new Date()) {
      setError("Insurance expiry date must be in the future");
      return;
    }

    setSavingInsurance(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/locksmith/update-insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locksmithId: user.id,
          insuranceDocumentUrl,
          insuranceExpiryDate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setInsuranceStatus(data.locksmith.insuranceStatus);
        setSuccessMessage("Insurance details updated successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || "Failed to update insurance");
      }
    } catch (err) {
      setError("Failed to update insurance");
    } finally {
      setSavingInsurance(false);
    }
  };

  // Handle certification document upload
  const handleCertificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPEG, PNG, WebP, or PDF file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File must be smaller than 10MB");
      return;
    }

    setUploadingCertification(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "certification");
      formData.append("uploadedBy", "locksmith");

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (uploadData.success) {
        // Save the certification document URL
        const updateResponse = await fetch("/api/locksmith/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locksmithId: user.id,
            certificationDocumentUrl: uploadData.url,
          }),
        });

        const updateData = await updateResponse.json();

        if (updateData.success) {
          setCertificationDocumentUrl(uploadData.url);
          setSuccessMessage("Certification document uploaded successfully");
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setError(updateData.error || "Failed to save certification document");
        }
      } else {
        setError(uploadData.error || "Failed to upload document");
      }
    } catch (err) {
      setError("Failed to upload certification document");
    } finally {
      setUploadingCertification(false);
    }
  };

  // Remove certification document
  const handleRemoveCertification = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch("/api/locksmith/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locksmithId: user.id,
          certificationDocumentUrl: null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCertificationDocumentUrl(null);
        setSuccessMessage("Certification document removed");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError("Failed to remove certification document");
    }
  };

  // Calculate days until insurance expiry
  const getInsuranceExpiryInfo = () => {
    if (!insuranceExpiryDate) return null;
    const expiry = new Date(insuranceExpiryDate);
    const now = new Date();
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your profile and preferences</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-orange-500" />
            Profile Information
          </h2>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Profile Header */}
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="relative">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-orange-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "LS"}
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors">
                {uploadingPhoto ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="flex-1">
              <div className="font-semibold text-lg text-slate-900">{name || "Locksmith"}</div>
              <div className="text-sm text-slate-500">{user?.email}</div>
              <div className="flex items-center gap-2 mt-1">
                {profile?.isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <Shield className="w-3 h-3" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Pending Verification
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  {profile?.reviewCount && profile.reviewCount > 0 ? (
                    <>
                      {profile.rating.toFixed(1)}
                      <span className="text-slate-400">({profile.reviewCount})</span>
                    </>
                  ) : (
                    <span className="text-slate-400">No reviews yet</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="07700 900123"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="Smith Locksmiths Ltd"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-1">Contact support to change your email</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assessment Fee Setup */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <PoundSterling className="w-5 h-5 text-orange-500" />
            Assessment Fee
          </h2>
          <p className="text-sm text-slate-500 mt-1">Set your default assessment fee for jobs</p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Auto-dispatch eligibility banner */}
          {!defaultAssessmentFee ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Set up your assessment fee</p>
                  <p className="text-sm text-amber-700">You need to set an assessment fee to be eligible for auto-dispatch jobs</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Auto-dispatch eligible</p>
                  <p className="text-sm text-green-700">Your account can be auto-assigned to job requests</p>
                </div>
              </div>
            </div>
          )}

          {/* Assessment Fee Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Your Assessment Fee
            </label>
            <div className="relative">
              <PoundSterling className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="number"
                step="0.01"
                min="15"
                max="100"
                value={defaultAssessmentFee}
                onChange={(e) => setDefaultAssessmentFee(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                placeholder="e.g. 29.00"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              This is the fee customers pay upfront for your assessment. Typical range: £25 - £50
            </p>
          </div>

          {/* Info box about fees */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How assessment fees work:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• The assessment fee is a separate payment from the work quote</li>
                  <li>• You receive 85% of the assessment fee (15% platform commission)</li>
                  <li>• If the customer accepts your work quote, you receive 75% (25% commission)</li>
                  <li>• Assessment fees and work payments are processed separately</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Area - Radius Based */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            Coverage Area
          </h2>
          <p className="text-sm text-slate-500 mt-1">Set your base location and how far you're willing to travel</p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Current Location Display */}
          {baseLat && baseLng && !showLocationEditor ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-800">Base Location</p>
                  <p className="text-sm text-green-700">{baseAddress || `${baseLat.toFixed(4)}, ${baseLng.toFixed(4)}`}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationEditor(true)}
                  className="text-sm text-green-700 hover:text-green-800 underline"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Set your base location</p>
                    <p className="text-sm text-amber-700">You'll only see jobs within your coverage radius</p>
                  </div>
                </div>
              </div>

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

              {showLocationEditor && baseLat && baseLng && (
                <button
                  type="button"
                  onClick={() => setShowLocationEditor(false)}
                  className="text-sm text-slate-500 hover:text-slate-700 underline"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Coverage Radius */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Coverage Radius
            </label>
            <p className="text-xs text-slate-500 mb-3">
              How far are you willing to travel for jobs?
            </p>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select
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

          {/* Coverage Map Visual */}
          {baseLat && baseLng && !showLocationEditor && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Map className="w-4 h-4 text-orange-500" />
                  <label className="text-sm font-medium text-slate-700">
                    Your Coverage Area
                  </label>
                </div>
                <span className="text-xs text-slate-500">
                  {coverageRadius} mile radius
                </span>
              </div>
              <CoverageMap
                lat={baseLat}
                lng={baseLng}
                radiusMiles={coverageRadius}
                height="250px"
                showControls={true}
              />
              <p className="text-xs text-slate-500 mt-2 text-center">
                You will only see jobs within this area
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Insurance Documents */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            Insurance & Documentation
          </h2>
          <p className="text-sm text-slate-500 mt-1">Keep your insurance certificate up to date</p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Insurance Status Banner */}
          {insuranceStatus && (
            <div className={`p-4 rounded-xl border-2 ${
              insuranceStatus === "expired"
                ? "bg-red-50 border-red-200"
                : insuranceStatus === "expiring_soon"
                ? "bg-amber-50 border-amber-200"
                : insuranceStatus === "verified"
                ? "bg-green-50 border-green-200"
                : "bg-blue-50 border-blue-200"
            }`}>
              <div className="flex items-start gap-3">
                {insuranceStatus === "expired" ? (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                ) : insuranceStatus === "expiring_soon" ? (
                  <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                ) : insuranceStatus === "verified" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${
                    insuranceStatus === "expired"
                      ? "text-red-800"
                      : insuranceStatus === "expiring_soon"
                      ? "text-amber-800"
                      : insuranceStatus === "verified"
                      ? "text-green-800"
                      : "text-blue-800"
                  }`}>
                    {insuranceStatus === "expired"
                      ? "Insurance Expired"
                      : insuranceStatus === "expiring_soon"
                      ? "Insurance Expiring Soon"
                      : insuranceStatus === "verified"
                      ? "Insurance Verified"
                      : "Insurance Pending Verification"}
                  </p>
                  <p className={`text-sm mt-1 ${
                    insuranceStatus === "expired"
                      ? "text-red-700"
                      : insuranceStatus === "expiring_soon"
                      ? "text-amber-700"
                      : insuranceStatus === "verified"
                      ? "text-green-700"
                      : "text-blue-700"
                  }`}>
                    {insuranceStatus === "expired"
                      ? "Please upload a new insurance certificate to continue accepting jobs."
                      : insuranceStatus === "expiring_soon"
                      ? `Your insurance expires in ${getInsuranceExpiryInfo()} days. Please renew soon.`
                      : insuranceStatus === "verified"
                      ? "Your insurance has been verified by our team."
                      : "Our team will review your insurance certificate shortly."}
                  </p>
                  {insuranceVerifiedAt && insuranceStatus === "verified" && (
                    <p className="text-xs text-green-600 mt-1">
                      Verified on {new Date(insuranceVerifiedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Current Insurance Document */}
          {insuranceDocumentUrl && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Insurance Certificate</p>
                    <p className="text-sm text-slate-500">
                      {insuranceExpiryDate
                        ? `Expires: ${new Date(insuranceExpiryDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}`
                        : "Expiry date not set"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={insuranceDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setInsuranceDocumentUrl(null);
                      setInsuranceExpiryDate("");
                    }}
                    className="text-slate-400 hover:text-red-500 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload New Document */}
          {!insuranceDocumentUrl && (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <p className="font-medium text-slate-900 mb-1">Upload Insurance Certificate</p>
                <p className="text-sm text-slate-500 mb-4">PDF, JPEG, PNG, or WebP (max 10MB)</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg cursor-pointer transition-colors">
                  {uploadingInsurance ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Choose File
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleInsuranceUpload}
                    disabled={uploadingInsurance}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Expiry Date */}
          {insuranceDocumentUrl && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  Insurance Expiry Date
                </div>
              </label>
              <input
                type="date"
                value={insuranceExpiryDate}
                onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
              {insuranceExpiryDate && (
                <p className="text-sm text-slate-500 mt-2">
                  {getInsuranceExpiryInfo() !== null && getInsuranceExpiryInfo()! > 0
                    ? `Expires in ${getInsuranceExpiryInfo()} days`
                    : "Date is in the past - please select a future date"}
                </p>
              )}
            </div>
          )}

          {/* Save Insurance Button */}
          {insuranceDocumentUrl && (
            <div className="pt-4 border-t border-slate-100">
              <Button
                onClick={handleSaveInsurance}
                disabled={savingInsurance || !insuranceExpiryDate}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
              >
                {savingInsurance ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save Insurance Details
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Certification Document Section */}
          <div className="pt-6 border-t border-slate-200">
            <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-blue-500" />
              Locksmith Certification
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-normal">Optional</span>
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Upload your MLA, ALOA, or other locksmith certification document.
            </p>

            {certificationDocumentUrl ? (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <BadgeCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Certification Document</p>
                      <p className="text-sm text-green-600">Document uploaded</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={certificationDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </a>
                    <label className="text-sm text-orange-600 hover:text-orange-800 font-medium cursor-pointer">
                      Replace
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleCertificationUpload}
                        disabled={uploadingCertification}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveCertification}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BadgeCheck className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-900 mb-1">Upload Certification</p>
                  <p className="text-sm text-slate-500 mb-4">PDF, JPEG, PNG, or WebP (max 10MB)</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg cursor-pointer transition-colors">
                    {uploadingCertification ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Choose File
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleCertificationUpload}
                      disabled={uploadingCertification}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Availability Status */}
      {user?.id && (
        <div className="mb-6">
          <AvailabilityToggle
            locksmithId={user.id}
            onToggle={(isAvailable) => {
              setSuccessMessage(
                isAvailable
                  ? "You are now available for jobs"
                  : "You are now unavailable"
              );
              setTimeout(() => setSuccessMessage(null), 3000);
            }}
          />
        </div>
      )}

      {/* Availability Schedule */}
      {user?.id && (
        <div className="mb-6">
          <AvailabilitySchedule
            locksmithId={user.id}
            onUpdate={() => {
              setSuccessMessage("Schedule updated successfully");
              setTimeout(() => setSuccessMessage(null), 3000);
            }}
          />
        </div>
      )}

      {/* Notification Settings */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-500" />
            Notifications
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {/* Push Notifications Toggle */}
          {pushSupported && (
            <div className="p-4 sm:px-6 flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50">
              <div>
                <div className="font-medium text-slate-900 flex items-center gap-2">
                  Push Notifications
                  {pushSubscribed && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {pushPermission === "denied"
                    ? "Notifications blocked. Enable in browser settings."
                    : "Receive instant alerts on your device"}
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (pushSubscribed) {
                    await unsubscribePush();
                  } else {
                    const result = await subscribePush();
                    if (result) {
                      showLocalNotification("Notifications Enabled", {
                        body: "You'll now receive alerts for new jobs and updates!",
                      });
                    }
                  }
                }}
                disabled={pushLoading || pushPermission === "denied"}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  pushSubscribed ? "bg-orange-500" : "bg-slate-300"
                } ${pushLoading ? "opacity-50" : ""} ${pushPermission === "denied" ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    pushSubscribed ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          )}

          {[
            { key: "newJobs", label: "New job alerts", description: "Get notified when new jobs are posted" },
            { key: "applicationUpdates", label: "Application updates", description: "Updates on your job applications" },
            { key: "paymentAlerts", label: "Payment alerts", description: "Notifications about payments and payouts" },
            { key: "marketingEmails", label: "Marketing emails", description: "Tips, news, and promotional content" },
          ].map((item) => (
            <div key={item.key} className="p-4 sm:px-6 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">{item.label}</div>
                <div className="text-sm text-slate-500">{item.description}</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setNotifications((prev) => ({
                    ...prev,
                    [item.key]: !prev[item.key as keyof typeof notifications],
                  }))
                }
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  notifications[item.key as keyof typeof notifications] ? "bg-orange-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    notifications[item.key as keyof typeof notifications] ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            Account
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          <button
            type="button"
            onClick={() => router.push("/locksmith/earnings")}
            className="w-full p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900">Payment Settings</div>
                <div className="text-sm text-slate-500">Manage Stripe Connect and payouts</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => router.push("/locksmith/history")}
            className="w-full p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900">Job History</div>
                <div className="text-sm text-slate-500">View your completed jobs</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => router.push("/locksmith/faq")}
            className="w-full p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Info className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900">Help Center</div>
                <div className="text-sm text-slate-500">FAQs and support resources</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => router.push("/terms")}
            className="w-full p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900">Partner Terms</div>
                <div className="text-sm text-slate-500">Platform terms and conditions</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => router.push("/privacy")}
            className="w-full p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <div className="font-medium text-slate-900">Privacy Policy</div>
                <div className="text-sm text-slate-500">How we handle your data</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveProfile}
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2.5"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
