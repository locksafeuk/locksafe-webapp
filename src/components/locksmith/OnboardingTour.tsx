"use client";

/**
 * Locksmith onboarding walkthrough (driver.js).
 *
 * Auto-starts on the dashboard for any locksmith who hasn't completed it
 * (Locksmith.tourCompletedAt == null), walks through what they control, then
 * continues on the Settings page. Skippable at any point — the SetupChecklist
 * keeps nudging until the two data-critical settings are genuinely set.
 *
 * Emphasis (per product decision): the CALL-OUT FEE and BASE LOCATION steps get
 * the highlighted "important" treatment — base location feeds job matching AND
 * local ads calibration, so it's the step we most need completed.
 *
 * Chapters: dashboard (welcome → availability → continue) → settings
 * (call-out fee ⭐ → schedule → base location ⭐ → done). Cross-page handoff via
 * sessionStorage. Replay anywhere via the "locksafe:replay-tour" window event.
 */

import { useEffect, useRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_STAGE_KEY = "locksafe_tour_stage"; // "settings" = continue chapter 2

const EMPHASIS_CSS = `
.locksafe-tour-popover { max-width: 340px; }
.locksafe-tour-popover .driver-popover-title { font-size: 16px; }
.locksafe-tour-emphasis {
  border: 2px solid #f97316;
  box-shadow: 0 10px 30px rgba(249,115,22,0.35) !important;
}
.locksafe-tour-emphasis .driver-popover-title { color: #ea580c; font-size: 17px; }
.locksafe-tour-emphasis .driver-popover-next-btn {
  background: #f97316 !important; color: #fff !important; border: none !important;
}
`;

interface OnboardingTourProps {
  page: "dashboard" | "settings";
  locksmithId: string;
}

export function OnboardingTour({ page, locksmithId }: OnboardingTourProps) {
  const driverRef = useRef<Driver | null>(null);
  const navigatingRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!locksmithId) return;

    const markComplete = () => {
      fetch("/api/locksmith/tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locksmithId }),
      }).catch(() => {});
    };

    const makeDriver = (steps: DriveStep[], onFinish: () => void) => {
      const d = driver({
        showProgress: true,
        allowClose: true,
        overlayOpacity: 0.6,
        popoverClass: "locksafe-tour-popover",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Got it!",
        steps,
        onDestroyed: () => {
          if (!navigatingRef.current) onFinish();
          navigatingRef.current = false;
        },
      });
      driverRef.current = d;
      d.drive();
    };

    const dashboardSteps: DriveStep[] = [
      {
        popover: {
          title: "👋 Welcome to LockSafe",
          description:
            "Quick 60-second tour — <b>you</b> control how you get work: your price, your hours, your area. Let's walk through it.",
        },
      },
      {
        element: "[data-tour='availability']",
        popover: {
          title: "Available / Unavailable",
          description:
            "Your master switch. <b>ON</b> — you receive job alerts near you. <b>OFF</b> — total silence, no calls, no jobs. Flip it any time.",
          side: "bottom",
        },
      },
      {
        popover: {
          title: "Your price & your area →",
          description:
            "The two most important settings live in <b>Settings</b>: your <b>call-out fee</b> and your <b>base location</b>. Let's set them now.",
          nextBtnText: "Take me there",
          onNextClick: () => {
            navigatingRef.current = true;
            sessionStorage.setItem(TOUR_STAGE_KEY, "settings");
            driverRef.current?.destroy();
            window.location.href = "/locksmith/settings";
          },
        },
      },
    ];

    const settingsSteps: DriveStep[] = [
      {
        element: "[data-tour='callout-fee']",
        popover: {
          title: "⭐ Your Call-Out Fee",
          description:
            "<b>You set your own price.</b> This is the assessment fee customers see and pay for a call-out — change it whenever you like. Set it now so customers know your rate.",
          side: "bottom",
          popoverClass: "locksafe-tour-popover locksafe-tour-emphasis",
        },
      },
      {
        element: "[data-tour='schedule']",
        popover: {
          title: "Your Schedule",
          description:
            "Set automatic working hours — including 24h and overnight cover. Your availability switches itself on/off to match, so you never get calls when you're off.",
          side: "top",
        },
      },
      {
        element: "[data-tour='base-location']",
        popover: {
          title: "⭐ Your Base Location — most important!",
          description:
            "<b>Set where you work from and how far you'll travel.</b> This is what matches you to <b>jobs near you</b> — and we run <b>local advertising for your area</b> based on it. No location = no jobs, no local ads.",
          side: "top",
          popoverClass: "locksafe-tour-popover locksafe-tour-emphasis",
        },
      },
      {
        popover: {
          title: "🎉 You're set",
          description:
            "That's it: availability, your fee, your schedule, your area. You can replay this tour any time from the setup card on your dashboard.",
        },
      },
    ];

    const startDashboardChapter = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      makeDriver(dashboardSteps, markComplete);
    };

    if (page === "dashboard") {
      // Auto-start only when the locksmith hasn't done the tour.
      fetch(`/api/locksmith/tour?locksmithId=${locksmithId}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (data?.success && data.tourCompletedAt == null) {
            setTimeout(startDashboardChapter, 900); // let the page render
          }
        })
        .catch(() => {});

      // Replay on demand from the SetupChecklist.
      const onReplay = () => {
        startedRef.current = false;
        startDashboardChapter();
      };
      window.addEventListener("locksafe:replay-tour", onReplay);
      return () => window.removeEventListener("locksafe:replay-tour", onReplay);
    }

    // Settings page: continue chapter 2 when handed off from the dashboard.
    if (page === "settings" && sessionStorage.getItem(TOUR_STAGE_KEY) === "settings") {
      sessionStorage.removeItem(TOUR_STAGE_KEY);
      setTimeout(() => makeDriver(settingsSteps, markComplete), 900);
    }

    return undefined;
  }, [page, locksmithId]);

  // eslint-disable-next-line react/no-danger
  return <style dangerouslySetInnerHTML={{ __html: EMPHASIS_CSS }} />;
}
