"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download, Share, MoreVertical, PlusSquare, Check, Smartphone, Zap, Bell, Shield } from "lucide-react";
import { recordPWAPromptShown } from "@/lib/cookies";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "pwa-install-prompt-dismissed";
const SHOW_AGAIN_AFTER_DAYS = 7;

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [installing, setInstalling] = useState(false);

  // Detect platform and PWA state
  useEffect(() => {
    // Check if already installed as PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (userAgent.includes("mac") && "ontouchend" in document);
    const isAndroidDevice = /android/.test(userAgent);

    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Check if mobile device
    const isMobile = isIOSDevice || isAndroidDevice || window.innerWidth < 768;

    if (!isMobile) return;

    // Check if dismissed recently
    const dismissedData = localStorage.getItem(STORAGE_KEY);
    if (dismissedData) {
      const { timestamp } = JSON.parse(dismissedData);
      const daysSinceDismissed = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < SHOW_AGAIN_AFTER_DAYS) {
        return;
      }
    }

    // Listen for beforeinstallprompt (Android Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => {
        setShowPrompt(true);
        recordPWAPromptShown();
      }, 2500);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // For iOS, show prompt after delay
    if (isIOSDevice) {
      setTimeout(() => {
        setShowPrompt(true);
        recordPWAPromptShown();
      }, 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      setInstalling(true);
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
      setInstalling(false);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));
    setShowPrompt(false);
  }, []);

  const handleRemindLater = useCallback(() => {
    setShowPrompt(false);
  }, []);

  if (isStandalone || !showPrompt) return null;

  const benefits = [
    { icon: Zap, text: "Instant access from home screen" },
    { icon: Bell, text: "Real-time job notifications" },
    { icon: Shield, text: "Works offline" },
  ];

  const iOSSteps = [
    { icon: Share, title: "Tap Share", desc: "Bottom of Safari" },
    { icon: PlusSquare, title: "Add to Home Screen", desc: "Scroll & tap" },
    { icon: Check, title: "Tap Add", desc: "Top right corner" },
  ];

  const androidSteps = [
    { icon: MoreVertical, title: "Tap Menu", desc: "3 dots top right" },
    { icon: Download, title: "Install App", desc: "Or Add to Home" },
    { icon: Check, title: "Confirm", desc: "Tap Install" },
  ];

  const steps = isIOS ? iOSSteps : androidSteps;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleRemindLater}
      />

      {/* Modal - slides up from bottom on mobile */}
      <div className="relative w-full max-w-md mx-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 max-h-[90vh] overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Header - Compact gradient */}
        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 px-6 pt-8 pb-6 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/10 rounded-full" />

          {/* App icon */}
          <div className="relative mx-auto w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">LS</span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            Install LockSafe App
          </h2>
          <p className="text-sm text-white/80">
            Quick access anytime, even offline
          </p>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-5 overflow-y-auto max-h-[50vh]">
          {/* Benefits - horizontal on mobile for compactness */}
          <div className="flex gap-3 justify-center">
            {benefits.map((benefit, i) => (
              <div key={i} className="flex flex-col items-center text-center flex-1">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                  <benefit.icon className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-xs text-zinc-600 leading-tight">{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* Native install button for Android */}
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {installing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Install Now - Free
                </>
              )}
            </button>
          )}

          {/* Manual steps for iOS or fallback */}
          {(isIOS || (!deferredPrompt && isAndroid)) && (
            <div>
              <p className="text-sm font-medium text-zinc-700 mb-3 text-center">
                Follow these steps:
              </p>
              <div className="flex justify-between gap-2">
                {steps.map((step, index) => {
                  const isActive = currentStep === index;
                  const StepIcon = step.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => setCurrentStep(index)}
                      className={`flex-1 p-3 rounded-xl border-2 transition-all text-center ${
                        isActive
                          ? "border-orange-400 bg-orange-50"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                        isActive ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-500"
                      }`}>
                        <StepIcon className="w-5 h-5" />
                      </div>
                      <div className={`text-xs font-medium ${isActive ? "text-orange-700" : "text-zinc-700"}`}>
                        {step.title}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {step.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Step indicator */}
              <div className="flex justify-center gap-1.5 mt-4">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentStep ? "w-6 bg-orange-500" : "w-1.5 bg-zinc-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 pb-5 pt-2 border-t border-zinc-100">
          <div className="flex gap-3">
            <button
              onClick={handleRemindLater}
              className="flex-1 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-xl transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-xl transition-colors"
            >
              Don't Show Again
            </button>
          </div>
        </div>

        {/* Safe area padding for iOS devices */}
        <div className="h-safe-area-inset-bottom bg-white" />
      </div>
    </div>
  );
}
