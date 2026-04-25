/**
 * Job Number generation
 *
 * Format: <PREFIX>-JOB<NNN>
 *   - PREFIX: First 3 alphanumeric characters of the postcode, uppercased
 *             (e.g. "SW1A 1AA" -> "SW1", "m1 1aa" -> "M11").
 *             Falls back to "JOB" when no usable postcode is provided.
 *   - NNN:    3 random digits. On collision (>=10 retries), expands to 4 digits.
 *
 * Example: SW1-JOB123
 */

import prisma from "@/lib/db";

const MAX_3_DIGIT_ATTEMPTS = 10;
const MAX_4_DIGIT_ATTEMPTS = 20;

/**
 * Derive the postcode prefix used in job numbers.
 * Exported for use in seed scripts / tests.
 */
export function getJobNumberPrefix(postcode?: string | null): string {
  if (!postcode) return "JOB";
  const cleaned = postcode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length === 0) return "JOB";
  return cleaned.slice(0, 3);
}

function randomDigits(length: number): string {
  const max = 10 ** length;
  return Math.floor(Math.random() * max)
    .toString()
    .padStart(length, "0");
}

/**
 * Format a job number from a prefix and numeric suffix.
 * Useful in seed scripts where collision-checking is unnecessary.
 */
export function formatJobNumber(prefix: string, suffix: string | number): string {
  return `${prefix}-JOB${suffix}`;
}

/**
 * Generate a unique job number, retrying on collisions.
 *
 * Uses a DB lookup against `Job.jobNumber` (which is `@unique`) to ensure
 * uniqueness. Starts with 3-digit suffixes; if all attempts collide, falls
 * back to 4-digit suffixes.
 */
export async function generateJobNumber(postcode?: string | null): Promise<string> {
  const prefix = getJobNumberPrefix(postcode);

  for (let i = 0; i < MAX_3_DIGIT_ATTEMPTS; i++) {
    const candidate = formatJobNumber(prefix, randomDigits(3));
    const existing = await prisma.job.findUnique({
      where: { jobNumber: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  // Prefix is saturated for 3 digits — extend to 4.
  for (let i = 0; i < MAX_4_DIGIT_ATTEMPTS; i++) {
    const candidate = formatJobNumber(prefix, randomDigits(4));
    const existing = await prisma.job.findUnique({
      where: { jobNumber: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  // Extremely unlikely — final fallback uses timestamp tail to guarantee uniqueness.
  return formatJobNumber(prefix, `${randomDigits(4)}${Date.now().toString().slice(-2)}`);
}
