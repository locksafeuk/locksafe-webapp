/**
 * Deterministic validator for `dispatch.auto`.
 *
 * Mirrors the gating proven in src/lib/intelligent-dispatch.ts (autoDispatch /
 * findBestLocksmiths) but as a pure, standalone function so it can be enforced
 * by the control plane and unit-tested in isolation. The cognition plane may
 * PROPOSE an auto-dispatch; this is the veto.
 *
 * An auto-dispatch is only valid when:
 *   - the job is still PENDING
 *   - there is a candidate, and they are verified + active + available
 *   - match score >= minScore (default 70)
 *   - rating >= 4.0
 *   - distance <= 5 miles
 *   - the locksmith has an assessment fee set
 */

import type { ValidationResult } from "../types";

export interface DispatchCandidateFacts {
  locksmithId: string;
  isVerified: boolean;
  isActive: boolean;
  isAvailable: boolean;
  distanceMiles: number;
  rating: number;
  matchScore: number;
  hasAssessmentFeeSet: boolean;
}

export interface DispatchAutoArgs {
  jobId: string;
  jobStatus: string;
  minScore?: number;
  /** Max distance for auto-dispatch (self-tunable; defaults to 5mi). */
  maxDistanceMiles?: number;
  candidate: DispatchCandidateFacts | null;
}

const MIN_RATING = 4.0;
const DEFAULT_MAX_DISTANCE_MILES = 5;
const DEFAULT_MIN_SCORE = 70;

export function validateDispatchAuto(args: DispatchAutoArgs): ValidationResult {
  if (args.jobStatus !== "PENDING") {
    return { ok: false, code: "job-not-pending", reason: `Job is not pending (status: ${args.jobStatus}).` };
  }

  const c = args.candidate;
  if (!c) {
    return { ok: false, code: "no-candidate", reason: "No suitable locksmith candidate provided." };
  }

  if (!c.isVerified || !c.isActive) {
    return { ok: false, code: "locksmith-not-eligible", reason: "Candidate is not verified/active." };
  }

  if (!c.isAvailable) {
    return { ok: false, code: "locksmith-unavailable", reason: "Candidate is not currently available." };
  }

  const minScore = typeof args.minScore === "number" ? args.minScore : DEFAULT_MIN_SCORE;
  if (c.matchScore < minScore) {
    return { ok: false, code: "below-min-score", reason: `Match score ${c.matchScore} below minimum ${minScore}.` };
  }

  if (c.rating < MIN_RATING) {
    return { ok: false, code: "below-min-rating", reason: `Rating ${c.rating} below minimum ${MIN_RATING}.` };
  }

  const maxDistance = typeof args.maxDistanceMiles === "number" ? args.maxDistanceMiles : DEFAULT_MAX_DISTANCE_MILES;
  if (c.distanceMiles > maxDistance) {
    return { ok: false, code: "too-far", reason: `Distance ${c.distanceMiles}mi exceeds ${maxDistance}mi for auto-dispatch.` };
  }

  if (!c.hasAssessmentFeeSet) {
    return { ok: false, code: "no-assessment-fee", reason: "Candidate has no assessment fee set." };
  }

  return { ok: true };
}
