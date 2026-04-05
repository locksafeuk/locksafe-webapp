"use client";

/**
 * Marketing Modal System - TEMPORARILY DISABLED
 *
 * Pop-ups were appearing too quickly and interrupting users.
 * This component is disabled until we implement better timing/triggering.
 *
 * TODO: Re-enable with improved UX:
 * - Much longer delays before showing any modal
 * - Only show after user has engaged significantly
 * - Never interrupt during critical flows (request, checkout)
 *
 * The original implementation has been commented out to prevent React hooks errors.
 * When re-enabling, move hooks before any conditional returns.
 */

interface ModalSystemProps {
  disabled?: boolean;
}

export function ModalSystem({ disabled = false }: ModalSystemProps) {
  // TEMPORARILY DISABLED - Pop-ups interrupt user flow too quickly
  // The full implementation has been disabled to avoid React hooks errors
  // To re-enable, uncomment the implementation and ensure hooks are called first
  return null;
}
