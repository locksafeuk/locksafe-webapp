"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, X, Check, AlertCircle } from "lucide-react";
import { useOneSignal } from "@/hooks/useOneSignal";

interface PushNotificationBannerProps {
  userId?: string;
  userType?: "customer" | "locksmith";
  className?: string;
  /** Delay in ms before showing the banner. Default: 10000 (10 seconds) */
  showDelay?: number;
  /** If true, show after user completes a key action (e.g., submits a request) */
  showAfterAction?: boolean;
}

export function PushNotificationBanner({
  userId,
  userType,
  className = "",
  showDelay = 10000,
  showAfterAction = false,
}: PushNotificationBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [canShow, setCanShow] = useState(false);

  const {
    isSupported,
    isInitialized,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
  } = useOneSignal({
    userId,
    userType,
    onSubscriptionChange: (subscribed, playerId) => {
      if (subscribed && playerId) {
        console.log("[Push] Subscribed with player ID:", playerId);
      }
    },
  });

  // Check if we should show the banner
  useEffect(() => {
    // Don't show if:
    // - Already dismissed this session
    // - Already subscribed
    // - Permission denied
    // - Not supported
    // - Not initialized
    if (typeof window === "undefined") return;

    const dismissed = sessionStorage.getItem("push-banner-dismissed");
    if (dismissed) return;

    if (!isSupported || !isInitialized || permission === "denied" || isSubscribed) {
      return;
    }

    // If showAfterAction is true, wait for that trigger
    if (showAfterAction) {
      // Check if action was completed
      const actionCompleted = sessionStorage.getItem("show-push-notification-prompt");
      if (!actionCompleted) return;
      // Clear the flag
      sessionStorage.removeItem("show-push-notification-prompt");
    }

    // Show banner after delay (much longer than before)
    const timer = setTimeout(() => {
      setCanShow(true);
      setIsDismissed(false);
    }, showDelay);

    return () => clearTimeout(timer);
  }, [isSupported, isInitialized, permission, isSubscribed, showDelay, showAfterAction]);

  const handleSubscribe = async () => {
    const playerId = await subscribe();
    if (playerId) {
      setShowSuccess(true);
      setTimeout(() => {
        setIsDismissed(true);
        sessionStorage.setItem("push-banner-dismissed", "true");
      }, 2000);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("push-banner-dismissed", "true");
  };

  if (isDismissed || !isSupported || !isInitialized || permission === "denied" || isSubscribed || !canShow) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] animate-in slide-in-from-top-2 fade-in duration-300 ${className}`}
    >
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:py-3">
          {showSuccess ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Notifications enabled!</span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Bell className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm font-medium truncate">
                  {userType === "locksmith"
                    ? "Get instant job alerts"
                    : "Get updates on your locksmith's arrival"}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {error && (
                  <span className="hidden sm:flex items-center gap-1 text-xs text-white/80">
                    <AlertCircle className="w-3 h-3" />
                    Error
                  </span>
                )}
                <button
                  onClick={handleSubscribe}
                  disabled={isLoading}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="hidden sm:inline">Enabling...</span>
                    </span>
                  ) : (
                    "Enable"
                  )}
                </button>
                <button
                  onClick={handleDismiss}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to trigger the notification prompt after a key action
 * Call this after user completes a request submission, for example
 */
export function triggerNotificationPrompt() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("show-push-notification-prompt", "true");
  }
}

export default PushNotificationBanner;
