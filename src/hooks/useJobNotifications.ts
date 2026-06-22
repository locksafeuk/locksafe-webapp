"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { showLocalNotification } from "@/lib/push-notifications";

interface JobNotification {
  id: string;
  type: string;
  data: {
    jobId: string;
    jobNumber: string;
    problemType: string;
    postcode: string;
    address: string;
  };
  timestamp: string;
}

interface UseJobNotificationsOptions {
  locksmithId: string | undefined;
  enabled?: boolean;
  onNewJob?: (notification: JobNotification) => void;
}

// Poll the durable jobs endpoint on an interval. We deliberately do NOT use an
// SSE/EventSource stream: Vercel serverless can't hold a long-lived connection
// open, so the stream dropped and the browser reconnected in a tight loop —
// generating tens of thousands of edge requests from a single open dashboard
// and starving other functions (it even knocked out Stripe webhook deliveries).
// Interval polling is serverless-native and reliable.
const POLL_INTERVAL_MS = 30_000;

export function useJobNotifications({
  locksmithId,
  enabled = true,
  onNewJob,
}: UseJobNotificationsOptions) {
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownJobIdsRef = useRef<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<JobNotification | null>(null);

  const handleNewJobNotification = useCallback(
    (notification: JobNotification) => {
      setLastNotification(notification);
      if (onNewJob) onNewJob(notification);
      showLocalNotification("New Job Available", {
        body: `${notification.data.jobNumber ? `${notification.data.jobNumber} - ` : ""}${notification.data.problemType} in ${notification.data.postcode}`,
        tag: `job-${notification.data.jobId}`,
        data: { url: `/locksmith/jobs`, jobId: notification.data.jobId },
      });
    },
    [onNewJob]
  );

  // Fetch pending jobs available to this locksmith and fire the callback for
  // any we haven't seen yet.
  const pollForNewJobs = useCallback(async () => {
    if (!locksmithId) return;
    try {
      const res = await fetch(`/api/jobs?status=PENDING&availableForLocksmith=${locksmithId}`);
      if (!res.ok) return;
      const data = await res.json();
      const jobs: Array<{
        id: string;
        jobNumber: string;
        problemType: string;
        postcode: string;
        address: string;
        createdAt: string;
      }> = data.jobs || [];

      // First call — seed known IDs without firing callbacks.
      if (knownJobIdsRef.current.size === 0 && jobs.length > 0) {
        for (const job of jobs) knownJobIdsRef.current.add(job.id);
        return;
      }

      for (const job of jobs) {
        if (!knownJobIdsRef.current.has(job.id)) {
          knownJobIdsRef.current.add(job.id);
          handleNewJobNotification({
            id: `poll-${job.id}`,
            type: "NEW_JOB_IN_AREA",
            data: {
              jobId: job.id,
              jobNumber: job.jobNumber,
              problemType: job.problemType,
              postcode: job.postcode,
              address: job.address,
            },
            timestamp: job.createdAt,
          });
        }
      }
    } catch {
      // Silently ignore poll errors — next interval retries.
    }
  }, [locksmithId, handleNewJobNotification]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return; // already polling
    setIsConnected(true);
    pollForNewJobs(); // immediate first poll
    pollTimerRef.current = setInterval(pollForNewJobs, POLL_INTERVAL_MS);
  }, [pollForNewJobs]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled && locksmithId) {
      startPolling();
    }
    return () => {
      stopPolling();
    };
  }, [enabled, locksmithId, startPolling, stopPolling]);

  return {
    isConnected,
    lastNotification,
    reconnect: startPolling,
  };
}
