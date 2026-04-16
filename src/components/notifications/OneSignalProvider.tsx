"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import Script from "next/script";

interface OneSignalContextType {
  isInitialized: boolean;
  isSubscribed: boolean;
  playerId: string | null;
  permission: NotificationPermission | "default";
}

const OneSignalContext = createContext<OneSignalContextType>({
  isInitialized: false,
  isSubscribed: false,
  playerId: null,
  permission: "default",
});

export const useOneSignalContext = () => useContext(OneSignalContext);

interface OneSignalProviderProps {
  children: ReactNode;
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

/**
 * OneSignal Provider Component
 *
 * Wraps your app to initialize OneSignal SDK.
 * Add to your root layout or ClientBody component.
 *
 * @example
 * ```tsx
 * // In ClientBody.tsx
 * <OneSignalProvider>
 *   {children}
 * </OneSignalProvider>
 * ```
 */
export function OneSignalProvider({ children }: OneSignalProviderProps) {
  const [state, setState] = useState<OneSignalContextType>({
    isInitialized: false,
    isSubscribed: false,
    playerId: null,
    permission: "default",
  });

  // Initialize OneSignal when script loads
  const handleScriptLoad = () => {
    if (!ONESIGNAL_APP_ID) {
      console.warn("[OneSignal] App ID not configured");
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID,
          notifyButton: {
            enable: false, // We use custom UI
          },
          allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
          serviceWorkerParam: { scope: "/" },
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          welcomeNotification: {
            disable: true, // We handle this ourselves
          },
        });

        // Get initial subscription state
        const subscription = OneSignal.User.PushSubscription;
        const permission = OneSignal.Notifications?.permissionNative || "default";

        setState({
          isInitialized: true,
          isSubscribed: subscription?.optedIn || false,
          playerId: subscription?.id || null,
          permission,
        });

        console.log("[OneSignal] Initialized successfully");

        // Listen for subscription changes
        OneSignal.User.PushSubscription?.addEventListener(
          "change",
          (event: any) => {
            setState((prev) => ({
              ...prev,
              isSubscribed: event.current?.optedIn || false,
              playerId: event.current?.id || null,
            }));
          }
        );
      } catch (error) {
        console.error("[OneSignal] Initialization failed:", error);
      }
    });
  };

  return (
    <OneSignalContext.Provider value={state}>
      {/* Load OneSignal SDK */}
      {ONESIGNAL_APP_ID && (
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          defer
          onLoad={handleScriptLoad}
          strategy="afterInteractive"
        />
      )}
      {children}
    </OneSignalContext.Provider>
  );
}

export default OneSignalProvider;
