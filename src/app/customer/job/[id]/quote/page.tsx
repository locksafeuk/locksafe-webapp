"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  X,
  Clock,
  Wrench,
  Package,
  Camera,
  Shield,
  Star,
  Phone,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Tag,
  CreditCard,
} from "lucide-react";
import { useTrackingEvents } from "@/hooks/useTrackingEvents";

interface QuotePart {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Quote {
  id: string;
  lockType: string;
  defect: string;
  difficulty: string;
  parts: QuotePart[];
  labourCost: number;
  labourTime: number;
  partsTotal: number;
  subtotal: number;
  vat: number;
  total: number;
  accepted: boolean;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  locksmith: {
    id: string;
    name: string;
    companyName: string | null;
    rating: number;
    phone: string;
  };
}

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  assessmentFee: number;
  assessmentPaid: boolean;
}

export default function CustomerQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { trackQuoteAccepted, trackQuoteDeclined, track } = useTrackingEvents();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"pending" | "accepted" | "declined">("pending");
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [quoteViewTracked, setQuoteViewTracked] = useState(false);

  // Track quote view when data is loaded
  useEffect(() => {
    if (quote && job && !quoteViewTracked) {
      track("quote_received", {
        jobId: id,
        jobNumber: job.jobNumber,
        quoteValue: quote.total,
        value: quote.total,
      });
      setQuoteViewTracked(true);
    }
  }, [quote, job, id, quoteViewTracked, track]);

  // Fetch quote and job data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [quoteRes, jobRes] = await Promise.all([
          fetch(`/api/jobs/${id}/quote`),
          fetch(`/api/jobs/${id}`),
        ]);

        const quoteData = await quoteRes.json();
        const jobData = await jobRes.json();

        if (quoteData.success && quoteData.quote) {
          setQuote(quoteData.quote);
          if (quoteData.quote.accepted) {
            setDecision("accepted");
          } else if (quoteData.quote.declinedAt) {
            setDecision("declined");
          }
        } else {
          setError("Quote not found");
        }

        if (jobData.success && jobData.job) {
          setJob(jobData.job);
        }
      } catch (err) {
        setError("Failed to load quote");
        console.error("Error fetching quote:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Calculate amounts
  const assessmentFeePaid = job?.assessmentPaid ? job.assessmentFee : 0;
  const quoteTotal = quote?.total || 0;
  const amountToPay = Math.max(0, quoteTotal - assessmentFeePaid);

  const handleAccept = async () => {
    if (!quote) return;

    setIsAccepting(true);
    try {
      const response = await fetch(`/api/jobs/${id}/quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      const data = await response.json();

      if (data.success) {
        setDecision("accepted");
        // Track quote acceptance
        trackQuoteAccepted(id, quote.total);
      } else {
        alert(data.error || "Failed to accept quote");
      }
    } catch (err) {
      alert("Failed to accept quote");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = () => {
    setShowDeclineConfirm(true);
  };

  const confirmDecline = async () => {
    setIsAccepting(true);
    try {
      const response = await fetch(`/api/jobs/${id}/quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });

      const data = await response.json();

      if (data.success) {
        setDecision("declined");
        setShowDeclineConfirm(false);
        // Track quote decline
        if (quote) {
          trackQuoteDeclined(id, quote.total);
        }
      } else {
        alert(data.error || "Failed to decline quote");
      }
    } catch (err) {
      alert("Failed to decline quote");
    } finally {
      setIsAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "Quote not found"}</p>
          <Link href={`/customer/job/${id}`}>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Back to Job
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (decision === "accepted") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Quote Accepted!</h1>
          <p className="text-slate-600 mb-6">
            {quote.locksmith.name} will now begin the work.
            Estimated completion time: {quote.labourTime} minutes.
          </p>

          {/* Payment summary */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <div className="text-sm text-slate-500 mb-2">Payment Summary</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Quote Total:</span>
                <span className="font-medium">£{quoteTotal.toFixed(2)}</span>
              </div>
              {assessmentFeePaid > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Assessment Fee Applied:</span>
                  <span>-£{assessmentFeePaid.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-bold text-slate-900">
                <span>Amount to Pay:</span>
                <span className="text-orange-600">£{amountToPay.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <Shield className="w-5 h-5" />
              <span className="font-semibold">Protected by LockSafe</span>
            </div>
            <p className="text-sm text-green-600">
              Work is documented with GPS, photos, and timestamps.
              You'll sign digitally when work is complete.
            </p>
          </div>

          <Link href={`/customer/job/${id}`}>
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              Track Progress
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (decision === "declined") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Quote Declined</h1>
          <p className="text-slate-600 mb-6">
            No problem! You've only paid the assessment fee of £{assessmentFeePaid.toFixed(2)}.
            The job has been closed.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <div className="text-sm text-slate-500 mb-1">Amount Paid</div>
            <div className="text-2xl font-bold text-slate-900">£{assessmentFeePaid.toFixed(2)}</div>
            <div className="text-sm text-slate-500 mt-1">Assessment fee only</div>
          </div>

          <Link href="/customer/dashboard">
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="section-container py-4">
          <div className="flex items-center justify-between">
            <Link href={`/customer/job/${id}`} className="flex items-center gap-2">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900">
                Lock<span className="text-orange-500">Safe</span>
              </span>
            </Link>
            {quote.locksmith.phone && (
              <a href={`tel:${quote.locksmith.phone}`}>
                <Button variant="outline" size="sm">
                  <Phone className="w-4 h-4 mr-2" />
                  Call Locksmith
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="section-container py-6">
        <Link href={`/customer/job/${id}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Job
        </Link>

        {/* Quote Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
              {quote.locksmith.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">Work Quote</h1>
              <div className="text-orange-100">{job?.jobNumber}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-orange-100">
            <span>From: {quote.locksmith.name}</span>
            <span>-</span>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-white text-white" />
              {quote.locksmith.rating?.toFixed(1) || "5.0"}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Diagnosis */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Diagnosis</h2>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-500 mb-1">Lock Type</div>
                    <div className="font-medium">{quote.lockType}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-500 mb-1">Difficulty</div>
                    <div className="font-medium capitalize">{quote.difficulty}</div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm text-slate-500 mb-1">Issue Found</div>
                  <div className="font-medium">{quote.defect}</div>
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Price Breakdown</h2>

              {/* Parts */}
              {quote.parts && quote.parts.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
                    <Package className="w-4 h-4" />
                    Parts
                  </div>
                  <div className="space-y-2">
                    {quote.parts.map((item, index) => (
                      <div key={index} className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-700">
                          {item.name} {item.quantity > 1 && `x${item.quantity}`}
                        </span>
                        <span className="font-medium">£{item.total.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 text-slate-600">
                      <span>Parts Subtotal</span>
                      <span className="font-semibold">£{quote.partsTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Labour */}
              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
                  <Wrench className="w-4 h-4" />
                  Labour
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-700">
                      Labour ({quote.labourTime} min estimated)
                    </span>
                    <span className="font-medium">£{quote.labourCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Total section with assessment fee deduction */}
              <div className="border-t-2 border-slate-200 pt-4 space-y-3">
                <div className="flex justify-between text-lg">
                  <span className="font-medium text-slate-700">Quote Subtotal</span>
                  <span className="font-bold text-slate-900">£{quote.subtotal.toFixed(2)}</span>
                </div>

                {quote.vat > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT (20%)</span>
                    <span>£{quote.vat.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg">
                  <span className="font-medium text-slate-700">Quote Total</span>
                  <span className="font-bold text-slate-900">£{quoteTotal.toFixed(2)}</span>
                </div>

                {/* Assessment Fee Deduction */}
                {assessmentFeePaid > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <Tag className="w-5 h-5" />
                      <span className="font-semibold">Assessment Fee Applied!</span>
                    </div>
                    <p className="text-sm text-green-600 mb-3">
                      Your assessment fee has been deducted from the total.
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Quote Total:</span>
                        <span>£{quoteTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-green-600 font-medium">
                        <span>Assessment Fee Paid:</span>
                        <span>-£{assessmentFeePaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-green-200">
                        <span>You Pay:</span>
                        <span className="text-orange-600">£{amountToPay.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {!assessmentFeePaid && (
                  <div className="flex justify-between text-xl pt-2 border-t">
                    <span className="font-bold text-slate-900">Total</span>
                    <span className="font-bold text-orange-600">£{quoteTotal.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span>Estimated work time: {quote.labourTime} minutes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Your Decision</h2>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                {assessmentFeePaid > 0 ? (
                  <>
                    <div className="text-sm text-orange-700 mb-1">Amount to Pay</div>
                    <div className="text-3xl font-bold text-orange-600">£{amountToPay.toFixed(2)}</div>
                    <div className="text-sm text-green-600 mt-1 flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      £{assessmentFeePaid.toFixed(2)} assessment fee applied
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-orange-700 mb-1">Total Quote</div>
                    <div className="text-3xl font-bold text-orange-600">£{quoteTotal.toFixed(2)}</div>
                  </>
                )}
                <div className="text-sm text-orange-600 mt-2">
                  Est. time: {quote.labourTime} min
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="w-5 h-5 mr-2" />
                      Accept Quote
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDecline}
                  disabled={isAccepting}
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 py-6 text-lg"
                >
                  <ThumbsDown className="w-5 h-5 mr-2" />
                  Decline Quote
                </Button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                <strong>No obligation:</strong> If you decline, you've only paid the
                assessment fee of £{assessmentFeePaid.toFixed(2)}. No additional charges.
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <Shield className="w-4 h-4 text-green-600" />
                <span>Protected by LockSafe anti-fraud</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedPhoto}
            alt="Documentation"
            className="max-w-full max-h-[90vh] rounded-lg"
          />
        </div>
      )}

      {/* Decline Confirmation Modal */}
      {showDeclineConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4 text-amber-600">
              <AlertTriangle className="w-8 h-8" />
              <h2 className="text-xl font-bold">Decline Quote?</h2>
            </div>
            <p className="text-slate-600 mb-6">
              Are you sure you want to decline this quote? The locksmith will leave and
              the job will be closed. You've paid £{assessmentFeePaid.toFixed(2)} for the assessment.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowDeclineConfirm(false)}
                variant="outline"
                className="flex-1"
                disabled={isAccepting}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDecline}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Yes, Decline"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
