"use client";

import { useState, useEffect } from "react";
import { Power, Bell, BellOff, Loader2, Wifi, WifiOff } from "lucide-react";

interface AvailabilityToggleProps {
  locksmithId: string;
  initialAvailability?: boolean;
  onToggle?: (isAvailable: boolean) => void;
  variant?: "default" | "compact" | "minimal";
}

export function AvailabilityToggle({
  locksmithId,
  initialAvailability = true,
  onToggle,
  variant = "default",
}: AvailabilityToggleProps) {
  const [isAvailable, setIsAvailable] = useState(initialAvailability);
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  // Fetch current availability on mount
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const response = await fetch(`/api/locksmith/availability?locksmithId=${locksmithId}`);
        const data = await response.json();
        if (data.success) {
          setIsAvailable(data.isAvailable);
        }
      } catch (error) {
        console.error("Error fetching availability:", error);
      }
    };

    fetchAvailability();
  }, [locksmithId]);

  const handleToggle = async () => {
    if (isLoading) return;

    setIsLoading(true);
    const newAvailability = !isAvailable;

    try {
      const response = await fetch("/api/locksmith/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locksmithId,
          isAvailable: newAvailability,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAvailable(newAvailability);
        setFeedbackMessage(data.message);
        setShowFeedback(true);
        onToggle?.(newAvailability);

        // Hide feedback after 3 seconds
        setTimeout(() => {
          setShowFeedback(false);
        }, 3000);
      } else {
        console.error("Failed to toggle availability:", data.error);
      }
    } catch (error) {
      console.error("Error toggling availability:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Compact variant - just the toggle
  if (variant === "compact") {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          isAvailable
            ? "bg-emerald-500 focus:ring-emerald-500"
            : "bg-slate-300 focus:ring-slate-400"
        } ${isLoading ? "opacity-70 cursor-wait" : "cursor-pointer"}`}
        aria-label={isAvailable ? "Available for jobs" : "Unavailable for jobs"}
      >
        <span
          className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-300 ${
            isAvailable ? "translate-x-8" : "translate-x-1"
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : isAvailable ? (
            <Bell className="h-3 w-3 text-emerald-500" />
          ) : (
            <BellOff className="h-3 w-3 text-slate-400" />
          )}
        </span>
      </button>
    );
  }

  // Minimal variant - small indicator
  if (variant === "minimal") {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
          isAvailable
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        } ${isLoading ? "opacity-70 cursor-wait" : "cursor-pointer"}`}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span
            className={`h-2 w-2 rounded-full ${
              isAvailable ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
            }`}
          />
        )}
        <span>{isAvailable ? "Available" : "Unavailable"}</span>
      </button>
    );
  }

  // Default full variant
  return (
    <div className="w-full">
      {/* Main Toggle Card */}
      <div
        className={`relative overflow-hidden rounded-2xl transition-all duration-500 ${
          isAvailable
            ? "bg-gradient-to-br from-emerald-500 to-green-600"
            : "bg-gradient-to-br from-slate-400 to-slate-500"
        }`}
      >
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className={`absolute top-0 left-0 w-32 h-32 rounded-full bg-white transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ${
              isAvailable ? "scale-100" : "scale-75"
            }`}
          />
          <div
            className={`absolute bottom-0 right-0 w-48 h-48 rounded-full bg-white transform translate-x-1/3 translate-y-1/3 transition-all duration-500 ${
              isAvailable ? "scale-100" : "scale-75"
            }`}
          />
        </div>

        {/* Content */}
        <div className="relative p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Status info */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              {/* Animated Icon */}
              <div
                className={`relative flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isAvailable ? "bg-white/25" : "bg-white/20"
                }`}
              >
                {isAvailable ? (
                  <div className="relative">
                    <Wifi className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full" />
                  </div>
                ) : (
                  <WifiOff className="w-6 h-6 sm:w-7 sm:h-7 text-white/80" />
                )}
              </div>

              {/* Text */}
              <div className="min-w-0">
                <h3 className="text-white font-bold text-base sm:text-lg truncate">
                  {isAvailable ? "You're Available" : "You're Offline"}
                </h3>
                <p className="text-white/80 text-xs sm:text-sm truncate">
                  {isAvailable
                    ? "Receiving job notifications"
                    : "Job notifications paused"}
                </p>
              </div>
            </div>

            {/* Right side - Toggle Switch */}
            <div className="flex-shrink-0">
              <button
                onClick={handleToggle}
                disabled={isLoading}
                className={`relative inline-flex h-8 w-16 sm:h-9 sm:w-[72px] items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent ${
                  isAvailable
                    ? "bg-white/30 hover:bg-white/40"
                    : "bg-white/20 hover:bg-white/30"
                } ${isLoading ? "cursor-wait" : "cursor-pointer"}`}
                aria-label={isAvailable ? "Turn off availability" : "Turn on availability"}
              >
                <span
                  className={`inline-flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 transform rounded-full shadow-lg transition-all duration-300 ${
                    isAvailable
                      ? "translate-x-9 sm:translate-x-10 bg-white"
                      : "translate-x-1 bg-white/90"
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <Power
                      className={`h-4 w-4 transition-colors duration-300 ${
                        isAvailable ? "text-emerald-500" : "text-slate-400"
                      }`}
                    />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      <div
        className={`mt-3 overflow-hidden transition-all duration-300 ${
          showFeedback ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            isAvailable
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-slate-50 text-slate-600 border border-slate-200"
          }`}
        >
          {isAvailable ? (
            <Bell className="h-4 w-4 flex-shrink-0" />
          ) : (
            <BellOff className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="truncate">{feedbackMessage}</span>
        </div>
      </div>
    </div>
  );
}
