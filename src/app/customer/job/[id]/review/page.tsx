"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Star,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ThumbsUp,
  MessageSquare,
  Shield,
  Clock,
  Wrench,
  PoundSterling,
  User,
} from "lucide-react";

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  address: string;
  postcode: string;
  locksmith: {
    id: string;
    name: string;
    companyName: string | null;
  } | null;
  quote: {
    total: number;
  } | null;
  completedAt: string | null;
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

const quickFeedback = [
  { id: "punctual", label: "Punctual", icon: Clock },
  { id: "professional", label: "Professional", icon: Shield },
  { id: "skilled", label: "Skilled Work", icon: Wrench },
  { id: "fair-price", label: "Fair Price", icon: PoundSterling },
  { id: "friendly", label: "Friendly", icon: User },
];

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Review state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState<string[]>([]);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);

  // Fetch job data
  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/jobs/${id}`);
        const data = await response.json();

        if (data.success) {
          // Check if already reviewed
          if (data.job.review) {
            setSubmitted(true);
            setRating(data.job.review.rating);
            setComment(data.job.review.comment || "");
          }

          setJob({
            id: data.job.id,
            jobNumber: data.job.jobNumber,
            status: data.job.status,
            problemType: data.job.problemType,
            address: data.job.address,
            postcode: data.job.postcode,
            locksmith: data.job.locksmith,
            quote: data.job.quote,
            completedAt: data.job.workCompletedAt || data.job.signedAt,
          });
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

    fetchJob();
  }, [id]);

  const toggleFeedback = (feedbackId: string) => {
    setSelectedFeedback(prev =>
      prev.includes(feedbackId)
        ? prev.filter(f => f !== feedbackId)
        : [...prev, feedbackId]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      alert("Please select a rating");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment,
          feedback: selectedFeedback,
          wouldRecommend,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        alert(data.error || "Failed to submit review");
      }
    } catch (err) {
      alert("Failed to submit review");
      console.error("Error submitting review:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "Job not found"}</p>
          <Link href="/">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if job is completed
  if (!["COMPLETED", "SIGNED"].includes(job.status)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Job Not Completed Yet</h1>
          <p className="text-slate-600 mb-6">
            You can leave a review once the locksmith has completed the work.
          </p>
          <Link href={`/customer/job/${id}`}>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Track Job Progress
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Thank you state (after submission)
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h1>
          <p className="text-slate-600 mb-6">
            Your review helps other customers find reliable locksmiths and helps {job.locksmith?.name || "the locksmith"} improve their service.
          </p>

          {/* Rating display */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="flex justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-8 h-8 ${
                    star <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-slate-600">You rated this service {rating}/5 stars</p>
          </div>

          <div className="space-y-2">
            <Link href={`/report/${id}`}>
              <Button variant="outline" className="w-full">
                View Job Report
              </Button>
            </Link>
            <Link href="/customer/dashboard">
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/customer/job/${id}`} className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-slate-900">Leave a Review</h1>
              <p className="text-sm text-slate-500">Job #{job.jobNumber}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Job Summary */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {job.locksmith?.name?.split(" ").map(n => n[0]).join("") || "LS"}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg text-slate-900">
                {job.locksmith?.name || "Locksmith"}
              </h2>
              {job.locksmith?.companyName && (
                <p className="text-slate-500 text-sm">{job.locksmith.companyName}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-600">
                <span>{problemLabels[job.problemType] || job.problemType}</span>
                <span>{job.postcode}</span>
                {job.quote && <span className="text-green-600 font-medium">£{job.quote.total}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Star Rating */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-bold text-slate-900 mb-4 text-center">How was your experience?</h3>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-12 h-12 transition-colors ${
                    star <= (hoverRating || rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-200 hover:text-amber-200"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-slate-500 text-sm">
            {rating === 0 && "Tap a star to rate"}
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent!"}
          </p>
        </div>

        {/* Quick Feedback Tags */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-bold text-slate-900 mb-4">What went well?</h3>
          <div className="flex flex-wrap gap-2">
            {quickFeedback.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedFeedback.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleFeedback(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                    isSelected
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 text-slate-600 hover:border-orange-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Would Recommend */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-bold text-slate-900 mb-4">Would you recommend this locksmith?</h3>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setWouldRecommend(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                wouldRecommend === true
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-slate-200 text-slate-600 hover:border-green-300"
              }`}
            >
              <ThumbsUp className="w-5 h-5" />
              <span className="font-medium">Yes!</span>
            </button>
            <button
              type="button"
              onClick={() => setWouldRecommend(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                wouldRecommend === false
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-slate-200 text-slate-600 hover:border-red-300"
              }`}
            >
              <ThumbsUp className="w-5 h-5 rotate-180" />
              <span className="font-medium">No</span>
            </button>
          </div>
        </div>

        {/* Written Review */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-slate-900">Tell us more (optional)</h3>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this locksmith..."
            rows={4}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
          />
          <p className="text-xs text-slate-400 mt-2">
            Your review may be displayed publicly to help other customers.
          </p>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full py-6 bg-orange-500 hover:bg-orange-600 text-white text-lg"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            <>
              <Star className="w-5 h-5 mr-2" />
              Submit Review
            </>
          )}
        </Button>

        <p className="text-center text-sm text-slate-500 mt-4">
          By submitting, you agree to our review guidelines.
        </p>
      </main>
    </div>
  );
}
