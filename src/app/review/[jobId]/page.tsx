"use client";

import { useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Star,
  CheckCircle2,
  ThumbsUp,
  Clock,
  Wrench,
  MessageSquare,
  Shield,
  ArrowLeft,
} from "lucide-react";

// Mock job data
const mockJobData = {
  jobNumber: "LS-202602-0003",
  locksmith: {
    name: "Mike Thompson",
    company: "Thompson Locks Ltd",
    avatar: "MT",
  },
  completedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  totalPaid: 195,
  workDone: "Euro cylinder replacement with anti-snap upgrade",
};

const ratingCategories = [
  {
    id: "overall",
    label: "Overall Experience",
    description: "How was your overall experience?",
    icon: Star,
  },
  {
    id: "punctuality",
    label: "Punctuality",
    description: "Did they arrive on time?",
    icon: Clock,
  },
  {
    id: "quality",
    label: "Work Quality",
    description: "How was the quality of work?",
    icon: Wrench,
  },
  {
    id: "communication",
    label: "Communication",
    description: "Were they clear and professional?",
    icon: MessageSquare,
  },
];

export default function ReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [job] = useState(mockJobData);
  const [ratings, setRatings] = useState<Record<string, number>>({
    overall: 0,
    punctuality: 0,
    quality: 0,
    communication: 0,
  });
  const [hoverRatings, setHoverRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRatingClick = (category: string, rating: number) => {
    setRatings({ ...ratings, [category]: rating });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setSubmitted(true);
  };

  const averageRating =
    Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length;

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h1>
          <p className="text-slate-600 mb-6">
            Your review helps other customers and supports great locksmiths.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="text-sm text-slate-500 mb-1">Your Rating</div>
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-6 h-6 ${
                    star <= Math.round(averageRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300"
                  }`}
                />
              ))}
            </div>
            <div className="text-lg font-bold text-slate-900">
              {averageRating.toFixed(1)} out of 5
            </div>
          </div>

          <Link href="/">
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="section-container py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900">
                Lock<span className="text-orange-500">Safe</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="section-container py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Rate Your Experience
            </h1>
            <p className="text-slate-600">
              Help others by sharing your experience with {job.locksmith.name}
            </p>
          </div>

          {/* Job Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                {job.locksmith.avatar}
              </div>
              <div>
                <div className="font-bold text-lg text-slate-900">{job.locksmith.name}</div>
                <div className="text-slate-500">{job.locksmith.company}</div>
                <div className="text-sm text-slate-400 mt-1">Job #{job.jobNumber}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-slate-500">Work completed</div>
              <div className="font-medium">{job.workDone}</div>
            </div>
          </div>

          {/* Rating Categories */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="font-bold text-lg text-slate-900 mb-6">Rate Your Experience</h2>

            <div className="space-y-6">
              {ratingCategories.map((category) => (
                <div key={category.id} className="pb-6 border-b last:border-0 last:pb-0">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <category.icon className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{category.label}</div>
                      <div className="text-sm text-slate-500 mb-3">{category.description}</div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() =>
                              setHoverRatings({ ...hoverRatings, [category.id]: star })
                            }
                            onMouseLeave={() =>
                              setHoverRatings({ ...hoverRatings, [category.id]: 0 })
                            }
                            onClick={() => handleRatingClick(category.id, star)}
                            className="p-1 transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-8 h-8 ${
                                star <= (hoverRatings[category.id] || ratings[category.id])
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Would Recommend */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="font-bold text-lg text-slate-900 mb-4">
              Would you recommend {job.locksmith.name}?
            </h2>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setWouldRecommend(true)}
                className={`flex-1 py-4 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-all ${
                  wouldRecommend === true
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <ThumbsUp className="w-5 h-5" />
                Yes, definitely!
              </button>
              <button
                type="button"
                onClick={() => setWouldRecommend(false)}
                className={`flex-1 py-4 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-all ${
                  wouldRecommend === false
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <ThumbsUp className="w-5 h-5 rotate-180" />
                Not really
              </button>
            </div>
          </div>

          {/* Written Review */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="font-bold text-lg text-slate-900 mb-4">
              Share more details (optional)
            </h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell others about your experience..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
            />
            <p className="text-sm text-slate-400 mt-2">
              Your review will be displayed publicly with your first name
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Shield className="w-4 h-4 text-green-600" />
                <span>Your review is verified and protected</span>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={Object.values(ratings).some((r) => r === 0) || isSubmitting}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-6 text-lg"
            >
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
