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

export function useJobNotifications({
  locksmithId,
  enabled = true,
  onNewJob,
}: UseJobNotificationsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<JobNotification | null>(null);

  const connect = useCallback(() => {
    if (!locksmithId || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/notifications/broadcast?locksmithId=${locksmithId}&stream=true`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log(`[JobNotifications] Connected for locksmith ${locksmithId}`);
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Ignore connection confirmations and heartbeats
        if (data.type === "connected") {
          console.log(`[JobNotifications] Subscription confirmed`);
          return;
        }

        if (data.type === "NEW_JOB_IN_AREA") {
          console.log(`[JobNotifications] New job in area:`, data);

          const notification: JobNotification = {
            id: data.id,
            type: data.type,
            data: data.data,
            timestamp: data.timestamp,
          };

          setLastNotification(notification);

          // Call the callback
          if (onNewJob) {
            onNewJob(notification);
          }

          // Show browser notification
          showLocalNotification("New Job Available", {
            body: `${data.data.problemType} in ${data.data.postcode}`,
            tag: `job-${data.data.jobId}`,
            data: {
              url: `/locksmith/jobs`,
              jobId: data.data.jobId,
            },
          });
        }
      } catch (err) {
        console.error("[JobNotifications] Error parsing message:", err);
      }
    };

    eventSource.onerror = (error) => {
      console.error("[JobNotifications] Connection error:", error);
      setIsConnected(false);

      // Reconnect after 5 seconds
      setTimeout(() => {
        if (enabled && locksmithId) {
          connect();
        }
      }, 5000);
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [locksmithId, enabled, onNewJob]);

  useEffect(() => {
    const cleanup = connect();

    return () => {
      if (cleanup) cleanup();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastNotification,
    reconnect: connect,
  };
}
