"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface LocksmithLocation {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  accuracy: number;
  timestamp: string;
  locksmithId: string;
  jobId: string;
}

interface UseLiveTrackingOptions {
  jobId: string;
  enabled?: boolean;
  onLocationUpdate?: (location: LocksmithLocation) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseLiveTrackingReturn {
  location: LocksmithLocation | null;
  isConnected: boolean;
  error: Error | null;
  lastUpdate: Date | null;
  reconnect: () => void;
}

export function useLiveTracking({
  jobId,
  enabled = true,
  onLocationUpdate,
  onError,
  onConnectionChange,
}: UseLiveTrackingOptions): UseLiveTrackingReturn {
  const [location, setLocation] = useState<LocksmithLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled || !jobId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/tracking/stream?jobId=${encodeURIComponent(jobId)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log(`Live tracking connected for job ${jobId}`);
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      onConnectionChange?.(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          console.log("Tracking stream connected:", data);
          return;
        }

        if (data.type === "location_update") {
          const locationData: LocksmithLocation = {
            lat: data.lat,
            lng: data.lng,
            heading: data.heading || 0,
            speed: data.speed || 0,
            accuracy: data.accuracy || 10,
            timestamp: data.timestamp,
            locksmithId: data.locksmithId,
            jobId: data.jobId,
          };

          setLocation(locationData);
          setLastUpdate(new Date());
          onLocationUpdate?.(locationData);
        }
      } catch (err) {
        console.error("Error parsing tracking data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("Tracking connection error:", err);
      setIsConnected(false);
      onConnectionChange?.(false);

      eventSource.close();

      // Attempt reconnection with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        const connectionError = new Error("Failed to connect to tracking service");
        setError(connectionError);
        onError?.(connectionError);
      }
    };
  }, [jobId, enabled, onLocationUpdate, onError, onConnectionChange]);

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    if (enabled && jobId) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled, jobId, connect]);

  return {
    location,
    isConnected,
    error,
    lastUpdate,
    reconnect,
  };
}

// Hook for locksmith to broadcast their location
interface UseBroadcastLocationOptions {
  jobId: string;
  locksmithId: string;
  enabled?: boolean;
  interval?: number; // ms between updates
}

interface UseBroadcastLocationReturn {
  isTracking: boolean;
  lastBroadcast: Date | null;
  error: Error | null;
  startTracking: () => void;
  stopTracking: () => void;
}

export function useBroadcastLocation({
  jobId,
  locksmithId,
  enabled = false,
  interval = 5000,
}: UseBroadcastLocationOptions): UseBroadcastLocationReturn {
  const [isTracking, setIsTracking] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);

  const broadcastLocation = useCallback(async (position: GeolocationPosition) => {
    try {
      const response = await fetch("/api/tracking/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          locksmithId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading || 0,
          speed: position.coords.speed || 0,
          accuracy: position.coords.accuracy,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to broadcast location");
      }

      setLastBroadcast(new Date());
      setError(null);
    } catch (err) {
      console.error("Error broadcasting location:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    }
  }, [jobId, locksmithId]);

  const startTracking = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError(new Error("Geolocation not supported"));
      return;
    }

    setIsTracking(true);
    setError(null);

    // Watch position for real-time updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        lastPositionRef.current = position;
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError(new Error(err.message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // Broadcast at regular intervals
    intervalRef.current = setInterval(() => {
      if (lastPositionRef.current) {
        broadcastLocation(lastPositionRef.current);
      }
    }, interval);

    // Initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        lastPositionRef.current = position;
        broadcastLocation(position);
      },
      (err) => {
        console.error("Initial position error:", err);
      },
      { enableHighAccuracy: true }
    );
  }, [interval, broadcastLocation]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, startTracking, stopTracking]);

  return {
    isTracking,
    lastBroadcast,
    error,
    startTracking,
    stopTracking,
  };
}
