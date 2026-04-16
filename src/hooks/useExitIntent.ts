"use client";

import { useEffect, useCallback, useRef, useState } from "react";

interface UseExitIntentOptions {
  threshold?: number; // Y position threshold (default: 50px from top)
  delayMs?: number; // Delay before detecting (default: 2000ms)
  triggerOnce?: boolean; // Only trigger once (default: true)
  disabled?: boolean; // Disable detection
  onExitIntent?: () => void; // Callback when exit intent detected
}

export function useExitIntent(options: UseExitIntentOptions = {}) {
  const {
    threshold = 50,
    delayMs = 2000,
    triggerOnce = true,
    disabled = false,
    onExitIntent,
  } = options;

  const [exitIntentDetected, setExitIntentDetected] = useState(false);
  const hasTriggeredRef = useRef(false);
  const delayPassedRef = useRef(false);

  const handleMouseLeave = useCallback(
    (e: MouseEvent) => {
      // Check if mouse left from top of viewport
      if (
        e.clientY <= threshold &&
        delayPassedRef.current &&
        !disabled &&
        (!triggerOnce || !hasTriggeredRef.current)
      ) {
        hasTriggeredRef.current = true;
        setExitIntentDetected(true);
        onExitIntent?.();
      }
    },
    [threshold, disabled, triggerOnce, onExitIntent]
  );

  const resetExitIntent = useCallback(() => {
    setExitIntentDetected(false);
    hasTriggeredRef.current = false;
  }, []);

  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    // Set delay
    const delayTimer = setTimeout(() => {
      delayPassedRef.current = true;
    }, delayMs);

    // Add event listener
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      clearTimeout(delayTimer);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [disabled, delayMs, handleMouseLeave]);

  // Mobile fallback: detect back button or rapid scroll up
  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    let lastScrollY = window.scrollY;
    let rapidScrollCount = 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDiff = lastScrollY - currentScrollY;

      // Rapid scroll up (more than 200px up in quick succession)
      if (scrollDiff > 200) {
        rapidScrollCount++;
        if (
          rapidScrollCount >= 3 &&
          delayPassedRef.current &&
          (!triggerOnce || !hasTriggeredRef.current)
        ) {
          hasTriggeredRef.current = true;
          setExitIntentDetected(true);
          onExitIntent?.();
        }
      } else {
        rapidScrollCount = 0;
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [disabled, triggerOnce, onExitIntent]);

  return {
    exitIntentDetected,
    resetExitIntent,
  };
}
