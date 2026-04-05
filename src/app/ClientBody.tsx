"use client";

import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/components/auth/AuthContext";
import PushNotificationBanner from "@/components/notifications/PushNotificationBanner";
import { OneSignalProvider } from "@/components/notifications/OneSignalProvider";
import { UserTracker, ModalSystem } from "@/components/marketing";
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt";
import { CookieConsent } from "@/components/gdpr/CookieConsent";

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

    // Hide Stripe test mode badge - internal only knowledge
    const hideStripeBadge = () => {
      // Target the Stripe badge iframe that floats on screen
      const stripeBadges = document.querySelectorAll(
        'iframe[name*="stripe"], iframe[name*="Stripe"], body > div[style*="position: fixed"][style*="z-index"]'
      );
      stripeBadges.forEach((el) => {
        const element = el as HTMLElement;
        if (element.style.position === 'fixed' || element.getAttribute('name')?.includes('stripe')) {
          element.style.display = 'none';
          element.style.visibility = 'hidden';
        }
      });
    };

    // Run immediately and observe for changes
    hideStripeBadge();
    const observer = new MutationObserver(hideStripeBadge);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
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
