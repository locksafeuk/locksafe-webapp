"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Clock,
  Star,
  CheckCircle2,
  Phone,
  Navigation,
  Shield,
  User,
  ArrowLeft,
  Bell,
  CreditCard,
  X,
  Loader2,
  FileText,
  Camera,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  Download,
  PenTool,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { PostServiceReviewModal } from "@/components/marketing/modals/PostServiceReviewModal";
import { captureGPS } from "@/hooks/useGPS";

// Initialize Stripe (only if key is provided)
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Create a wrapper that catches Stripe.js load errors (e.g., in iframe environments with COEP)
let stripePromise: Promise<any> | null = null;
let stripeLoadError: string | null = null;

if (stripePublishableKey) {
  stripePromise = loadStripe(stripePublishableKey).catch((error) => {
    console.error("[Stripe] Failed to load Stripe.js:", error);
    stripeLoadError = "Stripe.js could not be loaded. This is likely due to the preview environment's security restrictions.";
    return null;
  });
}

// Dynamically import the map component to avoid SSR issues
const LiveMapTracking = dynamic(
  () => import("@/components/tracking/LiveMapTracking"),
  { ssr: false, loading: () => <div className="h-80 bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center text-slate-400">Loading map...</div> }
);

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  description: string | null;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  customerId: string;
  acceptedAt?: string;
  acceptedEta?: number;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  locksmith?: {
    id: string;
    name: string;
    phone: string;
  };
}

interface Application {
  id: string;
  locksmith: {
    id: string;
    name: string;
    company: string | null;
    rating: number;
    reviewCount: number;
    verified: boolean;
    yearsExperience: number;
    avatar: string;
    profileImage?: string | null;
    stripeConnected?: boolean;
    stripeAccountId?: string | null;
  };
  assessmentFee: number;
  eta: number;
  appliedAt: string;
  message: string | null;
}

interface Quote {
  id: string;
  lockType: string;
  defect: string;
  difficulty: string;
  parts: Array<{ name: string; price: number; quantity: number }>;
  labourCost: number;
  labourTime: number;
  partsTotal: number;
  subtotal: number;
  vat: number;
  total: number;
  createdAt: string;
}

interface Payment {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Finding Locksmiths", color: "bg-amber-100 text-amber-700" },
  AWAITING_SELECTION: { label: "Choose a Locksmith", color: "bg-blue-100 text-blue-700" },
  ACCEPTED: { label: "Locksmith En Route", color: "bg-green-100 text-green-700" },
  CONFIRMED: { label: "Locksmith En Route", color: "bg-green-100 text-green-700" },
  ARRIVED: { label: "Locksmith Arrived", color: "bg-purple-100 text-purple-700" },
  DIAGNOSING: { label: "Diagnosing Issue", color: "bg-purple-100 text-purple-700" },
  QUOTED: { label: "Quote Received", color: "bg-cyan-100 text-cyan-700" },
  QUOTE_SENT: { label: "Quote Received", color: "bg-cyan-100 text-cyan-700" },
  QUOTE_ACCEPTED: { label: "Work Approved", color: "bg-emerald-100 text-emerald-700" },
  IN_PROGRESS: { label: "Work in Progress", color: "bg-orange-100 text-orange-700" },
  PENDING_CUSTOMER_CONFIRMATION: { label: "Action Required: Confirm & Sign", color: "bg-blue-200 text-blue-800" },
  COMPLETED: { label: "Work Verified", color: "bg-green-100 text-green-700" },
  SIGNED: { label: "Job Complete", color: "bg-green-200 text-green-800" },
};

// Stripe Checkout Form Component
function CheckoutForm({
  applicationId,
  jobId,
  amount,
  stripeCustomerId,
  onSuccess,
  onCancel,
  onStripeError,
}: {
  applicationId: string;
  jobId: string;
  amount: number;
  stripeCustomerId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
  onStripeError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timeout for Stripe.js loading - if it takes too long, show fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isElementReady && !stripe) {
        setLoadTimeout(true);
        onStripeError("Stripe.js could not load. This is common in preview environments due to security restrictions. Please use the demo payment option.");
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timer);
  }, [isElementReady, stripe, onStripeError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Payment failed");
        setIsProcessing(false);
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/customer/job/${jobId}` },
        redirect: "if_required",
      });

      if (confirmError) {
        setError(confirmError.message || "Payment failed");
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        // Extract the payment method ID from the payment intent for saving
        const paymentMethodId = typeof paymentIntent.payment_method === 'string'
          ? paymentIntent.payment_method
          : paymentIntent.payment_method?.id;

        const response = await fetch(`/api/jobs/${jobId}/accept-application`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId,
            paymentIntentId: paymentIntent.id,
            stripeCustomerId: stripeCustomerId,
            stripePaymentMethodId: paymentMethodId,
          }),
        });
        const data = await response.json();
        if (data.success) {
          onSuccess();
        } else {
          setError(data.error || "Failed to accept application");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  // If timed out waiting for Stripe, don't render the form
  if (loadTimeout) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Loading indicator while PaymentElement loads */}
      {!isElementReady && (
        <div className="py-6 flex flex-col items-center justify-center bg-slate-50 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-2" />
          <p className="text-sm text-slate-500">Loading payment form...</p>
          <p className="text-xs text-slate-400 mt-1">This may take a moment...</p>
        </div>
      )}
      {/* PaymentElement with onReady callback */}
      <div className={isElementReady ? "" : "hidden"}>
        <PaymentElement
          onReady={() => setIsElementReady(true)}
          options={{
            layout: "tabs",
          }}
        />
      </div>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Shield className="w-4 h-4 text-green-600" />
        <span>Secure payment powered by Stripe</span>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 py-3" disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || !isElementReady || isProcessing} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing...</> : <><CreditCard className="w-4 h-4 mr-2" />Pay £{amount}</>}
        </Button>
      </div>
    </form>
  );
}

// Signature Pad Component
function SignaturePad({ onSign }: { onSign: (signatureData: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const submitSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const signatureData = canvas.toDataURL("image/png");
    onSign(signatureData);
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <p className="text-xs text-slate-500 text-center">Draw your signature above</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={clearSignature} className="flex-1">
          Clear
        </Button>
        <Button type="button" onClick={submitSignature} disabled={!hasSignature} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Confirm Signature
        </Button>
      </div>
    </div>
  );
}

// Arrival Timer Component
function ArrivalTimer({
  acceptedAt,
  acceptedEta,
  onCancelClick,
  isOverdue,
  setIsOverdue,
}: {
  acceptedAt: string;
  acceptedEta: number;
  onCancelClick: () => void;
  isOverdue: boolean;
  setIsOverdue: (v: boolean) => void;
}) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [canCancel, setCanCancel] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const acceptedTime = new Date(acceptedAt).getTime();
      const etaMs = acceptedEta * 60 * 1000;
      const gracePeriodMs = 30 * 60 * 1000; // 30 minute grace period
      const expectedArrival = acceptedTime + etaMs;
      const deadlineTime = expectedArrival + gracePeriodMs;
      const now = Date.now();

      // Calculate time remaining until expected arrival
      const msRemaining = expectedArrival - now;
      setTimeRemaining(msRemaining);

      // Calculate progress (0-100%)
      const elapsed = now - acceptedTime;
      const progress = Math.min(100, Math.max(0, (elapsed / etaMs) * 100));
      setProgressPercent(progress);

      // Check if overdue (past expected arrival)
      if (msRemaining < 0) {
        setIsOverdue(true);
      }

      // Check if can cancel (past deadline)
      if (now > deadlineTime) {
        setCanCancel(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [acceptedAt, acceptedEta, setIsOverdue]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.abs(Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const isNegative = timeRemaining < 0;

  return (
    <div className={`rounded-xl p-4 ${isOverdue ? 'bg-red-50 border-2 border-red-300' : 'bg-slate-50'}`}>
      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>En route</span>
          <span>ETA: {acceptedEta} min</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Time display */}
      <div className="text-center">
        {!isOverdue ? (
          <>
            <div className="text-2xl font-bold text-slate-900">
              {formatTime(timeRemaining)}
            </div>
            <div className="text-sm text-slate-500">until expected arrival</div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-lg font-bold text-red-600">
                {formatTime(Math.abs(timeRemaining))} overdue
              </span>
            </div>
            {canCancel ? (
              <div className="space-y-3">
                <p className="text-sm text-red-600">
                  The locksmith has not arrived within the expected time.
                </p>
                <button
                  onClick={onCancelClick}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                  Cancel & Get Full Refund
                </button>
                <p className="text-xs text-slate-500">
                  Your assessment fee will be refunded immediately
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-amber-600">
                  You'll be able to cancel in {formatTime(30 * 60 * 1000 + timeRemaining)}
                </p>
                <p className="text-xs text-slate-500">
                  We allow a 30-minute grace period for traffic delays
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CustomerJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [assessmentFee, setAssessmentFee] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [selectedEta, setSelectedEta] = useState<number>(30);
  const [isAcceptingQuote, setIsAcceptingQuote] = useState(false);
  const [isDecliningQuote, setIsDecliningQuote] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const [signatureConfirms, setSignatureConfirms] = useState({
    work: false,
    price: false,
    satisfied: false,
  });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [hasLeftReview, setHasLeftReview] = useState(false);

  // Cancellation/Refund state
  const [isOverdue, setIsOverdue] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ success: boolean; message: string; refundAmount?: number } | null>(null);

  // Fetch job and applications
  const fetchJobData = async () => {
    try {
      setLoading(true);
      const jobResponse = await fetch(`/api/jobs/${id}`);
      const jobData = await jobResponse.json();

      if (jobData.success && jobData.job) {
        const j = jobData.job;
        setJob({
          id: j.id,
          jobNumber: j.jobNumber,
          status: j.status,
          problemType: j.problemType,
          propertyType: j.propertyType,
          postcode: j.postcode,
          address: j.address,
          description: j.description,
          latitude: j.latitude,
          longitude: j.longitude,
          createdAt: j.createdAt,
          customerId: j.customerId,
          acceptedAt: j.acceptedAt,
          acceptedEta: j.acceptedEta,
          customer: j.customer
            ? {
                name: j.customer.name,
                phone: j.customer.phone,
                email: j.customer.email,
              }
            : { name: "Customer", phone: "" },
          locksmith: j.locksmith
            ? { id: j.locksmith.id, name: j.locksmith.name, phone: j.locksmith.phone || "" }
            : undefined,
        });
        if (j.acceptedEta) setSelectedEta(j.acceptedEta);
        if (j.assessmentFee) setAssessmentFee(j.assessmentFee);
        if (j.payments) setPayments(j.payments);
        // Check if a review already exists for this job
        if (j.review) {
          setHasLeftReview(true);
        }

        // Fetch quote if applicable
        if (["QUOTED", "QUOTE_SENT", "QUOTE_ACCEPTED", "IN_PROGRESS", "PENDING_CUSTOMER_CONFIRMATION", "COMPLETED", "SIGNED"].includes(j.status)) {
          const quoteResponse = await fetch(`/api/jobs/${id}/quote`);
          const quoteData = await quoteResponse.json();
          if (quoteData.success && quoteData.quote) {
            setQuote(quoteData.quote);
          }
        }
      }

      const appsResponse = await fetch(`/api/jobs/${id}/applications`);
      const appsData = await appsResponse.json();
      if (appsData.success) {
        setApplications(appsData.applications);
      }
    } catch (error) {
      console.error("Error fetching job data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobData();
  }, [id]);

  // Poll for updates
  useEffect(() => {
    if (!job) return;
    const pollableStatuses = ["PENDING", "ACCEPTED", "CONFIRMED", "ARRIVED", "DIAGNOSING", "IN_PROGRESS", "PENDING_CUSTOMER_CONFIRMATION"];
    if (!pollableStatuses.includes(job.status)) return;

    const interval = setInterval(async () => {
      try {
        const jobResponse = await fetch(`/api/jobs/${id}`);
        const jobData = await jobResponse.json();
        if (jobData.success && jobData.job && jobData.job.status !== job.status) {
          fetchJobData();
          const newStatus = jobData.job.status;
          if (newStatus === "ARRIVED") {
            setShowNotification(true);
            setNotifications(prev => [...prev, "Your locksmith has arrived!"]);
            setTimeout(() => setShowNotification(false), 5000);
          } else if (newStatus === "QUOTED" || newStatus === "QUOTE_SENT") {
            setShowNotification(true);
            setNotifications(prev => [...prev, "You've received a quote!"]);
            setTimeout(() => setShowNotification(false), 5000);
          } else if (newStatus === "PENDING_CUSTOMER_CONFIRMATION") {
            setShowNotification(true);
            setNotifications(prev => [...prev, "Work completed! Please confirm and sign to process payment."]);
            setTimeout(() => setShowNotification(false), 5000);
          }
        }
      } catch (error) {
        console.error("Error polling:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [job, id]);

  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleSelectLocksmith = async (application: Application) => {
    setSelectedApplication(application);
    setSelectedEta(application.eta);
    setIsLoadingPayment(true);
    setShowPaymentModal(true);
    setPaymentError(null);
    setClientSecret(null);

    if (!stripePublishableKey) {
      console.log("[Payment] No Stripe publishable key configured, using demo mode");
      setIsLoadingPayment(false);
      return;
    }

    try {
      console.log("[Payment] Creating payment intent for application:", application.id, "Locksmith Stripe:", application.locksmith.stripeAccountId, "Customer:", job?.customerId);
      const response = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "assessment_fee",
          amount: application.assessmentFee,
          jobId: id,
          customerId: job?.customerId,
          customerEmail: job?.customer?.email,
          customerName: job?.customer?.name,
          customerPhone: job?.customer?.phone,
          locksmithId: application.locksmith.id,
          applicationId: application.id,
          locksmithStripeAccountId: application.locksmith.stripeAccountId || null,
        }),
      });
      const data = await response.json();
      console.log("[Payment] API response:", data);

      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        if (data.stripeCustomerId) {
          setStripeCustomerId(data.stripeCustomerId);
        }
        console.log("[Payment] Client secret received, loading Stripe Elements. Customer:", data.stripeCustomerId);
      } else if (data.error) {
        console.error("[Payment] API error:", data.error);
        setPaymentError(data.error);
      } else {
        console.error("[Payment] No client secret in response");
        setPaymentError("Payment initialization failed. Please try again.");
      }
    } catch (error) {
      console.error("[Payment] Error creating payment intent:", error);
      setPaymentError("Failed to connect to payment service. Please try again.");
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const handleDemoPayment = async () => {
    if (!selectedApplication) return;
    setIsLoadingPayment(true);
    try {
      const response = await fetch(`/api/jobs/${id}/accept-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: selectedApplication.id, paymentIntentId: `demo_${Date.now()}` }),
      });
      const data = await response.json();
      if (data.success) {
        handlePaymentSuccess();
      } else {
        alert(data.error || "Failed to accept application");
      }
    } catch (error) {
      console.error("Error with demo payment:", error);
      alert("Failed to process. Please try again.");
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    setTimeout(() => {
      setShowPaymentModal(false);
      setPaymentSuccess(false);
      setClientSecret(null);
      fetchJobData();
    }, 2000);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedApplication(null);
    setClientSecret(null);
    setStripeCustomerId(null);
    setPaymentError(null);
  };

  const handleAcceptQuote = async () => {
    if (!quote || !job) return;
    setIsAcceptingQuote(true);
    try {
      const response = await fetch(`/api/jobs/${id}/quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      const data = await response.json();
      if (data.success) {
        fetchJobData();
      } else {
        alert(data.error || "Failed to accept quote");
      }
    } catch (error) {
      console.error("Error accepting quote:", error);
      alert("Failed to accept quote. Please try again.");
    } finally {
      setIsAcceptingQuote(false);
    }
  };

  const handleDeclineQuote = async () => {
    if (!quote || !job) return;
    if (!confirm("Are you sure you want to decline this quote?")) return;
    setIsDecliningQuote(true);
    try {
      const response = await fetch(`/api/jobs/${id}/quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      const data = await response.json();
      if (data.success) {
        fetchJobData();
      } else {
        alert(data.error || "Failed to decline quote");
      }
    } catch (error) {
      console.error("Error declining quote:", error);
      alert("Failed to decline quote. Please try again.");
    } finally {
      setIsDecliningQuote(false);
    }
  };

  const handleSubmitSignature = async (signatureData: string) => {
    if (!job || !signatureConfirms.work || !signatureConfirms.price || !signatureConfirms.satisfied) {
      alert("Please confirm all checkboxes before signing");
      return;
    }

    setIsSubmittingSignature(true);
    try {
      // Capture customer's GPS for anti-fraud protection
      const signatureGps = await captureGPS();

      // Use the new confirm-completion endpoint which handles signature + payment
      const response = await fetch(`/api/jobs/${id}/confirm-completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureData,
          signerName: job.customer.name,
          confirmsWork: signatureConfirms.work,
          confirmsPrice: signatureConfirms.price,
          confirmsSatisfied: signatureConfirms.satisfied,
          signatureGps: signatureGps, // Customer's GPS at signature time
        }),
      });
      const data = await response.json();
      if (data.success) {
        setShowSignatureModal(false);
        setShowNotification(true);
        // Show payment summary if available
        if (data.summary) {
          const msg = data.summary.finalAmountCharged > 0
            ? `Job complete! £${data.summary.finalAmountCharged.toFixed(2)} charged. Thank you!`
            : "Job complete! No additional payment needed. Thank you!";
          setNotifications(prev => [...prev, msg]);
        } else {
          setNotifications(prev => [...prev, "Job signed and completed! Thank you."]);
        }
        setTimeout(() => setShowNotification(false), 5000);
        fetchJobData();
      } else {
        alert(data.error || "Failed to submit signature");
      }
    } catch (error) {
      console.error("Error submitting signature:", error);
      alert("Failed to submit signature. Please try again.");
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  // Handle review submission
  const handleSubmitReview = async (data: { rating: number; comment: string }) => {
    if (!job) return;

    try {
      const response = await fetch(`/api/jobs/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: data.rating,
          comment: data.comment,
          customerId: job.customerId,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setHasLeftReview(true);
        setShowNotification(true);
        setNotifications(prev => [...prev, "Thank you for your review!"]);
        setTimeout(() => setShowNotification(false), 5000);
      } else {
        throw new Error(result.error || "Failed to submit review");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      throw error;
    }
  };

  // Show review modal automatically after job is signed (if not already reviewed)
  useEffect(() => {
    if (job?.status === "SIGNED" && !hasLeftReview && !showReviewModal) {
      // Show review modal after a brief delay when job transitions to SIGNED
      const timer = setTimeout(() => {
        setShowReviewModal(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [job?.status, hasLeftReview, showReviewModal]);

  const getTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Handle cancellation and refund
  const handleCancelJob = async () => {
    if (!job) return;

    setIsCancelling(true);
    setCancelResult(null);

    try {
      const response = await fetch(`/api/jobs/${id}/cancel-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Locksmith did not arrive within expected time" }),
      });

      const data = await response.json();

      if (data.success) {
        setCancelResult({
          success: true,
          message: data.message,
          refundAmount: data.refund?.amount,
        });
        // Refresh job data after short delay
        setTimeout(() => {
          fetchJobData();
          setShowCancelModal(false);
        }, 3000);
      } else {
        setCancelResult({
          success: false,
          message: data.error || "Failed to cancel job",
        });
      }
    } catch (error: any) {
      setCancelResult({
        success: false,
        message: error.message || "An error occurred",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Job not found</p>
          <Link href="/"><Button className="bg-orange-500 hover:bg-orange-600 text-white">Go Home</Button></Link>
        </div>
      </div>
    );
  }

  const hasApplications = applications.length > 0;
  const displayStatus = job.status === "PENDING" && hasApplications ? "AWAITING_SELECTION" : job.status;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Notification Toast */}
      {showNotification && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-green-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-lg flex items-center gap-3">
            <Bell className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base">{notifications[notifications.length - 1]}</span>
            <button onClick={() => setShowNotification(false)} className="ml-2 hover:bg-green-700 p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="section-container py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 sm:w-6 sm:h-6 text-white" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <span className="text-lg sm:text-xl font-bold text-slate-900">Lock<span className="text-orange-500">Safe</span></span>
            </Link>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600 text-sm">
              {job.customer.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "C"}
            </div>
          </div>
        </div>
      </header>

      <main className="section-container py-4 sm:py-6">
        <Link href="/customer/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 sm:mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Job Status Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                <span className="font-mono text-xs sm:text-sm text-slate-500">{job.jobNumber}</span>
                <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${statusLabels[displayStatus]?.color || "bg-slate-100 text-slate-700"}`}>
                  {statusLabels[displayStatus]?.label || displayStatus}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{problemLabels[job.problemType]}</h1>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs sm:text-sm text-slate-500">Submitted</div>
              <div className="font-medium text-sm">{getTimeAgo(job.createdAt)}</div>
            </div>
          </div>

          <div className="p-3 sm:p-4 bg-slate-50 rounded-xl">
            <div className="flex items-start gap-2 sm:gap-3">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-slate-900 text-sm">{job.address}</div>
                <div className="text-xs text-slate-500">{job.postcode}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Waiting for Locksmiths */}
        {displayStatus === "PENDING" && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="text-center py-6 sm:py-8">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600 animate-pulse" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Finding Available Locksmiths</h2>
              <p className="text-slate-600 mb-4 max-w-md mx-auto text-sm">We're notifying verified locksmiths in your area.</p>
              <Button variant="outline" onClick={fetchJobData} className="mt-4 text-sm">
                <RefreshCw className="w-4 h-4 mr-2" />Check for Updates
              </Button>
            </div>
          </div>
        )}

        {/* Applications Selection */}
        {displayStatus === "AWAITING_SELECTION" && (
          <div className="space-y-4 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Available Locksmiths ({applications.length})</h2>
            <div className="grid gap-4">
              {applications.map((app) => (
                <div key={app.id} className="bg-white rounded-xl sm:rounded-2xl shadow-sm border-2 border-transparent hover:border-orange-200 transition-all p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4 mb-4">
                    {app.locksmith.profileImage ? (
                      <img
                        src={app.locksmith.profileImage}
                        alt={app.locksmith.name}
                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                        {app.locksmith.avatar}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-base sm:text-lg text-slate-900">{app.locksmith.name}</h3>
                        {app.locksmith.verified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] sm:text-xs font-semibold border border-green-200">
                            <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-green-600 text-green-600" />
                            Verified
                          </span>
                        )}
                        {app.locksmith.stripeConnected && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] sm:text-xs font-medium">
                            <CreditCard className="w-3 h-3" />
                            <span className="hidden sm:inline">Instant Pay</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-500">{app.locksmith.company}</div>
                      {app.locksmith.reviewCount > 0 ? (
                        <div className="flex items-center gap-2 text-xs sm:text-sm mt-1">
                          <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
                          <span className="font-semibold">{app.locksmith.rating}</span>
                          <span className="text-slate-400">({app.locksmith.reviewCount})</span>
                        </div>
                      ) : (
                        <div className="text-xs sm:text-sm text-slate-400 mt-1">
                          No reviews yet
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-3 border-t">
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div>
                        <div className="text-xs text-slate-500">Assessment Fee</div>
                        <div className="text-2xl sm:text-3xl font-bold text-orange-600">£{app.assessmentFee}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">ETA</div>
                        <div className="text-lg sm:text-xl font-semibold text-slate-900">{app.eta} min</div>
                      </div>
                    </div>
                    <Button onClick={() => handleSelectLocksmith(app)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 sm:px-6 py-4 sm:py-5">
                      <CreditCard className="w-4 h-4 mr-2" />Book & Pay
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locksmith Working Statuses */}
        {["ACCEPTED", "CONFIRMED", "ARRIVED", "DIAGNOSING", "QUOTED", "QUOTE_SENT", "QUOTE_ACCEPTED", "IN_PROGRESS", "PENDING_CUSTOMER_CONFIRMATION", "COMPLETED", "SIGNED"].includes(job.status) && job.locksmith && (
          <div className="space-y-4 sm:space-y-6">
            {/* En Route - Updated with Timer */}
            {(job.status === "ACCEPTED" || job.status === "CONFIRMED") && (
              <div className="bg-green-50 border border-green-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-green-900">Booking Confirmed!</h2>
                    <p className="text-green-700 text-sm">Your locksmith is on the way</p>
                  </div>
                </div>

                {/* Locksmith info */}
                <div className="bg-white rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white text-sm sm:text-lg font-bold">
                      {job.locksmith.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">{job.locksmith.name}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] sm:text-xs font-semibold border border-green-200">
                          <Shield className="w-3 h-3 fill-green-600 text-green-600" />
                          Verified
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-500 mt-0.5">On the way to your location</div>
                    </div>
                  </div>
                  <a href={`tel:${job.locksmith.phone}`}><Button variant="outline" size="sm"><Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />Call</Button></a>
                </div>

                {/* Arrival Timer */}
                {job.acceptedAt && job.acceptedEta && (
                  <ArrivalTimer
                    acceptedAt={job.acceptedAt}
                    acceptedEta={job.acceptedEta}
                    onCancelClick={() => setShowCancelModal(true)}
                    isOverdue={isOverdue}
                    setIsOverdue={setIsOverdue}
                  />
                )}

                {/* Safety notice */}
                <div className={`mt-4 p-3 rounded-lg text-sm ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      {isOverdue ? (
                        <p><strong>Protection Active:</strong> If the locksmith doesn't arrive, you can cancel and receive a full refund.</p>
                      ) : (
                        <p><strong>Your Protection:</strong> If the locksmith doesn't arrive within the agreed time + 30 min grace period, you can cancel for a full refund.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Arrived */}
            {job.status === "ARRIVED" && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-purple-900">Locksmith Has Arrived!</h2>
                    <p className="text-purple-700 text-sm">They are at your location</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center text-white text-sm sm:text-lg font-bold">
                      {job.locksmith.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">{job.locksmith.name}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] sm:text-xs font-semibold border border-green-200">
                          <Shield className="w-3 h-3 fill-green-600 text-green-600" />
                          Verified
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs sm:text-sm text-purple-600 mt-0.5">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                        On Site
                      </div>
                    </div>
                  </div>
                  <a href={`tel:${job.locksmith.phone}`}><Button variant="outline" size="sm"><Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />Call</Button></a>
                </div>
              </div>
            )}

            {/* Diagnosing */}
            {job.status === "DIAGNOSING" && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-indigo-900">Diagnosing Your Lock</h2>
                    <p className="text-indigo-700 text-sm">The locksmith is assessing the problem</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-indigo-100 rounded-lg text-indigo-800 text-sm">
                  <p>You'll receive a detailed quote once the diagnosis is complete.</p>
                </div>
              </div>
            )}

            {/* Quote Received */}
            {(job.status === "QUOTED" || job.status === "QUOTE_SENT") && quote && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-600" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-cyan-900">Quote Received!</h2>
                    <p className="text-cyan-700 text-sm">Review and decide to accept or decline</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 sm:p-6 space-y-4">
                  <h3 className="font-bold text-lg text-slate-900">Work Quote</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Lock Type:</span>
                      <span className="font-medium text-slate-900">{quote.lockType}</span>
                    </div>
                    {quote.defect && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Issue Found:</span>
                        <span className="font-medium text-slate-900">{quote.defect}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Labour:</span>
                      <span className="font-medium">£{quote.labourCost?.toFixed(2) || '0.00'}</span>
                    </div>
                    {quote.partsTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Parts:</span>
                        <span className="font-medium">£{quote.partsTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Subtotal:</span>
                      <span className="font-medium">£{quote.subtotal?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">VAT (20%):</span>
                      <span className="font-medium">£{quote.vat?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total:</span>
                      <span className="text-cyan-600">£{quote.total.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={handleDeclineQuote} disabled={isDecliningQuote || isAcceptingQuote} className="flex-1 py-3 border-red-300 text-red-600 hover:bg-red-50">
                      {isDecliningQuote ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}Decline
                    </Button>
                    <Button onClick={handleAcceptQuote} disabled={isAcceptingQuote || isDecliningQuote} className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-3">
                      {isAcceptingQuote ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}Accept Quote
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quote Accepted */}
            {job.status === "QUOTE_ACCEPTED" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-emerald-900">Quote Accepted!</h2>
                    <p className="text-emerald-700 text-sm">Work will begin shortly</p>
                  </div>
                </div>
              </div>
            )}

            {/* Work In Progress */}
            {job.status === "IN_PROGRESS" && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 animate-spin" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-orange-900">Work In Progress</h2>
                    <p className="text-orange-700 text-sm">The locksmith is working on your lock</p>
                  </div>
                </div>
                {quote && (
                  <div className="mt-4 p-3 bg-orange-100 rounded-lg text-orange-800 text-sm">
                    <p>Quoted amount: <strong>£{quote.total.toFixed(2)}</strong></p>
                  </div>
                )}
              </div>
            )}

            {/* PENDING_CUSTOMER_CONFIRMATION - Awaiting Customer Confirmation & Signature */}
            {job.status === "PENDING_CUSTOMER_CONFIRMATION" && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
                    <PenTool className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-blue-900">Action Required: Confirm & Sign</h2>
                    <p className="text-blue-700 text-sm">Your locksmith has completed the work</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3 pb-4 border-b">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white text-sm sm:text-lg font-bold">
                        {job.locksmith.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm sm:text-base">{job.locksmith.name}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] sm:text-xs font-semibold border border-green-200">
                            <Shield className="w-3 h-3 fill-green-600 text-green-600" />
                            Verified
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs sm:text-sm text-green-600 mt-0.5">
                          <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          Work Completed
                        </div>
                      </div>
                    </div>
                    <a href={`tel:${job.locksmith.phone}`}><Button variant="outline" size="sm"><Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />Call</Button></a>
                  </div>

                  {quote && (
                    <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Quote Total:</span>
                        <span>£{quote.total.toFixed(2)}</span>
                      </div>
                      {assessmentFee > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Assessment Fee Applied:</span>
                          <span>-£{assessmentFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Amount to Pay:</span>
                        <span className="text-blue-600">£{Math.max(0, quote.total - assessmentFee).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 text-sm font-medium">What happens when you sign:</p>
                    <ul className="text-amber-700 text-sm mt-2 space-y-1">
                      <li>• Your card will be charged automatically</li>
                      <li>• You'll receive a legal PDF report</li>
                      <li>• The locksmith will be paid (minus platform fee)</li>
                    </ul>
                  </div>

                  <div className="pt-4">
                    <Button onClick={() => setShowSignatureModal(true)} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg">
                      <PenTool className="w-5 h-5 mr-2" />Confirm & Sign to Complete
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-100 rounded-lg text-blue-800 text-sm">
                  <p><strong>Important:</strong> Your signature confirms the work has been completed to your satisfaction. Payment will be processed immediately.</p>
                </div>
              </div>
            )}

            {/* COMPLETED - Work Verified (legacy support) */}
            {job.status === "COMPLETED" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <PenTool className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-blue-900">Work Completed!</h2>
                    <p className="text-blue-700 text-sm">Please sign to confirm the job is complete</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3 pb-4 border-b">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white text-sm sm:text-lg font-bold">
                        {job.locksmith.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm sm:text-base">{job.locksmith.name}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] sm:text-xs font-semibold border border-green-200">
                            <Shield className="w-3 h-3 fill-green-600 text-green-600" />
                            Verified
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs sm:text-sm text-green-600 mt-0.5">
                          <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          Work Completed
                        </div>
                      </div>
                    </div>
                    <a href={`tel:${job.locksmith.phone}`}><Button variant="outline" size="sm"><Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />Call</Button></a>
                  </div>

                  {quote && (
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Amount:</span>
                        <span className="text-blue-600">£{quote.total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-4">
                    <Button onClick={() => setShowSignatureModal(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg">
                      <PenTool className="w-5 h-5 mr-2" />Sign to Complete Job
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-100 rounded-lg text-blue-800 text-sm">
                  <p>Your signature confirms the work has been completed to your satisfaction.</p>
                </div>
              </div>
            )}

            {/* SIGNED - Job Complete */}
            {job.status === "SIGNED" && (
              <div className="bg-green-50 border border-green-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-green-900">Job Complete!</h2>
                    <p className="text-green-700 text-sm">Thank you for using LockSafe</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3 pb-4 border-b">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center text-white text-sm sm:text-lg font-bold">
                        {job.locksmith.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm sm:text-base">{job.locksmith.name}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] sm:text-xs font-semibold border border-green-200">
                            <Shield className="w-3 h-3 fill-green-600 text-green-600" />
                            Verified
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs sm:text-sm text-green-600 mt-0.5">
                          <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          Job Complete & Signed
                        </div>
                      </div>
                    </div>
                  </div>

                  {quote && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Final Amount:</span>
                        <span className="text-green-600">£{quote.total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Link href={`/job/${id}/report`} className="flex-1">
                      <Button variant="outline" className="w-full py-3">
                        <Download className="w-4 h-4 mr-2" />View Report
                      </Button>
                    </Link>
                    {!hasLeftReview ? (
                      <Button
                        onClick={() => setShowReviewModal(true)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3"
                      >
                        <Star className="w-4 h-4 mr-2" />Leave Review
                      </Button>
                    ) : (
                      <Button
                        disabled
                        className="flex-1 bg-green-100 text-green-700 py-3 cursor-default"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />Review Submitted
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Contact buttons - show for active jobs */}
            {!["SIGNED"].includes(job.status) && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <a href={`tel:${job.locksmith.phone}`}>
                  <Button variant="outline" className="w-full py-4 sm:py-6 text-sm sm:text-lg">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />Call
                  </Button>
                </a>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address + ", " + job.postcode)}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full py-4 sm:py-6 text-sm sm:text-lg">
                    <Navigation className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />Maps
                  </Button>
                </a>
              </div>
            )}

            {/* Payment History - Show for jobs with payments */}
            {payments.length > 0 && (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-4 sm:p-6 mt-4">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-orange-500" />
                  Payment History
                </h3>
                <div className="space-y-3">
                  {payments.map((payment) => {
                    const isAssessment = payment.type === "assessment";
                    const isQuote = payment.type === "quote";
                    return (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            payment.status === "succeeded" ? "bg-green-100" : "bg-amber-100"
                          }`}>
                            {payment.status === "succeeded" ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-amber-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 text-sm">
                              {isAssessment ? "Assessment Fee" : isQuote ? "Work Payment" : payment.type}
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(payment.createdAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900">£{payment.amount.toFixed(2)}</div>
                          <div className={`text-xs ${
                            payment.status === "succeeded" ? "text-green-600" : "text-amber-600"
                          }`}>
                            {payment.status === "succeeded" ? "Paid" : payment.status}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Payment Summary */}
                  {quote && assessmentFee > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="text-sm text-green-700 font-medium mb-2">Payment Summary</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-slate-600">
                            <span>Work Quote:</span>
                            <span>£{quote.total.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-green-600">
                            <span>Assessment Fee Applied:</span>
                            <span>-£{assessmentFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-green-200">
                            <span>Final Payment:</span>
                            <span>£{Math.max(0, quote.total - assessmentFee).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Total Paid */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                    <span className="text-slate-600">Total Paid</span>
                    <span className="text-xl font-bold text-green-600">
                      £{payments.filter(p => p.status === "succeeded").reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Cancel/Refund Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !isCancelling && setShowCancelModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            {!cancelResult ? (
              <>
                <div className="p-6 border-b flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Cancel Job & Refund</h2>
                    <p className="text-sm text-slate-500">Job #{job?.jobNumber}</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-slate-700">
                    The locksmith has not arrived within the expected time. You can cancel this job and receive a full refund of your assessment fee.
                  </p>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-green-700 font-medium">Refund Amount</span>
                      <span className="text-2xl font-bold text-green-600">£{assessmentFee.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1">Will be refunded to your original payment method</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelModal(false)}
                      disabled={isCancelling}
                      className="flex-1"
                    >
                      Keep Waiting
                    </Button>
                    <Button
                      onClick={handleCancelJob}
                      disabled={isCancelling}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancel & Refund
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center">
                {cancelResult.success ? (
                  <>
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Refund Initiated!</h3>
                    <p className="text-slate-600 mb-4">{cancelResult.message}</p>
                    {cancelResult.refundAmount && (
                      <div className="p-3 bg-green-50 rounded-lg inline-block">
                        <span className="text-green-700 font-medium">£{cancelResult.refundAmount.toFixed(2)}</span>
                        <span className="text-green-600 text-sm ml-2">refund processing</span>
                      </div>
                    )}
                    <p className="text-sm text-slate-500 mt-4">
                      Refunds typically appear within 5-10 business days.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <XCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Unable to Process</h3>
                    <p className="text-red-600 mb-4">{cancelResult.message}</p>
                    <Button
                      onClick={() => setCancelResult(null)}
                      variant="outline"
                    >
                      Try Again
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={handleClosePaymentModal}>
          <div className="bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            {!paymentSuccess ? (
              <>
                <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                  <h2 className="text-lg font-bold text-slate-900">Confirm & Pay</h2>
                  <button onClick={handleClosePaymentModal} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                  <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50 rounded-xl">
                    {selectedApplication.locksmith.profileImage ? (
                      <img
                        src={selectedApplication.locksmith.profileImage}
                        alt={selectedApplication.locksmith.name}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold">
                        {selectedApplication.locksmith.avatar}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{selectedApplication.locksmith.name}</span>
                        {selectedApplication.locksmith.verified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold border border-green-200">
                            <Shield className="w-3 h-3 fill-green-600 text-green-600" />
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-500">ETA: {selectedApplication.eta} minutes</div>
                    </div>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between text-slate-600 text-sm">
                      <span>Assessment Fee</span>
                      <span className="font-medium">£{selectedApplication.assessmentFee}</span>
                    </div>
                    <div className="border-t pt-2 sm:pt-3 flex justify-between text-base sm:text-lg">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-orange-600">£{selectedApplication.assessmentFee}</span>
                    </div>
                  </div>
                  {isLoadingPayment ? (
                    <div className="py-8 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-3" />
                      <p className="text-slate-500 text-sm">Initializing payment...</p>
                    </div>
                  ) : paymentError ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-red-800 text-sm font-medium">Payment Error</p>
                          <p className="text-red-700 text-sm mt-1">{paymentError}</p>
                        </div>
                      </div>
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-amber-800 text-sm"><strong>Demo Mode Available:</strong> You can simulate the payment below while we resolve the issue.</p>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={handleClosePaymentModal} className="flex-1 py-3">Cancel</Button>
                        <Button type="button" onClick={handleDemoPayment} disabled={isLoadingPayment} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3">
                          {isLoadingPayment ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing...</> : <><CreditCard className="w-4 h-4 mr-2" />Pay £{selectedApplication.assessmentFee} (Demo)</>}
                        </Button>
                      </div>
                    </div>
                  ) : clientSecret && stripePromise ? (
                    <Elements stripe={stripePromise} options={{
                      clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: { colorPrimary: "#f97316", borderRadius: "12px" },
                        rules: {
                          '.Label': { display: 'block' }
                        }
                      },
                      loader: 'auto'
                    }}>
                      <CheckoutForm
                        applicationId={selectedApplication.id}
                        jobId={id}
                        amount={selectedApplication.assessmentFee}
                        stripeCustomerId={stripeCustomerId}
                        onSuccess={handlePaymentSuccess}
                        onCancel={handleClosePaymentModal}
                        onStripeError={(error) => setPaymentError(error)}
                      />
                    </Elements>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-amber-800 text-sm"><strong>Demo Mode:</strong> Stripe is not configured. Click below to simulate payment.</p>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={handleClosePaymentModal} className="flex-1 py-3">Cancel</Button>
                        <Button type="button" onClick={handleDemoPayment} disabled={isLoadingPayment} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3">
                          {isLoadingPayment ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing...</> : <><CreditCard className="w-4 h-4 mr-2" />Pay £{selectedApplication.assessmentFee}</>}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 sm:p-12 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h3>
                <p className="text-slate-600 text-sm">Your locksmith has been notified and is on the way.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setShowSignatureModal(false)}>
          <div className="bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900">Sign to Complete</h2>
              <button onClick={() => setShowSignatureModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Please confirm the following before signing:</p>
                <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={signatureConfirms.work} onChange={(e) => setSignatureConfirms(prev => ({ ...prev, work: e.target.checked }))} className="mt-1 w-4 h-4 text-green-600 rounded" />
                  <span className="text-sm text-slate-700">The work has been completed as described</span>
                </label>
                <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={signatureConfirms.price} onChange={(e) => setSignatureConfirms(prev => ({ ...prev, price: e.target.checked }))} className="mt-1 w-4 h-4 text-green-600 rounded" />
                  <span className="text-sm text-slate-700">The price is as quoted ({quote ? `£${quote.total.toFixed(2)}` : 'N/A'})</span>
                </label>
                <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={signatureConfirms.satisfied} onChange={(e) => setSignatureConfirms(prev => ({ ...prev, satisfied: e.target.checked }))} className="mt-1 w-4 h-4 text-green-600 rounded" />
                  <span className="text-sm text-slate-700">I am satisfied with the service provided</span>
                </label>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-slate-700 mb-3">Your Signature</p>
                <SignaturePad onSign={handleSubmitSignature} />
              </div>

              {isSubmittingSignature && (
                <div className="py-4 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                  <p className="text-slate-500 text-sm">Submitting signature...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post-Service Review Modal */}
      {job && job.locksmith && (
        <PostServiceReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSubmit={handleSubmitReview}
          jobNumber={job.jobNumber}
          locksmithName={job.locksmith.name}
        />
      )}
    </div>
  );
}
