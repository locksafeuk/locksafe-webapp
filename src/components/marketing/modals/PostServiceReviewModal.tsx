"use client";

import { useState } from "react";
import { X, Star, MessageSquare, Gift, Check, Loader2, Share2 } from "lucide-react";

interface PostServiceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { rating: number; comment: string }) => Promise<void>;
  jobNumber?: string;
  locksmithName?: string;
}

export function PostServiceReviewModal({
  isOpen,
  onClose,
  onSubmit,
  jobNumber = "SW1-JOB123",
  locksmithName = "Your Locksmith",
}: PostServiceReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showReferral, setShowReferral] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ rating, comment });
      setIsSuccess(true);
      setTimeout(() => setShowReferral(true), 1500);
    } catch (err) {
      console.error("Failed to submit review:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = () => {
    const shareText = `I just used LockSafe UK for my locksmith needs. Fast, transparent, and professional! Use my code FRIEND10 for 10% off.`;
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
    }
  };

  // Success + Referral state
  if (showReferral) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-xs bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 rounded-full z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-5 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Gift className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Thanks for your review!</h3>
            <p className="text-sm text-slate-600 mb-4">
              Know someone who needs a locksmith? Share and you both get £10 off!
            </p>

            {/* Referral Code */}
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <div className="text-xs text-slate-500 mb-1">Your referral code</div>
              <div className="text-lg font-bold font-mono text-slate-900">FRIEND10</div>
            </div>

            <button
              onClick={handleShare}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share & Earn £10
            </button>

            <button
              onClick={onClose}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 mt-3"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state (brief)
  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-8 text-center animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Thank you!</h3>
          <p className="text-sm text-gray-600">Your review helps other customers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xs bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 rounded-full z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="bg-emerald-600 px-4 py-4 text-center">
          <Check className="w-8 h-8 text-white mx-auto mb-2" />
          <h2 className="text-base font-bold text-white">Job Complete!</h2>
          <p className="text-emerald-100 text-xs mt-1">How was your experience?</p>
        </div>

        {/* Rating */}
        <div className="p-4">
          <div className="text-center mb-3">
            <p className="text-sm text-slate-600 mb-2">Rate {locksmithName}</p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                {rating === 5 ? "Excellent!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="mb-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
              <MessageSquare className="w-3 h-3" />
              Add a comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell others about your experience..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Job info */}
          <div className="text-center text-[10px] text-slate-400 mb-3">
            Job {jobNumber}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Submit Review</>
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-600 mt-2"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
