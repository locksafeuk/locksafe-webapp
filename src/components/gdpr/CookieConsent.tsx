"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Cookie, X, ChevronDown, ChevronUp, Shield, Settings, BarChart3 } from "lucide-react";

interface CookiePreferences {
  essential: boolean; // Always true
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

const COOKIE_CONSENT_KEY = "locksafe_cookie_consent";
const CONSENT_VERSION = "1.0"; // Increment when cookie policy changes significantly

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    functional: true,
    analytics: true,
    marketing: false,
  } as CookiePreferences);

  useEffect(() => {
    // Check if user has already consented
    const storedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);

    if (storedConsent) {
      try {
        const parsed = JSON.parse(storedConsent);
        // Check if consent is valid and not expired (1 year)
        const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
        if (parsed.timestamp && parsed.timestamp > oneYearAgo && parsed.version === CONSENT_VERSION) {
          setPreferences(parsed);
          applyPreferences(parsed);
          return; // Don't show banner
        }
      } catch (e) {
        // Invalid stored consent, show banner
      }
    }

    // Show banner after a short delay for better UX
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const applyPreferences = (prefs: CookiePreferences) => {
    // Apply analytics preferences
    if (prefs.analytics) {
      // Enable Google Analytics
      if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).gtag) {
        (window as unknown as Record<string, (...args: unknown[]) => void>).gtag("consent", "update", {
          analytics_storage: "granted",
        });
      }
    } else {
      // Disable Google Analytics
      if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).gtag) {
        (window as unknown as Record<string, (...args: unknown[]) => void>).gtag("consent", "update", {
          analytics_storage: "denied",
        });
      }
    }

    // Marketing preferences would be applied similarly
    if (prefs.marketing) {
      // Enable marketing tracking
    }
  };

  const savePreferences = (prefs: CookiePreferences) => {
    const toSave = {
      ...prefs,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(toSave));
    applyPreferences(prefs);
    setShowBanner(false);
  };

  const acceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
    };
    setPreferences(allAccepted);
    savePreferences(allAccepted);
  };

  const acceptEssentialOnly = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
    };
    setPreferences(essentialOnly);
    savePreferences(essentialOnly);
  };

  const saveCustomPreferences = () => {
    savePreferences(preferences);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Main Banner */}
        <div className="p-4 md:p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-12 h-12 bg-orange-100 rounded-xl items-center justify-center flex-shrink-0">
              <Cookie className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                We value your privacy
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                We use cookies to enhance your browsing experience, provide personalised content,
                and analyse our traffic. By clicking "Accept All", you consent to our use of cookies.
                You can customise your preferences or read our{" "}
                <Link href="/cookies" className="text-orange-600 hover:underline">
                  Cookie Policy
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-orange-600 hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>

              {/* Quick Action Buttons */}
              <div className="flex flex-wrap gap-3 mb-3">
                <Button
                  onClick={acceptAll}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6"
                >
                  Accept All
                </Button>
                <Button
                  onClick={acceptEssentialOnly}
                  variant="outline"
                  className="border-slate-300 text-slate-700"
                >
                  Essential Only
                </Button>
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Customise
                  {showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Detailed Preferences */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid gap-4">
                {/* Essential Cookies */}
                <div className="flex items-start justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-900">Essential Cookies</h4>
                      <p className="text-sm text-slate-600">
                        Required for the website to function. Cannot be disabled.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full font-medium">
                      Always Active
                    </span>
                  </div>
                </div>

                {/* Functional Cookies */}
                <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-start gap-3">
                    <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-900">Functional Cookies</h4>
                      <p className="text-sm text-slate-600">
                        Remember your preferences and settings for a better experience.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
                  </label>
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-900">Analytics Cookies</h4>
                      <p className="text-sm text-slate-600">
                        Help us understand how visitors interact with our website.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
                  </label>
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-start gap-3">
                    <Cookie className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-slate-900">Marketing Cookies</h4>
                      <p className="text-sm text-slate-600">
                        Used to deliver personalised advertisements. Currently not in use.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                      className="sr-only peer"
                      disabled
                    />
                    <div className="w-11 h-6 bg-slate-200 rounded-full cursor-not-allowed opacity-50 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
                  </label>
                </div>
              </div>

              {/* Save Custom Preferences */}
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={saveCustomPreferences}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  Save Preferences
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to get current cookie preferences
export function useCookiePreferences(): CookiePreferences | null {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch (e) {
        // Invalid
      }
    }
  }, []);

  return preferences;
}
