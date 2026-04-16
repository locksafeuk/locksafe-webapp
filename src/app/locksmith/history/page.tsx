"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Clock,
  MapPin,
  CheckCircle2,
  Loader2,
  PoundSterling,
  ChevronRight,
  Calendar,
  Star,
  FileText,
  X,
  User,
  Phone,
  Camera,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";

interface CompletedJob {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  customer: { name: string; phone: string; email?: string };
  createdAt: string;
  completedAt: string | null;
  assessmentFee: number | null;
  quoteTotal: number | null;
  rating: number | null;
  review: string | null;
  photos: { id: string; url: string; type: string }[];
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

export default function JobHistoryPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<CompletedJob | null>(null);
  const [filter, setFilter] = useState<"all" | "completed" | "signed">("all");

  const fetchJobs = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const response = await fetch("/api/jobs");
      const data = await response.json();

      if (data.success) {
        const completedJobs = data.jobs
          .filter(
            (job: any) =>
              job.locksmithId === user.id && ["COMPLETED", "SIGNED"].includes(job.status)
          )
          .map((job: any) => ({
            id: job.id,
            jobNumber: job.jobNumber,
            status: job.status,
            problemType: job.problemType,
            propertyType: job.propertyType,
            postcode: job.postcode,
            address: job.address,
            customer: job.customer || { name: "Customer", phone: "N/A" },
            createdAt: job.createdAt,
            completedAt: job.workCompletedAt || job.updatedAt,
            assessmentFee: job.assessmentFee,
            quoteTotal: job.quote?.total || null,
            rating: job.review?.rating || null,
            review: job.review?.comment || null,
            photos: job.photos || [],
          }))
          .sort((a: CompletedJob, b: CompletedJob) =>
            new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
          );

        setJobs(completedJobs);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === "all") return true;
    if (filter === "completed") return job.status === "COMPLETED";
    if (filter === "signed") return job.status === "SIGNED";
    return true;
  });

  const totalEarnings = jobs.reduce((sum, job) => sum + (job.quoteTotal || job.assessmentFee || 0), 0);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading job history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Job History</h1>
        <p className="text-slate-500">View your completed jobs and earnings</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-slate-500 mb-1">Total Jobs</div>
          <div className="text-2xl font-bold text-slate-900">{jobs.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-slate-500 mb-1">Total Earned</div>
          <div className="text-2xl font-bold text-green-600">£{totalEarnings.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-sm text-slate-500 mb-1">Avg Rating</div>
          <div className="text-2xl font-bold text-amber-600 flex items-center gap-1">
            <Star className="w-5 h-5 fill-amber-500" />
            {jobs.filter(j => j.rating).length > 0
              ? (jobs.reduce((sum, j) => sum + (j.rating || 0), 0) / jobs.filter(j => j.rating).length).toFixed(1)
              : "5.0"}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { value: "all", label: "All Jobs" },
          { value: "signed", label: "Signed Off" },
          { value: "completed", label: "Awaiting Signature" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value as typeof filter)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === tab.value
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 sm:p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-2">No Completed Jobs</h3>
          <p className="text-slate-500 text-sm">Your completed jobs will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className="w-full bg-white rounded-2xl shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-slate-500">{job.jobNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        job.status === "SIGNED"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {job.status === "SIGNED" ? "Signed Off" : "Completed"}
                    </span>
                    {job.rating && (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {job.rating}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                    {problemLabels[job.problemType] || job.problemType}
                  </h3>
                  <div className="flex items-center flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.postcode}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(job.completedAt || job.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-base sm:text-lg font-bold text-green-600">
                    £{job.quoteTotal || job.assessmentFee || 0}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 ml-auto mt-1" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0 sticky top-0 bg-white rounded-t-2xl">
              <div>
                <div className="text-xs text-slate-500">{selectedJob.jobNumber}</div>
                <h2 className="text-lg font-bold text-slate-900">Job Details</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Status & Earnings */}
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                <div>
                  <div className="text-sm text-green-700">
                    {selectedJob.status === "SIGNED" ? "Signed Off" : "Completed"}
                  </div>
                  <div className="text-2xl font-bold text-green-700">
                    £{selectedJob.quoteTotal || selectedJob.assessmentFee || 0}
                  </div>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>

              {/* Job Info */}
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Service</div>
                  <div className="font-medium text-slate-900">
                    {problemLabels[selectedJob.problemType] || selectedJob.problemType}
                  </div>
                  <div className="text-sm text-slate-500 capitalize">{selectedJob.propertyType}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Location</div>
                  <div className="font-medium text-slate-900">{selectedJob.address}</div>
                  <div className="text-sm text-slate-500">{selectedJob.postcode}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Customer</div>
                  <div className="font-medium text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    {selectedJob.customer.name}
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {selectedJob.customer.phone}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Booked</div>
                    <div className="font-medium text-slate-900">{formatDate(selectedJob.createdAt)}</div>
                    <div className="text-sm text-slate-500">{formatTime(selectedJob.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Completed</div>
                    <div className="font-medium text-slate-900">
                      {selectedJob.completedAt ? formatDate(selectedJob.completedAt) : "—"}
                    </div>
                    <div className="text-sm text-slate-500">
                      {selectedJob.completedAt ? formatTime(selectedJob.completedAt) : ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* Review */}
              {selectedJob.rating && (
                <div className="p-4 bg-amber-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= selectedJob.rating!
                              ? "text-amber-500 fill-amber-500"
                              : "text-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-amber-700">
                      {selectedJob.rating}/5
                    </span>
                  </div>
                  {selectedJob.review && (
                    <p className="text-sm text-amber-800 italic">"{selectedJob.review}"</p>
                  )}
                </div>
              )}

              {/* Photos */}
              {selectedJob.photos.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Photos</div>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedJob.photos.map((photo) => (
                      <div key={photo.id} className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                        <img
                          src={photo.url}
                          alt={photo.type}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex-shrink-0">
              <Link href={`/locksmith/job/${selectedJob.id}/work`}>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  <FileText className="w-4 h-4 mr-2" />
                  View Full Details
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
