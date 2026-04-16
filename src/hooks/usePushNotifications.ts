"use client";

import { useState, useEffect, useCallback } from "react";

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | "default";
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications(userId?: string) {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: "default",
    isLoading: true,
    error: null,
  });

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      const isSupported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!isSupported) {
        setState((prev) => ({
          ...prev,
          isSupported: false,
          isLoading: false,
        }));
        return;
      }

      // Check current permission
      const permission = Notification.permission;

      // Check if already subscribed
      let isSubscribed = false;
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        isSubscribed = !!subscription;
      } catch (e) {
        console.error("[Push] Error checking subscription:", e);
      }

      setState({
        isSupported: true,
        isSubscribed,
        permission,
        isLoading: false,
        error: null,
      });
    };

    checkSupport();
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers not supported");
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      console.log("[Push] Service worker registered:", registration.scope);
      return registration;
    } catch (error) {
      console.error("[Push] Service worker registration failed:", error);
      throw error;
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      setState((prev) => ({ ...prev, error: "Push notifications not supported" }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission, isLoading: false }));
      return permission === "granted";
    } catch (error) {
      console.error("[Push] Permission request failed:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to request permission",
        isLoading: false,
      }));
      return false;
    }
  }, [state.isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!state.isSupported || state.permission !== "granted") {
      const granted = await requestPermission();
      if (!granted) return null;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Register service worker if not already registered
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await registerServiceWorker();
      }

      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;

      // Get the push subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Create new subscription
        // Note: You would need a VAPID public key from your server
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!vapidPublicKey) {
          console.warn("[Push] VAPID public key not configured, using demo mode");
          // For demo, we'll just mark as subscribed without actual push
          setState((prev) => ({
            ...prev,
            isSubscribed: true,
            isLoading: false,
          }));
          return { demo: true };
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      // Send subscription to server
      if (userId) {
        await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            subscription: subscription.toJSON(),
          }),
        });
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      return subscription;
    } catch (error: any) {
      console.error("[Push] Subscription failed:", error);
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to subscribe",
        isLoading: false,
      }));
      return null;
    }
  }, [state.isSupported, state.permission, userId, requestPermission, registerServiceWorker]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notify server
        if (userId) {
          await fetch("/api/notifications/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
        }
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return true;
    } catch (error: any) {
      console.error("[Push] Unsubscribe failed:", error);
      setState((prev) => ({
        ...prev,
        error: error.message || "Failed to unsubscribe",
        isLoading: false,
      }));
      return false;
    }
  }, [userId]);

  // Show a local notification (for testing)
  const showLocalNotification = useCallback(
    async (title: string, options?: NotificationOptions) => {
      if (state.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) return;
      }

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        ...options,
      } as NotificationOptions);
    },
    [state.permission, requestPermission]
  );

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    showLocalNotification,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
