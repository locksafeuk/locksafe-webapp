"use client";

import { useState, useCallback } from "react";

export interface GPSData {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface UseGPSResult {
  getGPS: () => Promise<GPSData | null>;
  isGetting: boolean;
  error: string | null;
  lastPosition: GPSData | null;
}

/**
 * Hook for capturing GPS coordinates
 * Used for anti-fraud protection across the app
 */
export function useGPS(): UseGPSResult {
  const [isGetting, setIsGetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPosition, setLastPosition] = useState<GPSData | null>(null);

  const getGPS = useCallback(async (): Promise<GPSData | null> => {
    setIsGetting(true);
    setError(null);

    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) {
        setError("GPS not available on this device");
        setIsGetting(false);
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const gpsData: GPSData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          };
          setLastPosition(gpsData);
          setIsGetting(false);
          resolve(gpsData);
        },
        (err) => {
          console.error("GPS error:", err);
          let errorMessage = "Could not get GPS location";
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = "Location permission denied";
              break;
            case err.POSITION_UNAVAILABLE:
              errorMessage = "Location unavailable";
              break;
            case err.TIMEOUT:
              errorMessage = "Location request timed out";
              break;
          }
          setError(errorMessage);
          setIsGetting(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // Cache for 1 minute
        }
      );
    });
  }, []);

  return {
    getGPS,
    isGetting,
    error,
    lastPosition,
  };
}

/**
 * Simple function to get GPS coordinates (non-hook version for one-off use)
 * Returns null if GPS is not available or permission denied
 */
export async function captureGPS(): Promise<GPSData | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
