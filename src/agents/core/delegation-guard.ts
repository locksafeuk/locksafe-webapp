/**
 * Pure, deterministic guard against pathological agent delegation.
 *
 * Prevents the loops the agent system can otherwise create:
 *   - self-delegation (X → X)
 *   - reciprocal cycle (X → Y while Y → X is still open)  ← "circular delegation"
 *   - duplicate (an identical open task already delegated X → Y)
 *
 * Kept pure (counts are fetched by the caller) so it is trivially unit-testable.
 */

export interface DelegationGuardInput {
  fromAgentId: string;
  targetAgentId: string;
  /** Open tasks where the TARGET previously delegated to the SOURCE. */
  reciprocalOpenCount: number;
  /** Open tasks with the same title already delegated SOURCE → TARGET. */
  duplicateOpenCount: number;
}

export type DelegationBlockReason =
  | "self-delegation"
  | "circular-delegation"
  | "duplicate-delegation"
  | null;

export function delegationBlockReason(input: DelegationGuardInput): DelegationBlockReason {
  if (input.targetAgentId === input.fromAgentId) return "self-delegation";
  if (input.reciprocalOpenCount > 0) return "circular-delegation";
  if (input.duplicateOpenCount > 0) return "duplicate-delegation";
  return null;
}
