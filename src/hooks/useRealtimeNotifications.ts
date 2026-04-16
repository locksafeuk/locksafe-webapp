"use client";

import { useEffect, useState, useCallback } from "react";

interface NotificationEvent {
  type: string;
  data?: unknown;
}

interface UseRealtimeNotificationsOptions {
  jobId: string;
  onLocksmithApplied?: (data: {
    locksmithName: string;
    assessmentFee: number;
    eta: number;
    rating: number;
  }) => void;
  onQuoteReceived?: (data: {
    quoteId: string;
    total: number;
    estimatedTime: number;
  }) => void;
  onLocksmithArrived?: () => void;
  onJobStatusUpdate?: (status: string) => void;
  onQuoteAccepted?: () => void;
  onQuoteDeclined?: () => void;
  onWorkCompleted?: () => void;
}

export function useRealtimeNotifications({
  jobId,
  onLocksmithApplied,
  onQuoteReceived,
  onLocksmithArrived,
  onJobStatusUpdate,
  onQuoteAccepted,
  onQuoteDeclined,
  onWorkCompleted,
}: UseRealtimeNotificationsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<NotificationEvent | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connect = useCallback(() => {
    const eventSource = new EventSource(`/api/notifications/stream?jobId=${jobId}`);

    eventSource.onopen = () => {
      setIsConnected(true);
      setReconnectAttempts(0);
      console.log("SSE connected for job:", jobId);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as NotificationEvent;
        setLastEvent(data);

        switch (data.type) {
          case "connected":
            console.log("SSE connection confirmed");
            break;

          case "ping":
            // Heartbeat, ignore
            break;

          case "locksmith_applied":
            if (onLocksmithApplied && data.data) {
              onLocksmithApplied(data.data as {
                locksmithName: string;
                assessmentFee: number;
                eta: number;
                rating: number;
              });
            }
            break;

          case "quote_received":
            if (onQuoteReceived && data.data) {
              onQuoteReceived(data.data as {
                quoteId: string;
                total: number;
                estimatedTime: number;
              });
            }
            break;

          case "locksmith_arrived":
            if (onLocksmithArrived) {
              onLocksmithArrived();
            }
            break;

          case "status_update":
            if (onJobStatusUpdate && data.data) {
              onJobStatusUpdate((data.data as { status: string }).status);
            }
            break;

          case "quote_accepted":
            if (onQuoteAccepted) {
              onQuoteAccepted();
            }
            break;

          case "quote_declined":
            if (onQuoteDeclined) {
              onQuoteDeclined();
            }
            break;

          case "work_completed":
            if (onWorkCompleted) {
              onWorkCompleted();
            }
            break;

          default:
            console.log("Unknown SSE event:", data.type);
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();

      // Reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(`SSE disconnected, reconnecting in ${delay}ms...`);

      setTimeout(() => {
        setReconnectAttempts((prev) => prev + 1);
        connect();
      }, delay);
    };

    return eventSource;
  }, [
    jobId,
    reconnectAttempts,
    onLocksmithApplied,
    onQuoteReceived,
    onLocksmithArrived,
    onJobStatusUpdate,
    onQuoteAccepted,
    onQuoteDeclined,
    onWorkCompleted,
  ]);

  useEffect(() => {
    const eventSource = connect();

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [connect]);

  return {
    isConnected,
    lastEvent,
  };
}

// Helper to send notifications from the server/API
export async function sendNotification(
  jobId: string,
  type: string,
  data?: unknown
) {
  try {
    await fetch("/api/notifications/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, type, data }),
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}
