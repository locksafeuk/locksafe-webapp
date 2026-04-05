"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// OneSignal SDK types (simplified)
interface OneSignalUser {
  PushSubscription: {
    id: string | null;
    token: string | null;
    optedIn: boolean;
  };
}

interface OneSignalInstance {
  init: (options: any) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  User: OneSignalUser;
  Notifications: {
    permission: boolean;
    permissionNative: NotificationPermission;
    requestPermission: () => Promise<void>;
    addEventListener: (event: string, callback: (event: any) => void) => void;
    removeEventListener: (event: string, callback: (event: any) => void) => void;
  };
  Slidedown: {
    promptPush: (options?: { force?: boolean }) => Promise<void>;
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalInstance) => void>;
    OneSignal?: OneSignalInstance;
  }
}

export interface OneSignalState {
  isInitialized: boolean;
  isSubscribed: boolean;
  playerId: string | null;
  permission: NotificationPermission | "default";
  isLoading: boolean;
  error: string | null;
}

interface UseOneSignalOptions {
  userId?: string;
  userType?: "customer" | "locksmith";
  onSubscriptionChange?: (isSubscribed: boolean, playerId: string | null) => void;
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

/**
 * Hook for OneSignal push notification integration
 *
 * @example
 * ```tsx
 * const { subscribe, unsubscribe, isSubscribed, playerId } = useOneSignal({
 *   userId: user.id,
 *   userType: 'locksmith',
 *   onSubscriptionChange: (isSubscribed, playerId) => {
 *     // Save to database
 *   }
 * });
 * ```
 */
export function useOneSignal(options: UseOneSignalOptions = {}) {
  const { userId, userType, onSubscriptionChange } = options;

  const [state, setState] = useState<OneSignalState>({
    isInitialized: false,
    isSubscribed: false,
    playerId: null,
    permission: "default",
    isLoading: true,
    error: null,
  });

  const initializingRef = useRef(false);
  const onSubscriptionChangeRef = useRef(onSubscriptionChange);
  onSubscriptionChangeRef.current = onSubscriptionChange;

  // Initialize OneSignal
  useEffect(() => {
    if (typeof window === "undefined" || !ONESIGNAL_APP_ID) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: !ONESIGNAL_APP_ID ? "OneSignal App ID not configured" : null,
      }));
      return;
    }

    // Prevent double initialization
    if (initializingRef.current || window.OneSignal) {
      return;
    }
    initializingRef.current = true;

    const initOneSignal = async () => {
      try {
        // Load OneSignal SDK
        if (!document.querySelector('script[src*="onesignal"]')) {
          const script = document.createElement("script");
          script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
          script.defer = true;
          document.head.appendChild(script);

          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load OneSignal SDK"));
          });
        }

        // Initialize via deferred queue
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async (OneSignal) => {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID,
            notifyButton: {
              enable: false, // We use our own UI
            },
            allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
            serviceWorkerParam: { scope: "/" },
            serviceWorkerPath: "/OneSignalSDKWorker.js",
          });

          // Get initial state
          const subscription = OneSignal.User.PushSubscription;
          const permission = OneSignal.Notifications.permissionNative;

          setState({
            isInitialized: true,
            isSubscribed: subscription.optedIn || false,
            playerId: subscription.id,
            permission,
            isLoading: false,
            error: null,
          });

          // Set up event listeners
          OneSignal.Notifications.addEventListener("permissionChange", (granted: boolean) => {
            setState((prev) => ({
              ...prev,
              permission: granted ? "granted" : "denied",
            }));
          });

          // Login user if provided
          if (userId) {
            try {
              await OneSignal.login(userId);
            } catch (e) {
              console.warn("[OneSignal] Login failed:", e);
            }
          }

          // Store reference globally
          window.OneSignal = OneSignal;
        });
      } catch (error: any) {
        console.error("[OneSignal] Init error:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "Failed to initialize OneSignal",
        }));
      }
    };

    initOneSignal();
  }, [userId]);

  // Handle user login changes
  useEffect(() => {
    const OneSignal = window.OneSignal;
    if (!OneSignal || !state.isInitialized) return;

    if (userId) {
      OneSignal.login(userId).catch(console.warn);
    } else {
      OneSignal.logout().catch(console.warn);
    }
  }, [userId, state.isInitialized]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<string | null> => {
    const OneSignal = window.OneSignal;
    if (!OneSignal) {
      setState((prev) => ({ ...prev, error: "OneSignal not initialized" }));
      return null;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission
      await OneSignal.Notifications.requestPermission();

      // Wait a moment for subscription to update
      await new Promise((r) => setTimeout(r, 500));

      const subscription = OneSignal.User.PushSubscription;
      const isSubscribed = subscription.optedIn || false;
      const playerId = subscription.id;

      setState((prev) => ({
        ...prev,
        isSubscribed,
        playerId,
        permission: OneSignal.Notifications.permissionNative,
        isLoading: false,
      }));

      // Call callback
      onSubscriptionChangeRef.current?.(isSubscribed, playerId);

      // Save to server
      if (playerId && userId) {
        await saveSubscription(userId, userType || "customer", playerId);
      }

      return playerId;
    } catch (error: any) {
      console.error("[OneSignal] Subscribe error:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Failed to subscribe",
      }));
      return null;
    }
  }, [userId, userType]);

  // Show native prompt
  const showPrompt = useCallback(async () => {
    const OneSignal = window.OneSignal;
    if (!OneSignal) return;

    try {
      await OneSignal.Slidedown.promptPush({ force: true });
    } catch (error) {
      console.warn("[OneSignal] Prompt error:", error);
    }
  }, []);

  // Unsubscribe
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    const OneSignal = window.OneSignal;
    if (!OneSignal) return false;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // OneSignal v16 doesn't have direct unsubscribe
      // The user needs to clear browser permissions
      // We can log them out and remove from our database

      if (userId) {
        await removeSubscription(userId, userType || "customer");
      }

      await OneSignal.logout();

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        playerId: null,
        isLoading: false,
      }));

      onSubscriptionChangeRef.current?.(false, null);
      return true;
    } catch (error: any) {
      console.error("[OneSignal] Unsubscribe error:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Failed to unsubscribe",
      }));
      return false;
    }
  }, [userId, userType]);

  // Check if push is supported
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  return {
    ...state,
    isSupported,
    subscribe,
    unsubscribe,
    showPrompt,
  };
}

// Helper functions for API calls
async function saveSubscription(
  userId: string,
  userType: string,
  playerId: string
): Promise<boolean> {
  try {
    const response = await fetch("/api/onesignal/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, userType, playerId }),
    });
    return response.ok;
  } catch (error) {
    console.error("[OneSignal] Failed to save subscription:", error);
    return false;
  }
}

async function removeSubscription(
  userId: string,
  userType: string
): Promise<boolean> {
  try {
    const response = await fetch("/api/onesignal/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, userType }),
    });
    return response.ok;
  } catch (error) {
    console.error("[OneSignal] Failed to remove subscription:", error);
    return false;
  }
}

export default useOneSignal;
