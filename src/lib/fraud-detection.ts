/**
 * LockSafe Fraud Detection System
 * Analyzes GPS patterns and job data to detect potential fraud
 */

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: Date;
  eventType: "arrival" | "departure" | "tracking" | "completion";
}

export interface JobData {
  jobId: string;
  locksmithId: string;
  customerId: string;
  customerLocation: { lat: number; lng: number };
  acceptedAt: Date;
  arrivedAt?: Date;
  completedAt?: Date;
  gpsLog: GpsPoint[];
  quoteAmount?: number;
  assessmentFee: number;
}

export interface FraudCheckResult {
  riskScore: number; // 0-100, higher = more suspicious
  riskLevel: "low" | "medium" | "high" | "critical";
  flags: FraudFlag[];
  recommendation: "approve" | "review" | "hold" | "block";
  details: string;
}

export interface FraudFlag {
  type: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  data?: Record<string, unknown>;
}

// Earth radius in km
const EARTH_RADIUS_KM = 6371;

/**
 * Calculate distance between two GPS points using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Check if locksmith actually arrived at customer location
 */
export function checkArrivalVerification(job: JobData): FraudFlag[] {
  const flags: FraudFlag[] = [];

  if (!job.arrivedAt || job.gpsLog.length === 0) {
    flags.push({
      type: "NO_GPS_DATA",
      severity: "warning",
      message: "No GPS data available for arrival verification",
    });
    return flags;
  }

  // Find arrival GPS point
  const arrivalPoint = job.gpsLog.find((p) => p.eventType === "arrival");
  if (!arrivalPoint) {
    flags.push({
      type: "NO_ARRIVAL_GPS",
      severity: "error",
      message: "No arrival GPS point recorded",
    });
    return flags;
  }

  // Check distance from customer location
  const distanceFromCustomer = calculateDistance(
    arrivalPoint.lat,
    arrivalPoint.lng,
    job.customerLocation.lat,
    job.customerLocation.lng
  );

  // Allow 100m tolerance (0.1 km)
  if (distanceFromCustomer > 0.1) {
    flags.push({
      type: "ARRIVAL_LOCATION_MISMATCH",
      severity: distanceFromCustomer > 0.5 ? "critical" : "error",
      message: `Arrival GPS is ${(distanceFromCustomer * 1000).toFixed(0)}m from customer location`,
      data: {
        expectedLocation: job.customerLocation,
        actualLocation: { lat: arrivalPoint.lat, lng: arrivalPoint.lng },
        distanceMeters: Math.round(distanceFromCustomer * 1000),
      },
    });
  }

  // Check GPS accuracy
  if (arrivalPoint.accuracy > 50) {
    flags.push({
      type: "LOW_GPS_ACCURACY",
      severity: arrivalPoint.accuracy > 100 ? "error" : "warning",
      message: `Arrival GPS accuracy is ${arrivalPoint.accuracy}m (should be <50m)`,
      data: { accuracy: arrivalPoint.accuracy },
    });
  }

  return flags;
}

/**
 * Check time spent at location
 */
export function checkTimeAtLocation(job: JobData): FraudFlag[] {
  const flags: FraudFlag[] = [];

  if (!job.arrivedAt || !job.completedAt) {
    return flags;
  }

  const timeAtLocationMs = new Date(job.completedAt).getTime() - new Date(job.arrivedAt).getTime();
  const timeAtLocationMinutes = timeAtLocationMs / (1000 * 60);

  // Suspiciously short time (less than 5 minutes)
  if (timeAtLocationMinutes < 5) {
    flags.push({
      type: "SUSPICIOUS_SHORT_DURATION",
      severity: "critical",
      message: `Job completed in only ${timeAtLocationMinutes.toFixed(1)} minutes`,
      data: { durationMinutes: timeAtLocationMinutes },
    });
  }

  // Extremely long time (more than 4 hours)
  if (timeAtLocationMinutes > 240) {
    flags.push({
      type: "EXCESSIVE_DURATION",
      severity: "warning",
      message: `Job took ${(timeAtLocationMinutes / 60).toFixed(1)} hours`,
      data: { durationMinutes: timeAtLocationMinutes },
    });
  }

  return flags;
}

/**
 * Check GPS movement patterns during job
 */
export function checkMovementPatterns(job: JobData): FraudFlag[] {
  const flags: FraudFlag[] = [];

  const trackingPoints = job.gpsLog.filter((p) => p.eventType === "tracking");

  if (trackingPoints.length < 2) {
    return flags;
  }

  // Check for GPS spoofing patterns (perfectly consistent coordinates)
  const uniqueLocations = new Set(
    trackingPoints.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
  );

  if (uniqueLocations.size === 1 && trackingPoints.length > 5) {
    flags.push({
      type: "STATIC_GPS_SUSPECTED_SPOOFING",
      severity: "critical",
      message: "GPS location remained perfectly static - possible spoofing",
      data: {
        uniqueLocations: uniqueLocations.size,
        totalPoints: trackingPoints.length,
      },
    });
  }

  // Check for impossible speed (teleporting)
  for (let i = 1; i < trackingPoints.length; i++) {
    const prev = trackingPoints[i - 1];
    const curr = trackingPoints[i];

    const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    const timeHours = (curr.timestamp.getTime() - prev.timestamp.getTime()) / (1000 * 60 * 60);

    if (timeHours > 0) {
      const speedKmh = distance / timeHours;

      // Impossible speed (> 200 km/h between tracking points)
      if (speedKmh > 200) {
        flags.push({
          type: "IMPOSSIBLE_SPEED",
          severity: "critical",
          message: `Detected movement at ${speedKmh.toFixed(0)} km/h between tracking points`,
          data: {
            speedKmh,
            distanceKm: distance,
            timeHours,
          },
        });
      }
    }
  }

  return flags;
}

/**
 * Check pricing anomalies
 */
export function checkPricingAnomalies(
  job: JobData,
  averageQuoteForType?: number
): FraudFlag[] {
  const flags: FraudFlag[] = [];

  if (!job.quoteAmount) {
    return flags;
  }

  // Extremely high quote
  if (job.quoteAmount > 1000) {
    flags.push({
      type: "HIGH_QUOTE_AMOUNT",
      severity: "warning",
      message: `Quote amount £${job.quoteAmount} is unusually high`,
      data: { quoteAmount: job.quoteAmount },
    });
  }

  // Compare to average if available
  if (averageQuoteForType && job.quoteAmount > averageQuoteForType * 2) {
    flags.push({
      type: "QUOTE_ABOVE_AVERAGE",
      severity: "warning",
      message: `Quote is ${((job.quoteAmount / averageQuoteForType) * 100).toFixed(0)}% of average`,
      data: {
        quoteAmount: job.quoteAmount,
        averageForType: averageQuoteForType,
      },
    });
  }

  return flags;
}

/**
 * Check locksmith reputation and patterns
 */
export function checkLocksmithPatterns(
  locksmithId: string,
  recentJobs: JobData[]
): FraudFlag[] {
  const flags: FraudFlag[] = [];

  // Too many complaints/issues recently
  const recentFlags = recentJobs.flatMap((job) => {
    return [
      ...checkArrivalVerification(job),
      ...checkTimeAtLocation(job),
      ...checkMovementPatterns(job),
    ];
  });

  const criticalFlags = recentFlags.filter((f) => f.severity === "critical");
  const errorFlags = recentFlags.filter((f) => f.severity === "error");

  if (criticalFlags.length >= 3) {
    flags.push({
      type: "PATTERN_MULTIPLE_CRITICAL_FLAGS",
      severity: "critical",
      message: `Locksmith has ${criticalFlags.length} critical flags in recent jobs`,
      data: { flagCount: criticalFlags.length },
    });
  }

  if (errorFlags.length >= 5) {
    flags.push({
      type: "PATTERN_MULTIPLE_ERRORS",
      severity: "error",
      message: `Locksmith has ${errorFlags.length} error flags in recent jobs`,
      data: { flagCount: errorFlags.length },
    });
  }

  return flags;
}

/**
 * Main fraud check function
 */
export function performFraudCheck(
  job: JobData,
  options?: {
    averageQuoteForType?: number;
    recentLocksmithJobs?: JobData[];
  }
): FraudCheckResult {
  const allFlags: FraudFlag[] = [];

  // Run all checks
  allFlags.push(...checkArrivalVerification(job));
  allFlags.push(...checkTimeAtLocation(job));
  allFlags.push(...checkMovementPatterns(job));
  allFlags.push(...checkPricingAnomalies(job, options?.averageQuoteForType));

  if (options?.recentLocksmithJobs) {
    allFlags.push(
      ...checkLocksmithPatterns(job.locksmithId, options.recentLocksmithJobs)
    );
  }

  // Calculate risk score
  let riskScore = 0;

  for (const flag of allFlags) {
    switch (flag.severity) {
      case "info":
        riskScore += 5;
        break;
      case "warning":
        riskScore += 15;
        break;
      case "error":
        riskScore += 30;
        break;
      case "critical":
        riskScore += 50;
        break;
    }
  }

  // Cap at 100
  riskScore = Math.min(100, riskScore);

  // Determine risk level
  let riskLevel: FraudCheckResult["riskLevel"];
  let recommendation: FraudCheckResult["recommendation"];

  if (riskScore >= 75) {
    riskLevel = "critical";
    recommendation = "block";
  } else if (riskScore >= 50) {
    riskLevel = "high";
    recommendation = "hold";
  } else if (riskScore >= 25) {
    riskLevel = "medium";
    recommendation = "review";
  } else {
    riskLevel = "low";
    recommendation = "approve";
  }

  // Generate details summary
  const criticalCount = allFlags.filter((f) => f.severity === "critical").length;
  const errorCount = allFlags.filter((f) => f.severity === "error").length;
  const warningCount = allFlags.filter((f) => f.severity === "warning").length;

  let details = `Risk Score: ${riskScore}/100. `;
  if (allFlags.length === 0) {
    details += "No issues detected.";
  } else {
    details += `Found ${allFlags.length} issue(s): `;
    if (criticalCount > 0) details += `${criticalCount} critical, `;
    if (errorCount > 0) details += `${errorCount} errors, `;
    if (warningCount > 0) details += `${warningCount} warnings.`;
  }

  return {
    riskScore,
    riskLevel,
    flags: allFlags,
    recommendation,
    details: details.trim().replace(/,$/, "."),
  };
}

/**
 * Quick pre-payout fraud check
 */
export function quickFraudCheck(job: JobData): {
  passed: boolean;
  reason?: string;
} {
  const result = performFraudCheck(job);

  if (result.recommendation === "block") {
    return {
      passed: false,
      reason: `Fraud check failed: ${result.details}`,
    };
  }

  if (result.recommendation === "hold") {
    return {
      passed: false,
      reason: `Manual review required: ${result.details}`,
    };
  }

  return { passed: true };
}
