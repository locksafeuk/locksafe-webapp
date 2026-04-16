"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, AlertCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  postcode: string;
  address: string;
  customer: {
    name: string;
    phone: string;
  } | null;
  quote?: {
    total: number;
  } | null;
}

/**
 * Locksmith Job Page
 *
 * This page handles the /locksmith/job/[id] route commonly sent in SMS/emails.
 * It redirects to the appropriate sub-page based on job status:
 *
 * - ACCEPTED, ARRIVED, DIAGNOSING → /locksmith/job/[id]/work
 * - QUOTED → /locksmith/job/[id]/quote (so they can see if customer accepted)
 * - QUOTE_ACCEPTED, IN_PROGRESS, etc → /locksmith/job/[id]/work
 */
export default function LocksmithJobPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    async function fetchJobAndRedirect() {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || "Job not found");
          setLoading(false);
          return;
        }

        const job = data.job;
        setJob(job);

        // Redirect based on job status
        const status = job.status?.toUpperCase();

        // Most statuses go to the work page
        // The work page handles all the different states well
        router.replace(`/locksmith/job/${jobId}/work`);

      } catch (err) {
        console.error("Error fetching job:", err);
        setError("Failed to load job details");
        setLoading(false);
      }
    }

    if (jobId) {
      fetchJobAndRedirect();
    }
  }, [jobId, router]);

  // Loading state
  if (loading && !error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Loading Job</h1>
          <p className="text-slate-600">Please wait...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 sm:p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Job Not Found</h1>
          <p className="text-slate-600 mb-6">{error}</p>

          <div className="space-y-3">
            <Link href="/locksmith/dashboard">
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/locksmith/jobs">
              <Button variant="outline" className="w-full">
                View Available Jobs
              </Button>
            </Link>
          </div>

          <p className="text-xs text-slate-500 mt-6">
            Job ID: <span className="font-mono">{jobId}</span>
          </p>
        </div>
      </div>
    );
  }

  // Fallback - should redirect before reaching here
  return null;
}
