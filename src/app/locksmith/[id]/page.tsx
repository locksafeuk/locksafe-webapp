"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Star,
  Shield,
  Clock,
  MapPin,
  CheckCircle2,
  Briefcase,
  Calendar,
  ChevronDown,
  ThumbsUp,
  MessageSquare,
  ArrowLeft,
  Award,
  Wrench,
  Phone,
} from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string;
  jobType: string;
  location: string;
}

interface LocksmithProfile {
  id: string;
  name: string;
  company: string | null;
  avatar: string;
  rating: number;
  reviewCount: number;
  totalJobs: number;
  verified: boolean;
  yearsExperience: number;
  services: string[];
  coverageAreas: string[];
  memberSince: string;
  avgResponseTime: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  reviews: Review[];
}

const problemLabels: Record<string, string> = {
  lockout: "Lockout Service",
  broken: "Lock Repair",
  "key-stuck": "Key Extraction",
  "lost-keys": "Key Replacement",
  burglary: "Security Upgrade",
  other: "General Service",
};

const serviceLabels: Record<string, string> = {
  lockout: "Emergency Lockouts",
  broken: "Lock Repairs",
  "key-stuck": "Key Extraction",
  "lost-keys": "Key Cutting & Replacement",
  burglary: "Security Upgrades",
  residential: "Residential Services",
  commercial: "Commercial Services",
  automotive: "Auto Locksmith",
};

export default function LocksmithProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [profile, setProfile] = useState<LocksmithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "highest" | "lowest">("recent");
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/locksmiths/${id}`);
        const data = await response.json();

        if (data.success) {
          setProfile(data.profile);
        } else {
          setError(data.error || "Failed to load profile");
        }
      } catch (err) {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  const getTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return "Today";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const sortedReviews = profile?.reviews
    ? [...profile.reviews].sort((a, b) => {
        if (sortBy === "highest") return b.rating - a.rating;
        if (sortBy === "lowest") return a.rating - b.rating;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  const displayedReviews = showAllReviews ? sortedReviews : sortedReviews.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">{error || "Locksmith not found"}</p>
          <Link href="/">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalRatings = Object.values(profile.ratingBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
              <span className="text-xl font-bold text-slate-900">
                Lock<span className="text-orange-500">Safe</span>
              </span>
            </Link>
            <Link href="/request">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                Get Help Now
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white text-3xl sm:text-4xl font-bold shadow-lg">
                {profile.avatar}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                      {profile.name}
                    </h1>
                    {profile.verified && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold border border-green-200">
                        <Shield className="w-4 h-4 fill-green-600 text-green-600" />
                        Verified
                      </span>
                    )}
                  </div>
                  {profile.company && (
                    <p className="text-slate-600 mb-2">{profile.company}</p>
                  )}

                  {/* Rating */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-5 h-5 ${
                            star <= Math.round(profile.rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xl font-bold text-slate-900">
                      {profile.rating.toFixed(1)}
                    </span>
                    <span className="text-slate-500">
                      ({profile.reviewCount} reviews)
                    </span>
                  </div>
                </div>

                <Link href="/request">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3">
                    <Phone className="w-4 h-4 mr-2" />
                    Request This Locksmith
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-orange-500" />
                  <span className="text-slate-600">
                    <strong className="text-slate-900">{profile.totalJobs}</strong>{" "}
                    Jobs Completed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-slate-600">
                    <strong className="text-slate-900">{profile.avgResponseTime} min</strong>{" "}
                    Avg Response
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-orange-500" />
                  <span className="text-slate-600">
                    <strong className="text-slate-900">{profile.yearsExperience}+</strong>{" "}
                    Years Experience
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span className="text-slate-600">
                    Member since{" "}
                    <strong className="text-slate-900">
                      {new Date(profile.memberSince).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Services & Coverage */}
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          {/* Services */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              Services Offered
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.services.map((service) => (
                <span
                  key={service}
                  className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium"
                >
                  {serviceLabels[service] || service}
                </span>
              ))}
            </div>
          </div>

          {/* Coverage Areas */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Coverage Areas
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.coverageAreas.map((area) => (
                <span
                  key={area}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium"
                >
                  {area}
                </span>
              ))}
              {profile.coverageAreas.length >= 10 && (
                <span className="px-3 py-1.5 text-slate-500 text-sm">
                  + more areas
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rating Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Rating Breakdown</h2>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = profile.ratingBreakdown[star as keyof typeof profile.ratingBreakdown];
              const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;

              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16">
                    <span className="text-sm font-medium text-slate-600">{star}</span>
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-500 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Customer Reviews ({profile.reviewCount})
            </h2>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-slate-100 border-none rounded-lg px-4 py-2 pr-10 text-sm font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-orange-500"
              >
                <option value="recent">Most Recent</option>
                <option value="highest">Highest Rated</option>
                <option value="lowest">Lowest Rated</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-6">
            {displayedReviews.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No reviews yet. Be the first to leave a review!
              </p>
            ) : (
              displayedReviews.map((review) => (
                <div key={review.id} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
                          {review.customerName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span className="font-medium text-slate-900">
                          {review.customerName}
                        </span>
                        {review.rating >= 4 && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          {problemLabels[review.jobType] || review.jobType}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {review.location}
                        </span>
                        <span>{getTimeAgo(review.createdAt)}</span>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-slate-700 leading-relaxed pl-10">
                      "{review.comment}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Show More */}
          {sortedReviews.length > 5 && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => setShowAllReviews(!showAllReviews)}
                className="px-6"
              >
                {showAllReviews
                  ? "Show Less"
                  : `Show All ${sortedReviews.length} Reviews`}
                <ChevronDown
                  className={`w-4 h-4 ml-2 transition-transform ${
                    showAllReviews ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 mt-6 text-center text-white">
          <h3 className="text-xl font-bold mb-2">Need a Locksmith?</h3>
          <p className="text-orange-100 mb-4">
            Get instant help from {profile.name} and other verified locksmiths in your area.
          </p>
          <Link href="/request">
            <Button className="bg-white text-orange-600 hover:bg-orange-50 px-8 py-3 font-semibold">
              Get Emergency Help Now
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
