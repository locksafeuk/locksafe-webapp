/**
 * Test: staged auction wave scheme (40 -> 30 -> 25)
 *
 * Verifies non-overlapping cohorts and wave-gating math:
 * - Wave 1 includes 1-2 locksmiths
 * - Wave 2 includes 1-2 different locksmiths
 * - Wave 3 includes all remaining locksmiths
 */

import { buildAuctionCohorts, getWaveRecipients } from "@/lib/job-auction";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasOverlap(a: string[], b: string[]) {
  const setB = new Set(b);
  return a.some((id) => setB.has(id));
}

function runCase(ids: string[]) {
  const [wave1, wave2, wave3] = buildAuctionCohorts(ids);

  assert(wave1.length >= 1 && wave1.length <= 2, "wave1 should have 1-2 locksmiths");
  assert(wave2.length >= 1 && wave2.length <= 2, "wave2 should have 1-2 locksmiths");
  assert(wave3.length >= 1, "wave3 should have at least 1 locksmith");

  assert(!hasOverlap(wave1, wave2), "wave1 and wave2 must not overlap");
  assert(!hasOverlap(wave1, wave3), "wave1 and wave3 must not overlap");
  assert(!hasOverlap(wave2, wave3), "wave2 and wave3 must not overlap");

  const union = [...wave1, ...wave2, ...wave3];
  assert(union.length === new Set(union).size, "all waves combined should have unique IDs");
  assert(union.length === new Set(ids).size, "all invited IDs should be covered by waves");

  assert(
    JSON.stringify(getWaveRecipients(0, ids)) === JSON.stringify(wave1),
    "step 0 recipients should match wave1"
  );
  assert(
    JSON.stringify(getWaveRecipients(1, ids)) === JSON.stringify(wave2),
    "step 1 recipients should match wave2"
  );
  assert(
    JSON.stringify(getWaveRecipients(2, ids)) === JSON.stringify(wave3),
    "step 2 recipients should match wave3"
  );
}

function main() {
  const sampleA = ["a", "b", "c"]; // minimal auction case
  const sampleB = ["a", "b", "c", "d", "e", "f"]; // larger pool

  runCase(sampleA);
  runCase(sampleB);

  console.log("AUCTION_WAVE_SCHEME_TEST PASSED");
}

main();
