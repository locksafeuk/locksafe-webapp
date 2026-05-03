"use client";

import { useAuth } from "@/components/auth/AuthContext";
import { Button, type ButtonProps } from "@/components/ui/button";
import { hasSeenWalkthrough } from "@/lib/cookies";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";
import { FirstVisitWalkthrough } from "./FirstVisitWalkthrough";

interface RequestCTAButtonProps extends Omit<ButtonProps, "onClick"> {
  children: ReactNode;
  href?: string;
  /**
   * Fired when the CTA is activated (either to open the walkthrough or to
   * navigate). Useful for closing parent UI like a mobile menu sheet.
   */
  onNavigate?: () => void;
}

/**
 * Primary "request a locksmith" CTA wrapper.
 *
 * - Authenticated users / repeat visitors → navigate straight to the request page.
 * - First-time anonymous visitors → open the educational walkthrough first.
 * - Renders inside a <Link> so Next.js can prefetch and right-click / cmd-click
 *   keep working naturally.
 */
export function RequestCTAButton({
  children,
  href = "/request",
  className,
  onNavigate,
  ...buttonProps
}: RequestCTAButtonProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // Allow modifier-clicks (open in new tab/window) to behave normally
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      // Auth still resolving — let the Link navigate; cookie check handles repeat
      // visitors so this is a safe fallback.
      if (isLoading) {
        onNavigate?.();
        return;
      }

      if (isAuthenticated) {
        onNavigate?.();
        return;
      }

      if (typeof window !== "undefined" && hasSeenWalkthrough()) {
        onNavigate?.();
        return;
      }

      e.preventDefault();
      onNavigate?.();
      setOpen(true);
    },
    [isAuthenticated, isLoading, onNavigate],
  );

  const handleContinue = useCallback(() => {
    setOpen(false);
    router.push(href);
  }, [router, href]);

  return (
    <>
      <Link href={href} prefetch={false} className="inline-flex">
        <Button {...buttonProps} className={className} onClick={handleClick}>
          {children}
        </Button>
      </Link>
      <FirstVisitWalkthrough
        open={open}
        onClose={() => setOpen(false)}
        onContinue={handleContinue}
      />
    </>
  );
}
