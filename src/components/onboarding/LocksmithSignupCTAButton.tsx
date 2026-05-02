"use client";

import { useAuth } from "@/components/auth/AuthContext";
import { Button, type ButtonProps } from "@/components/ui/button";
import { hasSeenLocksmithWalkthrough } from "@/lib/cookies";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";
import { LocksmithWalkthrough } from "./LocksmithWalkthrough";

interface LocksmithSignupCTAButtonProps extends Omit<ButtonProps, "onClick"> {
  children: ReactNode;
  href?: string;
}

/**
 * Primary "become a locksmith" CTA wrapper.
 *
 * - Authenticated users / repeat visitors → navigate straight to the signup form.
 * - First-time anonymous visitors → open the locksmith-prospect walkthrough first.
 */
export function LocksmithSignupCTAButton({
  children,
  href = "/locksmith-signup",
  className,
  ...buttonProps
}: LocksmithSignupCTAButtonProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      if (isLoading) return;
      if (isAuthenticated) return;
      if (typeof window !== "undefined" && hasSeenLocksmithWalkthrough())
        return;

      e.preventDefault();
      setOpen(true);
    },
    [isAuthenticated, isLoading],
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
      <LocksmithWalkthrough
        open={open}
        onClose={() => setOpen(false)}
        onContinue={handleContinue}
      />
    </>
  );
}
