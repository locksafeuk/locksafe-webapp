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

const POLL_INTERVAL_MS = 30_000;

export function useJobNotifications({
  locksmithId,
  enabled = true,
  onNewJob,
}: UseJobNotificationsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownJobIdsRef = useRef<Set<string>>(new Set());
  const sseFailCountRef = useRef(0);
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

  // Polling fallback: fetch pending jobs and fire callback for new ones
  const pollForNewJobs = useCallback(async () => {
    if (!locksmithId) return;
    try {
      const res = await fetch(`/api/jobs?status=PENDING&availableForLocksmith=${locksmithId}`);
      if (!res.ok) return;
      const data = await res.json();
      const jobs: any[] = data.jobs || [];

      // First call — seed known IDs without firing callback
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
      // Silently ignore poll errors
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

  const connect = useCallback(() => {
    if (!locksmithId || !enabled) return;

    // Close existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // If SSE has failed twice already, go straight to polling
    if (sseFailCountRef.current >= 2) {
      startPolling();
      return;
    }

    const url = `/api/notifications/broadcast?locksmithId=${locksmithId}&stream=true`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[JobNotifications] SSE connected for locksmith ${locksmithId}`);
      sseFailCountRef.current = 0;
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") return;

        if (data.type === "NEW_JOB_IN_AREA") {
          const notification: JobNotification = {
            id: data.id,
            type: data.type,
            data: data.data,
            timestamp: data.timestamp,
          };
          knownJobIdsRef.current.add(data.data.jobId);
          handleNewJobNotification(notification);
        }
      } catch (err) {
        console.error("[JobNotifications] Error parsing SSE message:", err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;
      sseFailCountRef.current += 1;

      if (sseFailCountRef.current >= 2) {
        console.log("[JobNotifications] SSE unavailable, switching to polling");
        startPolling();
      } else {
        // Retry SSE once more after 5 seconds
        setTimeout(() => {
          if (enabled && locksmithId) connect();
        }, 5000);
      }
    };

    eventSourceRef.current = eventSource;
  }, [locksmithId, enabled, handleNewJobNotification, startPolling]);

  useEffect(() => {
    if (enabled && locksmithId) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopPolling();
    };
  }, [connect, enabled, locksmithId, stopPolling]);

  return {
    isConnected,
    lastNotification,
    reconnect: connect,
  };
}
