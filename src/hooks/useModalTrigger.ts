"use client";

import { useCallback } from "react";

interface UseModalTriggerOptions {
  visitorId: string;
  sessionId: string;
}

export function useModalTrigger(options: UseModalTriggerOptions) {
  const { visitorId, sessionId } = options;

  // Check if a specific modal can be shown
  // Increased default cooldown from 24 to 48 hours for better UX
  const canShowModal = useCallback(
    async (
      modalType: string,
      cooldownHours = 48,
      maxShows = 1
    ): Promise<boolean> => {
      if (!visitorId) return false;

      try {
        const res = await fetch(
          `/api/marketing/modals?visitorId=${visitorId}&modalType=${modalType}&cooldownHours=${cooldownHours}&maxShows=${maxShows}`
        );

        if (res.ok) {
          const data = await res.json();
          return data.canShow;
        }
      } catch (err) {
        console.error("Failed to check modal:", err);
      }

      return false;
    },
    [visitorId]
  );

  // Track modal shown
  const trackModalShown = useCallback(
    async (modalType: string, triggerId?: string) => {
      if (!visitorId || !sessionId) return;

      try {
        await fetch("/api/marketing/modals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId,
            sessionId,
            modalType,
            action: "shown",
            triggerId,
          }),
        });
      } catch (err) {
        console.error("Failed to track modal shown:", err);
      }
    },
    [visitorId, sessionId]
  );

  // Track modal dismissed
  const trackModalDismissed = useCallback(
    async (modalType: string, triggerId?: string) => {
      if (!visitorId || !sessionId) return;

      try {
        await fetch("/api/marketing/modals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId,
            sessionId,
            modalType,
            action: "dismissed",
            triggerId,
          }),
        });
      } catch (err) {
        console.error("Failed to track modal dismissed:", err);
      }
    },
    [visitorId, sessionId]
  );

  // Track modal converted
  const trackModalConverted = useCallback(
    async (
      modalType: string,
      data?: Record<string, unknown>,
      triggerId?: string
    ) => {
      if (!visitorId || !sessionId) return;

      try {
        await fetch("/api/marketing/modals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            visitorId,
            sessionId,
            modalType,
            action: "converted",
            data,
            triggerId,
          }),
        });
      } catch (err) {
        console.error("Failed to track modal converted:", err);
      }
    },
    [visitorId, sessionId]
  );

  // Save lead
  const saveLead = useCallback(
    async (data: {
      email: string;
      name?: string;
      phone?: string;
      source: string;
      segment?: string[];
    }) => {
      try {
        const res = await fetch("/api/marketing/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            sessionId,
          }),
        });

        if (res.ok) {
          return await res.json();
        }
        throw new Error("Failed to save lead");
      } catch (err) {
        console.error("Failed to save lead:", err);
        throw err;
      }
    },
    [sessionId]
  );

  return {
    canShowModal,
    trackModalShown,
    trackModalDismissed,
    trackModalConverted,
    saveLead,
  };
}
