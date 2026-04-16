"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Camera,
  Trash2,
  CheckCircle2,
  Clock,
  Wrench,
  PoundSterling,
  User,
  MapPin,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  Flag,
  PenTool,
  FileText,
  Phone,
  Navigation,
  Shield,
  Star,
  Check,
  X,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  ExternalLink,
  Timer,
} from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";

interface JobPhoto {
  id: string;
  url: string;
  type: "BEFORE" | "DURING" | "AFTER" | "LOCK_SERIAL" | "DAMAGE" | "OTHER";
  caption?: string;
  takenAt: string;
}

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  description?: string;
  assessmentFee: number;
  latitude?: number;
  longitude?: number;
  acceptedAt?: string;
  acceptedEta?: number;
  customer: {
    name: string;
    phone: string;
    email?: string;
  } | null;
  quote?: {
    total: number;
    partsTotal: number;
    labourCost: number;
  } | null;
  photos?: JobPhoto[];
  createdAt: string;
  arrivedAt?: string;
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

const statusFlow = [
  { status: "ACCEPTED", label: "En Route", icon: Navigation, color: "blue" },
  { status: "ARRIVED", label: "Arrived", icon: MapPin, color: "purple" },
  { status: "DIAGNOSING", label: "Diagnosing", icon: Wrench, color: "indigo" },
  { status: "QUOTED", label: "Quote Sent", icon: FileText, color: "cyan" },
  { status: "QUOTE_ACCEPTED", label: "Quote Accepted", icon: CheckCircle2, color: "emerald" },
  { status: "IN_PROGRESS", label: "Working", icon: Wrench, color: "orange" },
  { status: "PENDING_CUSTOMER_CONFIRMATION", label: "Awaiting Customer", icon: Clock, color: "blue" },
  { status: "SIGNED", label: "Completed", icon: Flag, color: "green" },
];

// Arrival Countdown Timer Component
function ArrivalCountdown({
  acceptedAt,
  acceptedEta,
  address,
  postcode,
  latitude,
  longitude,
}: {
  acceptedAt: string;
  acceptedEta: number;
  address: string;
  postcode: string;
  latitude?: number;
  longitude?: number;
}) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isOverdue, setIsOverdue] = useState(false);
  const [overdueMinutes, setOverdueMinutes] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const acceptedTime = new Date(acceptedAt).getTime();
      const etaMs = acceptedEta * 60 * 1000;
      const expectedArrival = acceptedTime + etaMs;
      const now = Date.now();

      const msRemaining = expectedArrival - now;
      setTimeRemaining(msRemaining);

      if (msRemaining < 0) {
        setIsOverdue(true);
        setOverdueMinutes(Math.floor(Math.abs(msRemaining) / 60000));
      } else {
        setIsOverdue(false);
        setOverdueMinutes(0);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [acceptedAt, acceptedEta]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.abs(Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Open Google Maps with directions
  const openNavigation = () => {
    let destination = "";
    if (latitude && longitude) {
      destination = `${latitude},${longitude}`;
    } else {
      destination = encodeURIComponent(`${address}, ${postcode}`);
    }

    // Try to open native maps app first, fallback to web
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      // Apple Maps
      window.location.href = `maps://maps.apple.com/?daddr=${destination}&dirflg=d`;
    } else if (isAndroid) {
      // Google Maps app
      window.location.href = `google.navigation:q=${destination}`;
    } else {
      // Web fallback
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
        "_blank"
      );
    }
  };

  // Calculate progress percentage
  const totalDuration = acceptedEta * 60 * 1000;
  const elapsed = Date.now() - new Date(acceptedAt).getTime();
  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  return (
    <div className={`rounded-xl shadow-sm p-4 mb-4 ${
      isOverdue
        ? "bg-gradient-to-r from-red-500 to-red-600"
        : "bg-gradient-to-r from-blue-500 to-indigo-600"
    } text-white`}>
      {/* Timer Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5" />
          <span className="font-medium">
            {isOverdue ? "Overdue!" : "Time to Arrival"}
          </span>
        </div>
        <div className="text-sm opacity-90">
          ETA: {acceptedEta} min
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-500 ${
            isOverdue ? "bg-white" : "bg-white"
          }`}
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />
      </div>

      {/* Time Display */}
      <div className="text-center mb-4">
        {!isOverdue ? (
          <>
            <div className="text-4xl font-bold font-mono mb-1">
              {formatTime(timeRemaining)}
            </div>
            <div className="text-sm opacity-90">
              to reach your destination
            </div>
          </>
        ) : (
          <>
            <div className="text-4xl font-bold font-mono mb-1">
              +{overdueMinutes} min
            </div>
            <div className="text-sm opacity-90">
              past expected arrival
            </div>
          </>
        )}
      </div>

      {/* Overdue Warning */}
      {isOverdue && (
        <div className="bg-white/10 backdrop-blur rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Customer May Cancel!</p>
              <p className="opacity-90">
                After 30 minutes overdue, the customer can cancel the job,
                request a full refund, and may leave a negative review.
                Please hurry or contact the customer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Near Deadline Warning (within 5 minutes) */}
      {!isOverdue && timeRemaining < 5 * 60 * 1000 && timeRemaining > 0 && (
        <div className="bg-white/10 backdrop-blur rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Running Late?</p>
              <p className="opacity-90">
                Contact the customer if you won't make it in time.
                Late arrivals may result in cancellation and refund.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Button */}
      <button
        onClick={openNavigation}
        className="w-full py-3 px-4 bg-white text-slate-900 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors active:scale-[0.98]"
      >
        <Navigation className="w-5 h-5" />
        Open in Maps
        <ExternalLink className="w-4 h-4 opacity-60" />
      </button>

      {/* Address Display */}
      <div className="mt-3 text-center text-sm opacity-80">
        <MapPin className="w-4 h-4 inline mr-1" />
        {address}, {postcode}
      </div>
    </div>
  );
}

export default function JobWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [activePhotoType, setActivePhotoType] = useState<"BEFORE" | "DURING" | "AFTER">("BEFORE");
  const [workTimer, setWorkTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [confirmations, setConfirmations] = useState({
    confirmsWork: false,
    confirmsPrice: false,
    confirmsSatisfied: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image upload hook for locksmith photos
  const {
    uploadImage,
    isUploading,
    uploadProgress,
    error: uploadError,
  } = useImageUpload({
    jobId: id,
    photoType: activePhotoType.toLowerCase(),
    uploadedBy: "locksmith",
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.7,
    onUploadComplete: async (image) => {
      // Save photo to database
      try {
        const response = await fetch(`/api/jobs/${id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: image.url,
            type: activePhotoType,
            caption: `${activePhotoType.toLowerCase()} photo`,
          }),
        });
        const data = await response.json();
        if (data.success && data.photo) {
          setPhotos((prev) => [...prev, data.photo]);
        }
      } catch (err) {
        console.error("Failed to save photo to database:", err);
        // Still add to local state even if DB save fails
        const newPhoto: JobPhoto = {
          id: `temp-${Date.now()}`,
          url: image.url,
          type: activePhotoType,
          takenAt: new Date().toISOString(),
        };
        setPhotos((prev) => [...prev, newPhoto]);
      }
    },
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // GPS tracking state
  const [gpsStatus, setGpsStatus] = useState<"idle" | "getting" | "success" | "error">("idle");
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get current GPS location
  const getCurrentLocation = (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsStatus("error");
        resolve(null);
        return;
      }

      setGpsStatus("getting");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setCurrentLocation({ lat: location.lat, lng: location.lng });
          setGpsStatus("success");
          setTimeout(() => setGpsStatus("idle"), 2000);
          resolve(location);
        },
        (error) => {
          console.error("GPS error:", error);
          setGpsStatus("error");
          setTimeout(() => setGpsStatus("idle"), 3000);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  // Fetch job data
  const fetchJob = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs/${id}`);
      const data = await response.json();

      if (data.success) {
        setJob(data.job);
        // Load existing photos
        if (data.job.photos && data.job.photos.length > 0) {
          setPhotos(data.job.photos);
        }
        // Start timer if job is in progress
        if (data.job.status === "IN_PROGRESS") {
          setTimerRunning(true);
        }
      } else {
        setError(data.error || "Failed to load job");
      }
    } catch (err) {
      setError("Failed to connect to server");
      console.error("Error fetching job:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [id]);

  // Work timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning) {
      interval = setInterval(() => {
        setWorkTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Update job status with GPS
  const updateStatus = async (newStatus: string) => {
    if (!job) return;
    setUpdating(true);

    try {
      // Get GPS for key status changes (anti-fraud protection)
      let gpsData = null;
      if (newStatus === "ARRIVED" || newStatus === "IN_PROGRESS" || newStatus === "COMPLETED" || newStatus === "PENDING_CUSTOMER_CONFIRMATION") {
        gpsData = await getCurrentLocation();
      }

      const response = await fetch(`/api/jobs/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          gpsData: gpsData ? {
            lat: gpsData.lat,
            lng: gpsData.lng,
            accuracy: gpsData.accuracy,
            timestamp: new Date().toISOString(),
          } : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setJob({ ...job, status: newStatus });
        if (newStatus === "IN_PROGRESS") {
          setTimerRunning(true);
        } else if (newStatus === "COMPLETED") {
          setTimerRunning(false);
        }
      } else {
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      alert("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  // Handle file selection for photo upload
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      await uploadImage(file);
    }

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [uploadImage]);

  // Trigger file input
  const triggerPhotoCapture = () => {
    fileInputRef.current?.click();
  };

  // Delete photo
  const deletePhoto = async (photoId: string) => {
    try {
      // Optimistically remove from UI
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));

      // Delete from database
      await fetch(`/api/jobs/${id}/photos/${photoId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete photo:", err);
    }
  };

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ("touches" in e) {
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  // Submit signature and complete job
  const submitSignature = async () => {
    if (!signatureData || !signerName || !confirmations.confirmsWork || !confirmations.confirmsPrice || !confirmations.confirmsSatisfied) {
      alert("Please complete all fields and confirmations");
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`/api/jobs/${id}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureData,
          signerName,
          ...confirmations,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setJob({ ...job!, status: "SIGNED" });
        setShowSignature(false);
      } else {
        alert(data.error || "Failed to submit signature");
      }
    } catch (err) {
      alert("Failed to submit signature");
    } finally {
      setUpdating(false);
    }
  };

  // Get current status index
  const getCurrentStatusIndex = () => {
    if (!job) return -1;
    return statusFlow.findIndex((s) => s.status === job.status);
  };

  // Get next action
  const getNextAction = () => {
    if (!job) return null;

    switch (job.status) {
      case "ACCEPTED":
        return { label: "I've Arrived", status: "ARRIVED", color: "bg-purple-500 hover:bg-purple-600" };
      case "ARRIVED":
        return { label: "Start Diagnosis", status: "DIAGNOSING", color: "bg-indigo-500 hover:bg-indigo-600" };
      case "DIAGNOSING":
        return { label: "Create Quote", link: `/locksmith/job/${id}/quote`, color: "bg-cyan-500 hover:bg-cyan-600" };
      case "QUOTE_ACCEPTED":
        return { label: "Start Work", status: "IN_PROGRESS", color: "bg-orange-500 hover:bg-orange-600" };
      case "IN_PROGRESS":
        return { label: "Mark as Complete", status: "PENDING_CUSTOMER_CONFIRMATION", color: "bg-green-500 hover:bg-green-600" };
      case "PENDING_CUSTOMER_CONFIRMATION":
        return null;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading job...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "Job not found"}</p>
          <Link href="/locksmith/dashboard">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const nextAction = getNextAction();
  const currentStatusIndex = getCurrentStatusIndex();

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-40">
        <div className="px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/locksmith/dashboard" className="p-2 hover:bg-slate-800 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="font-bold text-sm sm:text-base">Job #{job.jobNumber}</div>
                <div className="text-xs text-slate-400">{problemLabels[job.problemType] || job.problemType}</div>
              </div>
            </div>
            {job.customer && (
              <a
                href={`tel:${job.customer.phone}`}
                className="p-2.5 sm:p-3 bg-green-500 hover:bg-green-600 rounded-full"
              >
                <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="p-4 pb-32">
        {/* Arrival Countdown Timer - Show when ACCEPTED status */}
        {job.status === "ACCEPTED" && job.acceptedAt && job.acceptedEta && (
          <ArrivalCountdown
            acceptedAt={job.acceptedAt}
            acceptedEta={job.acceptedEta}
            address={job.address}
            postcode={job.postcode}
            latitude={job.latitude}
            longitude={job.longitude}
          />
        )}

        {/* Status Progress */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="font-bold text-slate-900 mb-3 text-sm sm:text-base">Job Progress</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {statusFlow.slice(0, 7).map((step, index) => {
              const isCompleted = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const Icon = step.icon;

              return (
                <div key={step.status} className="flex items-center">
                  <div
                    className={`flex flex-col items-center min-w-[50px] sm:min-w-[60px] ${
                      isCompleted ? "text-green-600" : isCurrent ? "text-orange-600" : "text-slate-300"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? "bg-green-100"
                          : isCurrent
                          ? "bg-orange-100"
                          : "bg-slate-100"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                      ) : (
                        <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                      )}
                    </div>
                    <span className="text-[9px] sm:text-[10px] mt-1 text-center leading-tight">{step.label}</span>
                  </div>
                  {index < 6 && (
                    <div
                      className={`w-3 sm:w-4 h-0.5 ${
                        index < currentStatusIndex ? "bg-green-500" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Work Timer (when in progress) */}
        {(job.status === "IN_PROGRESS" || workTimer > 0) && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl shadow-sm p-4 mb-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-90">Work Timer</div>
                <div className="text-2xl sm:text-3xl font-bold font-mono">{formatTime(workTimer)}</div>
              </div>
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30"
              >
                {timerRunning ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>
          </div>
        )}

        {/* Job Details */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h2 className="font-bold text-slate-900 mb-3 text-sm sm:text-base">Job Details</h2>
          <div className="space-y-3">
            {job.customer && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 text-sm sm:text-base truncate">{job.customer.name}</div>
                  <div className="text-xs sm:text-sm text-slate-500">{job.customer.phone}</div>
                </div>
                <a
                  href={`tel:${job.customer.phone}`}
                  className="p-2 bg-green-100 hover:bg-green-200 rounded-lg sm:hidden"
                >
                  <Phone className="w-4 h-4 text-green-600" />
                </a>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 text-sm sm:text-base">{job.address}</div>
                <div className="text-xs sm:text-sm text-slate-500">{job.postcode}</div>
              </div>
              {/* Quick navigate button for non-ACCEPTED status */}
              {job.status !== "ACCEPTED" && (
                <button
                  onClick={() => {
                    let destination = "";
                    if (job.latitude && job.longitude) {
                      destination = `${job.latitude},${job.longitude}`;
                    } else {
                      destination = encodeURIComponent(`${job.address}, ${job.postcode}`);
                    }
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`,
                      "_blank"
                    );
                  }}
                  className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg"
                >
                  <Navigation className="w-4 h-4 text-blue-600" />
                </button>
              )}
            </div>
            {job.quote && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <PoundSterling className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 text-sm sm:text-base">£{job.quote.total}</div>
                  <div className="text-xs sm:text-sm text-slate-500">Accepted Quote</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GPS Location Card */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                gpsStatus === "success" ? "bg-green-100" :
                gpsStatus === "error" ? "bg-red-100" :
                gpsStatus === "getting" ? "bg-blue-100" :
                "bg-slate-100"
              }`}>
                <Navigation className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  gpsStatus === "success" ? "text-green-600" :
                  gpsStatus === "error" ? "text-red-600" :
                  gpsStatus === "getting" ? "text-blue-600 animate-pulse" :
                  "text-slate-600"
                }`} />
              </div>
              <div>
                <div className="font-medium text-slate-900 text-sm sm:text-base">GPS Location</div>
                <div className="text-xs sm:text-sm text-slate-500">
                  {gpsStatus === "getting" && "Getting location..."}
                  {gpsStatus === "success" && currentLocation &&
                    `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
                  }
                  {gpsStatus === "error" && "Location unavailable"}
                  {gpsStatus === "idle" && !currentLocation && "Tap to get location"}
                  {gpsStatus === "idle" && currentLocation &&
                    `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
                  }
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => getCurrentLocation()}
              disabled={gpsStatus === "getting"}
              className="h-9"
            >
              {gpsStatus === "getting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
            </Button>
          </div>
          {gpsStatus === "success" && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg flex items-center gap-2 text-green-700 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              GPS location captured successfully
            </div>
          )}
          {gpsStatus === "error" && (
            <div className="mt-3 p-2 bg-red-50 rounded-lg flex items-center gap-2 text-red-700 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Please enable location services and try again
            </div>
          )}
        </div>

        {/* Photos Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">Documentation Photos</h2>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {photos.length} total
            </span>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />

          {/* Photo Type Tabs */}
          <div className="flex gap-2 mb-4">
            {(["BEFORE", "DURING", "AFTER"] as const).map((type) => {
              const count = photos.filter((p) => p.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setActivePhotoType(type)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    activePhotoType === type
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 rounded-full ${
                      activePhotoType === type ? "bg-white/20" : "bg-slate-200"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Upload Error */}
          {uploadError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs sm:text-sm">
              {uploadError}
            </div>
          )}

          {/* Photos Grid */}
          <div className="grid grid-cols-3 gap-2">
            {photos
              .filter((p) => p.type === activePhotoType)
              .map((photo) => (
                <div key={photo.id} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden group">
                  <img src={photo.url} alt={`${photo.type} photo`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => deletePhoto(photo.id)}
                    className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 text-white text-[10px] rounded">
                    {photo.type.toLowerCase()}
                  </div>
                </div>
              ))}
            {/* Upload button */}
            <button
              type="button"
              onClick={triggerPhotoCapture}
              disabled={isUploading}
              className={`aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
                isUploading
                  ? "border-orange-300 bg-orange-50"
                  : "border-slate-300 text-slate-400 hover:border-orange-400 hover:text-orange-500"
              }`}
            >
              {isUploading ? (
                <>
                  <div className="relative w-8 h-8">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-orange-600">
                      {Math.round(uploadProgress)}%
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5 sm:w-6 sm:h-6 mb-1" />
                  <span className="text-xs">Add</span>
                </>
              )}
            </button>
          </div>

          {/* Photo tips */}
          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
            <p className="font-medium text-slate-600 mb-1">Photo Tips:</p>
            <ul className="space-y-0.5">
              <li>• Take "Before" photos of the lock condition</li>
              <li>• Document any damage or issues found</li>
              <li>• Take "After" photos showing completed work</li>
            </ul>
          </div>
        </div>

        {/* Pending Customer Confirmation State */}
        {job.status === "PENDING_CUSTOMER_CONFIRMATION" && (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-sm p-4 sm:p-6 text-white text-center mb-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Clock className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold mb-2">Awaiting Customer Confirmation</h2>
            <p className="text-blue-100 mb-3 sm:mb-4 text-sm sm:text-base">
              The customer has been notified to confirm the work and sign off.
              Once they sign, payment will be processed automatically.
            </p>
            <div className="bg-white/10 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 text-left">
              <p className="text-xs sm:text-sm text-blue-100 mb-2">
                Customer will receive:
              </p>
              <ul className="text-xs sm:text-sm text-white space-y-1">
                <li>• Email notification with confirmation link</li>
                <li>• Digital signature request</li>
                <li>• Automatic payment processing</li>
              </ul>
            </div>
            <p className="text-xs text-blue-200">
              You'll be notified once the customer completes the sign-off.
            </p>
          </div>
        )}

        {/* Completed State */}
        {job.status === "SIGNED" && (
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-sm p-4 sm:p-6 text-white text-center mb-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold mb-2">Job Complete!</h2>
            <p className="text-green-100 mb-3 sm:mb-4 text-sm sm:text-base">
              This job has been signed off by the customer and payment has been processed.
            </p>
            <Link href={`/report/${job.id}`}>
              <Button className="bg-white text-green-600 hover:bg-green-50">
                <FileText className="w-4 h-4 mr-2" />
                View Report
              </Button>
            </Link>
          </div>
        )}
      </main>

      {/* Bottom Action Bar */}
      {nextAction && job.status !== "SIGNED" && job.status !== "PENDING_CUSTOMER_CONFIRMATION" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:p-4 safe-area-bottom">
          <div className="max-w-lg mx-auto">
            {nextAction.link ? (
              <Link href={nextAction.link} className="block">
                <Button className={`w-full py-4 sm:py-6 text-base sm:text-lg text-white ${nextAction.color}`}>
                  {nextAction.label}
                </Button>
              </Link>
            ) : (
              <Button
                onClick={() => updateStatus(nextAction.status!)}
                className={`w-full py-4 sm:py-6 text-base sm:text-lg text-white ${nextAction.color}`}
                disabled={updating}
              >
                {updating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {nextAction.label}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignature && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">Customer Sign-Off</h2>
                <button
                  onClick={() => setShowSignature(false)}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Job Summary */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4 sm:mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600 text-sm">Job Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-slate-900">£{job.quote?.total || job.assessmentFee}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Work Time</span>
                  <span className="text-slate-700">{formatTime(workTimer)}</span>
                </div>
              </div>

              {/* Confirmations */}
              <div className="space-y-3 mb-4 sm:mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmations.confirmsWork}
                    onChange={(e) => setConfirmations({ ...confirmations, confirmsWork: e.target.checked })}
                    className="mt-1 w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">I confirm the work has been completed as described</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmations.confirmsPrice}
                    onChange={(e) => setConfirmations({ ...confirmations, confirmsPrice: e.target.checked })}
                    className="mt-1 w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">I agree to the price charged for this work</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmations.confirmsSatisfied}
                    onChange={(e) => setConfirmations({ ...confirmations, confirmsSatisfied: e.target.checked })}
                    className="mt-1 w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs sm:text-sm text-slate-700">I am satisfied with the work carried out</span>
                </label>
              </div>

              {/* Signer Name */}
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>

              {/* Signature Canvas */}
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs sm:text-sm font-medium text-slate-700">Signature</label>
                  <button
                    onClick={clearSignature}
                    className="text-xs sm:text-sm text-orange-600 hover:text-orange-700"
                  >
                    Clear
                  </button>
                </div>
                <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={350}
                    height={150}
                    className="w-full touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Draw your signature above using your finger or mouse
                </p>
              </div>

              {/* Submit Button */}
              <Button
                onClick={submitSignature}
                disabled={!signatureData || !signerName || !confirmations.confirmsWork || !confirmations.confirmsPrice || !confirmations.confirmsSatisfied || updating}
                className="w-full py-4 bg-green-500 hover:bg-green-600 text-white"
              >
                {updating ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <PenTool className="w-5 h-5 mr-2" />
                )}
                Confirm & Sign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
