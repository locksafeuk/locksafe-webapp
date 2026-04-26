"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { AuthProvider, useAuth } from "@/components/auth/AuthContext";
import { OneSignalProvider } from "@/components/notifications/OneSignalProvider";
import { UserTracker } from "@/components/marketing";

// Defer non-critical overlays so they don't block LCP / hydration on
// marketing pages. They render only after the page is interactive.
const ModalSystem = dynamic(
  () => import("@/components/marketing").then((m) => ({ default: m.ModalSystem })),
  { ssr: false, loading: () => null },
);
const PWAInstallPrompt = dynamic(
  () => import("@/components/pwa/PWAInstallPrompt"),
  { ssr: false, loading: () => null },
);
const CookieConsent = dynamic(
  () => import("@/components/gdpr/CookieConsent").then((m) => ({ default: m.CookieConsent })),
  { ssr: false, loading: () => null },
);
const PushNotificationBanner = dynamic(
  () => import("@/components/notifications/PushNotificationBanner"),
  { ssr: false, loading: () => null },
);

// Component that uses auth context to show push notification banner
function PushNotificationWrapper() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return null;

  return (
    <PushNotificationBanner
      userId={user.id}
      userType={user.type as "customer" | "locksmith"}
    />
  );
}

export default function ClientBody({
  children,
}: {
  children: React.ReactNode;
}) {
  // Register service worker and remove any extension-added classes during hydration
  useEffect(() => {
    // This runs only on the client after hydration
    document.body.className = "antialiased";

    // Note: OneSignal handles its own service worker registration
    // We check if there's already a service worker controlling the page
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        console.log("[PWA] Service Worker ready:", registration.scope);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New version available
                console.log("[PWA] New version available!");
              }
            });
          }
        });
      });
    }
    // Stripe test-mode badge is hidden via a global CSS rule in globals.css
    // (see `[data-stripe-test-mode]`/iframe selectors). We avoid a global
    // MutationObserver here because it caused long main-thread tasks on every
    // DOM mutation across the whole app.
  }, []);

  return (
    <AuthProvider>
      <OneSignalProvider>
        <UserTracker>
          <div className="antialiased">{children}</div>
          <ModalSystem />
        </UserTracker>
        <PushNotificationWrapper />
        <PWAInstallPrompt />
        <CookieConsent />
      </OneSignalProvider>
    </AuthProvider>
  );
}
