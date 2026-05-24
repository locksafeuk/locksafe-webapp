/**
 * Intelligent Dispatch Algorithm for LockSafe UK
 *
 * Automatically matches the best locksmith to a job based on:
 * - Distance from job location
 * - Locksmith rating
 * - Availability status
 * - Current workload
 * - Response time history
 * - Specialty semantic match (nomic-embed-text via Ollama)
 *
 * Semantic matching: the job description is embedded once per dispatch call,
 * then compared against each locksmith's pre-embedded services profile via
 * cosine similarity. Results are cached in-memory with a 1-hour TTL so
 * repeated dispatches don't re-embed the same locksmith profiles.
 *
 * Fallback: if the embed model is unavailable (Ollama down or model not yet
 * pulled), specialty score defaults to 0.5 (neutral) and dispatch continues
 * normally — no crash, no degraded user experience.
 */

import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { callOllamaEmbed, cosineSimilarity } from "@/lib/llm-router";

// Configuration
const MAX_DISTANCE_MILES = 15; // Maximum distance to consider
const MIN_RATING = 3.5; // Minimum rating to consider
const WEIGHTS = {
  distance:     0.30, // 30% — proximity
  rating:       0.20, // 20% — rating
  availability: 0.15, // 15% — currently available
  responseTime: 0.15, // 15% — historical response speed
  workload:     0.10, // 10% — active job count
  specialty:    0.10, // 10% — semantic specialization match (embed)
};

// ─── Locksmith embed cache ────────────────────────────────────────────────────
// Module-level: persists across warm Next.js edge invocations.
// Key: locksmithId  Value: { vector, cachedAt }
const EMBED_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedEmbedding {
  vector: number[];
  cachedAt: number;
}
const locksmithEmbedCache = new Map<string, CachedEmbedding>();

/**
 * Convert a locksmith's services[] array into a descriptive text string
 * suitable for embedding. Handles both slug-style ("emergency_lockout") and
 * human-readable ("Emergency lockout") formats.
 */
function locksmithProfileText(services: string[], companyName: string | null): string {
  const readable = services
    .map((s) => s.replace(/_/g, " ").replace(/-/g, " "))
    .join(", ");
  const prefix = companyName ? `${companyName} — ` : "";
  return `${prefix}locksmith specialising in: ${readable || "general locksmith services"}`;
}

/**
 * Build a job query text for embedding.
 */
function jobQueryText(problemType: string, description: string | null): string {
  const base = problemType.replace(/_/g, " ").replace(/-/g, " ");
  return description ? `${base}: ${description}` : base;
}

/**
 * Get or compute the embedding for a locksmith. Cached 1 hour.
 * Returns null if embed model is unavailable.
 */
async function getLocksmithEmbedding(
  locksmithId: string,
  services: string[],
  companyName: string | null,
): Promise<number[] | null> {
  const cached = locksmithEmbedCache.get(locksmithId);
  if (cached && Date.now() - cached.cachedAt < EMBED_CACHE_TTL_MS) {
    return cached.vector;
  }

  try {
    const text = locksmithProfileText(services, companyName);
    const vector = await callOllamaEmbed(text);
    locksmithEmbedCache.set(locksmithId, { vector, cachedAt: Date.now() });
    return vector;
  } catch {
    return null; // embed model unavailable — caller falls back to neutral score
  }
}

export interface DispatchCandidate {
  locksmithId: string;
  locksmithName: string;
  companyName: string | null;
  phone: string;
  email: string;
  distanceMiles: number;
  rating: number;
  totalJobs: number;
  isAvailable: boolean;
  currentWorkload: number;
  avgResponseMinutes: number;
  matchScore: number;
  specialtyScore: number | null; // null = embed unavailable
  estimatedEtaMinutes: number;
  reasons: string[];
  defaultAssessmentFee: number | null;
  hasAssessmentFeeSet: boolean;
}

export interface DispatchResult {
  success: boolean;
  candidates: DispatchCandidate[];
  topCandidate: DispatchCandidate | null;
  autoDispatchRecommended: boolean;
  reason: string;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Estimate ETA based on distance
 * Assumes average speed of 25 mph in urban areas
 */
function estimateEta(distanceMiles: number): number {
  const avgSpeedMph = 25;
  const baseMinutes = (distanceMiles / avgSpeedMph) * 60;
  // Add 5-10 minutes for getting ready
  return Math.round(baseMinutes + 5 + Math.random() * 5);
}

/**
 * Calculate match score for a locksmith.
 * specialtySimilarity: cosine similarity 0–1 from embed model, or null if unavailable.
 * When null, specialty weight is redistributed to distance + rating.
 */
function calculateMatchScore(
  distanceMiles: number,
  rating: number,
  isAvailable: boolean,
  avgResponseMinutes: number,
  currentWorkload: number,
  specialtySimilarity: number | null,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // Distance score (closer = better, max 1.0)
  const distanceScore = Math.max(0, 1 - distanceMiles / MAX_DISTANCE_MILES);
  if (distanceMiles < 2) reasons.push("Very close proximity");
  else if (distanceMiles < 5) reasons.push("Close proximity");

  // Rating score (normalized to 0-1)
  const ratingScore = Math.max(0, (rating - MIN_RATING) / (5 - MIN_RATING));
  if (rating >= 4.5) reasons.push("Top-rated locksmith");
  else if (rating >= 4.0) reasons.push("Highly rated");

  // Availability score
  const availabilityScore = isAvailable ? 1 : 0.3;
  if (isAvailable) reasons.push("Currently available");

  // Response time score (faster = better, max 1.0)
  const responseScore =
    avgResponseMinutes > 0
      ? Math.max(0, 1 - avgResponseMinutes / 30)
      : 0.5;
  if (avgResponseMinutes > 0 && avgResponseMinutes < 5) reasons.push("Fast responder");

  // Workload score (fewer active jobs = better)
  const workloadScore = Math.max(0, 1 - currentWorkload / 5);
  if (currentWorkload === 0) reasons.push("No active jobs");

  // Specialty score — semantic similarity via embed model
  // If unavailable, fall back to 0.5 and redistribute that weight
  const embedAvailable = specialtySimilarity !== null;
  const specialtyScore = specialtySimilarity ?? 0.5;
  if (embedAvailable && specialtySimilarity! >= 0.75) reasons.push("Specialist match");
  else if (embedAvailable && specialtySimilarity! >= 0.55) reasons.push("Good speciality fit");

  // Weights — redistribute specialty weight if embed unavailable
  const weights = embedAvailable
    ? WEIGHTS
    : {
        ...WEIGHTS,
        distance:  WEIGHTS.distance  + WEIGHTS.specialty * 0.6,
        rating:    WEIGHTS.rating    + WEIGHTS.specialty * 0.4,
        specialty: 0,
      };

  const score =
    distanceScore   * weights.distance +
    ratingScore      * weights.rating +
    availabilityScore * weights.availability +
    responseScore    * weights.responseTime +
    workloadScore    * weights.workload +
    specialtyScore   * weights.specialty;

  return { score, reasons };
}

/**
 * Find the best locksmiths for a job
 */
export async function findBestLocksmiths(
  jobId: string,
  maxCandidates = 5,
  priorityDispatch = false,
): Promise<DispatchResult> {
  try {
    // Priority dispatch: widen search radius and candidate pool for Cover subscribers
    const effectiveMaxDistance = priorityDispatch ? 20 : MAX_DISTANCE_MILES;
    const effectiveMaxCandidates = priorityDispatch ? Math.max(maxCandidates, 15) : maxCandidates;
    // Get job details
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true },
    });

    if (!job) {
      return {
        success: false,
        candidates: [],
        topCandidate: null,
        autoDispatchRecommended: false,
        reason: "Job not found",
      };
    }

    if (!job.latitude || !job.longitude) {
      return {
        success: false,
        candidates: [],
        topCandidate: null,
        autoDispatchRecommended: false,
        reason: "Job location not set",
      };
    }

    // ── Embed the job query once (non-blocking, graceful fallback) ────────────
    let jobEmbedding: number[] | null = null;
    try {
      const queryText = jobQueryText(
        job.problemType,
        job.description ?? null,
      );
      jobEmbedding = await callOllamaEmbed(queryText);
    } catch {
      // Embed model unavailable — specialty scoring disabled for this dispatch
      console.warn("[Dispatch] Embed model unavailable — semantic matching disabled");
    }

    // Get all verified, active locksmiths with location
    const locksmiths = await prisma.locksmith.findMany({
      where: {
        isActive: true,
        isVerified: true,
        baseLat: { not: null },
        baseLng: { not: null },
      },
      include: {
        jobs: {
          where: {
            status: {
              in: [
                JobStatus.ACCEPTED,
                JobStatus.EN_ROUTE,
                JobStatus.ARRIVED,
                JobStatus.DIAGNOSING,
                JobStatus.QUOTED,
                JobStatus.QUOTE_ACCEPTED,
                JobStatus.IN_PROGRESS,
              ],
            },
          },
        },
        applications: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    const candidates: DispatchCandidate[] = [];

    for (const locksmith of locksmiths) {
      // Skip if no coordinates (shouldn't happen due to query filter, but TypeScript needs this)
      if (locksmith.baseLat === null || locksmith.baseLng === null) continue;

      // Calculate distance
      const distance = calculateDistance(
        job.latitude,
        job.longitude,
        locksmith.baseLat,
        locksmith.baseLng,
      );

      // Skip if outside coverage radius or max distance
      const effectiveRadius = Math.min(
        locksmith.coverageRadius ?? effectiveMaxDistance,
        effectiveMaxDistance,
      );
      if (distance > effectiveRadius) continue;

      // Skip if below minimum rating
      if (locksmith.rating < MIN_RATING) continue;

      // Calculate average response time from recent applications
      let avgResponseMinutes = 0;
      if (locksmith.applications.length > 0) {
        // Use the average ETA from recent applications as a proxy for response time
        const totalEta = locksmith.applications.reduce(
          (sum, app) => sum + app.eta,
          0,
        );
        avgResponseMinutes = totalEta / locksmith.applications.length;
      }

      // Current workload = number of active jobs
      const currentWorkload = locksmith.jobs.length;

      // ── Semantic specialty score ─────────────────────────────────────────
      let specialtySimilarity: number | null = null;
      if (jobEmbedding && locksmith.services && locksmith.services.length > 0) {
        const lsEmbedding = await getLocksmithEmbedding(
          locksmith.id,
          locksmith.services,
          locksmith.companyName,
        );
        if (lsEmbedding) {
          specialtySimilarity = cosineSimilarity(jobEmbedding, lsEmbedding);
        }
      }

      // Calculate match score
      const { score, reasons } = calculateMatchScore(
        distance,
        locksmith.rating,
        locksmith.isAvailable,
        avgResponseMinutes,
        currentWorkload,
        specialtySimilarity,
      );

      candidates.push({
        locksmithId: locksmith.id,
        locksmithName: locksmith.name,
        companyName: locksmith.companyName,
        phone: locksmith.phone,
        email: locksmith.email,
        distanceMiles: Math.round(distance * 10) / 10,
        rating: locksmith.rating,
        totalJobs: locksmith.totalJobs,
        isAvailable: locksmith.isAvailable,
        currentWorkload,
        avgResponseMinutes: Math.round(avgResponseMinutes),
        matchScore: Math.round(score * 100),
        specialtyScore: specialtySimilarity !== null ? Math.round(specialtySimilarity * 100) : null,
        estimatedEtaMinutes: estimateEta(distance),
        reasons,
        defaultAssessmentFee: locksmith.defaultAssessmentFee,
        hasAssessmentFeeSet: locksmith.defaultAssessmentFee !== null && locksmith.defaultAssessmentFee > 0,
      });
    }

    // Sort by match score
    candidates.sort((a, b) => b.matchScore - a.matchScore);

    // Take top N candidates
    const topCandidates = candidates.slice(0, effectiveMaxCandidates);

    // Determine if auto-dispatch is recommended
    const topCandidate = topCandidates[0] || null;
    const autoDispatchRecommended =
      topCandidate !== null &&
      topCandidate.matchScore >= 70 && // High confidence match
      topCandidate.isAvailable && // Must be available
      topCandidate.distanceMiles <= 5 && // Within 5 miles
      topCandidate.rating >= 4.0 && // Good rating
      topCandidate.hasAssessmentFeeSet; // Must have assessment fee set

    let reason = "";
    if (topCandidates.length === 0) {
      reason = "No locksmiths available in the area";
    } else if (autoDispatchRecommended) {
      reason = `Strong match: ${topCandidate?.locksmithName} (${topCandidate?.matchScore}% match, ${topCandidate?.distanceMiles}mi away)`;
    } else if (topCandidate) {
      const issues: string[] = [];
      if (!topCandidate.isAvailable) issues.push("not currently available");
      if (topCandidate.matchScore < 70) issues.push("moderate match score");
      if (topCandidate.distanceMiles > 5) issues.push("relatively far");
      reason = `Best match: ${topCandidate.locksmithName}, but ${issues.join(", ")}`;
    }

    return {
      success: true,
      candidates: topCandidates,
      topCandidate,
      autoDispatchRecommended,
      reason,
    };
  } catch (error) {
    console.error("[Dispatch] Error finding locksmiths:", error);
    return {
      success: false,
      candidates: [],
      topCandidate: null,
      autoDispatchRecommended: false,
      reason: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Auto-dispatch a job to the best locksmith
 * Creates an application on behalf of the locksmith
 * Sends SMS and bot notifications
 */
export async function autoDispatchJob(
  jobId: string,
  locksmithId: string,
  assessmentFee: number,
  etaMinutes: number,
  options?: { sendNotifications?: boolean },
): Promise<{ success: boolean; message: string; applicationId?: string }> {
  try {
    // Verify job exists and is pending
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true },
    });

    if (!job) {
      return { success: false, message: "Job not found" };
    }

    if (job.status !== JobStatus.PENDING) {
      return {
        success: false,
        message: `Job is not pending (status: ${job.status})`,
      };
    }

    // Verify locksmith exists
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
    });

    if (!locksmith) {
      return { success: false, message: "Locksmith not found" };
    }

    if (!locksmith.isVerified || !locksmith.isActive) {
      return { success: false, message: "Locksmith is not verified/active" };
    }

    // Check if application already exists
    const existingApp = await prisma.locksmithApplication.findUnique({
      where: {
        jobId_locksmithId: { jobId, locksmithId },
      },
    });

    if (existingApp) {
      return {
        success: false,
        message: "Locksmith has already applied to this job",
      };
    }

    // Create application
    const application = await prisma.locksmithApplication.create({
      data: {
        jobId,
        locksmithId,
        assessmentFee,
        eta: etaMinutes,
        message: "Auto-dispatched by intelligent matching system",
        status: "pending",
      },
    });

    // Send notifications if enabled (default: true)
    if (options?.sendNotifications !== false) {
      try {
        const { sendAutoDispatchNotification } = await import("@/lib/sms");

        await sendAutoDispatchNotification({
          jobId: job.id,
          jobNumber: job.jobNumber,
          customerName: job.customer?.name || "Customer",
          customerPhone: job.customer?.phone || "",
          locksmithName: locksmith.name,
          locksmithPhone: locksmith.phone,
          postcode: job.postcode,
          address: job.address,
          problemType: job.problemType,
          assessmentFee,
        });

        console.log(`[Dispatch] SMS notification sent to ${locksmith.name}`);
      } catch (notifyError) {
        console.error("[Dispatch] Notification error:", notifyError);
        // Don't fail the dispatch if notification fails
      }
    }

    return {
      success: true,
      message: `Auto-dispatched to ${locksmith.name}`,
      applicationId: application.id,
    };
  } catch (error) {
    console.error("[Dispatch] Error auto-dispatching:", error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get nearby available locksmiths for a postcode
 */
export async function findNearbyLocksmiths(
  lat: number,
  lng: number,
  radiusMiles = 10,
): Promise<
  {
    locksmithId: string;
    name: string;
    companyName: string | null;
    distanceMiles: number;
    rating: number;
    isAvailable: boolean;
    phone: string;
  }[]
> {
  const locksmiths = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      isVerified: true,
      baseLat: { not: null },
      baseLng: { not: null },
    },
  });

  const nearby = locksmiths
    .filter((ls) => ls.baseLat !== null && ls.baseLng !== null)
    .map((ls) => ({
      locksmithId: ls.id,
      name: ls.name,
      companyName: ls.companyName,
      distanceMiles: calculateDistance(
        lat,
        lng,
        ls.baseLat as number,
        ls.baseLng as number,
      ),
      rating: ls.rating,
      isAvailable: ls.isAvailable,
      phone: ls.phone,
    }))
    .filter((ls) => ls.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  return nearby;
}

/**
 * Check coverage for a location
 */
export async function checkCoverage(
  lat: number,
  lng: number,
): Promise<{
  covered: boolean;
  locksmithCount: number;
  nearestMiles: number | null;
}> {
  const nearby = await findNearbyLocksmiths(lat, lng, MAX_DISTANCE_MILES);

  return {
    covered: nearby.length > 0,
    locksmithCount: nearby.length,
    nearestMiles: nearby.length > 0 ? nearby[0].distanceMiles : null,
  };
}
