export type QaScoreField = "naturalnessScore" | "accuracyScore" | "empathyScore" | "complianceScore";

export type QaReviewInput = {
  callId: unknown;
  labels?: unknown;
  notes?: unknown;
  naturalnessScore?: unknown;
  accuracyScore?: unknown;
  empathyScore?: unknown;
  complianceScore?: unknown;
  shouldEscalate?: unknown;
  isGoldenExample?: unknown;
};

export type NormalizedQaReview = {
  callId: string;
  labels: string[];
  notes: string | null;
  naturalnessScore: number | null;
  accuracyScore: number | null;
  empathyScore: number | null;
  complianceScore: number | null;
  shouldEscalate: boolean;
  isGoldenExample: boolean;
};

export type QaNormalizationResult =
  | { ok: true; review: NormalizedQaReview }
  | { ok: false; errors: string[] };

const SCORE_FIELDS: QaScoreField[] = [
  "naturalnessScore",
  "accuracyScore",
  "empathyScore",
  "complianceScore",
];

const QA_SCORE_WEIGHTS: Record<QaScoreField, number> = {
  naturalnessScore: 0.3,
  accuracyScore: 0.3,
  empathyScore: 0.2,
  complianceScore: 0.2,
};

function normalizeScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 1 || value > 5) return null;
  return Math.round(value * 10) / 10;
}

export function normalizeQaReviewInput(input: QaReviewInput): QaNormalizationResult {
  const errors: string[] = [];

  const callId = typeof input.callId === "string" ? input.callId.trim() : "";
  if (!callId) errors.push("callId_required");

  const labels = Array.isArray(input.labels)
    ? input.labels.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];

  const notes = typeof input.notes === "string" ? input.notes.slice(0, 2000) : null;

  const scores: Record<QaScoreField, number | null> = {
    naturalnessScore: normalizeScore(input.naturalnessScore),
    accuracyScore: normalizeScore(input.accuracyScore),
    empathyScore: normalizeScore(input.empathyScore),
    complianceScore: normalizeScore(input.complianceScore),
  };

  const hasAnyScore = SCORE_FIELDS.some((field) => scores[field] !== null);
  if (!hasAnyScore) {
    errors.push("at_least_one_score_required");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    review: {
      callId,
      labels,
      notes,
      naturalnessScore: scores.naturalnessScore,
      accuracyScore: scores.accuracyScore,
      empathyScore: scores.empathyScore,
      complianceScore: scores.complianceScore,
      shouldEscalate: Boolean(input.shouldEscalate),
      isGoldenExample: Boolean(input.isGoldenExample),
    },
  };
}

export function computeCompositeQaScore(review: {
  naturalnessScore: number | null;
  accuracyScore: number | null;
  empathyScore: number | null;
  complianceScore: number | null;
}): number | null {
  let totalWeight = 0;
  let weighted = 0;

  for (const field of SCORE_FIELDS) {
    const value = review[field];
    if (value === null) continue;
    weighted += value * QA_SCORE_WEIGHTS[field];
    totalWeight += QA_SCORE_WEIGHTS[field];
  }

  if (totalWeight === 0) return null;
  return Math.round((weighted / totalWeight) * 100) / 100;
}

export type QaQueueCall = {
  id: string;
  startedAt: Date | null;
  durationSeconds: number | null;
  outcome: string | null;
  wasEscalated: boolean;
  flaggedForReview: boolean;
  isTestCall: boolean;
  callStatus: string | null;
  reviewCount: number;
};

export type QaQueueEntry = QaQueueCall & {
  priority: number;
  reasons: string[];
};

export function prioritizeQaQueue(calls: QaQueueCall[]): QaQueueEntry[] {
  const entries: QaQueueEntry[] = [];

  for (const call of calls) {
    if (call.isTestCall) continue;

    const reasons: string[] = [];
    let priority = 0;

    if (call.flaggedForReview) {
      priority += 50;
      reasons.push("flagged_for_review");
    }
    if (call.wasEscalated) {
      priority += 35;
      reasons.push("escalated");
    }
    if (call.outcome === "abandoned") {
      priority += 20;
      reasons.push("abandoned");
    }
    if (call.callStatus === "failed") {
      priority += 25;
      reasons.push("failed_status");
    }
    if (call.reviewCount === 0) {
      priority += 10;
      reasons.push("never_reviewed");
    }
    if ((call.durationSeconds ?? 0) >= 180) {
      priority += 5;
      reasons.push("long_call");
    }

    if (priority === 0) continue;

    entries.push({ ...call, priority, reasons });
  }

  return entries.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aTime = a.startedAt?.getTime() ?? 0;
    const bTime = b.startedAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}
