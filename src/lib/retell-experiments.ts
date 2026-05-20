import { prisma } from "@/lib/db";

export const EXPERIMENT_GUARDRAILS = {
  minTrafficSplit: 5,
  maxTrafficSplit: 95,
  minStopLossThreshold: 1,
  maxStopLossThreshold: 50,
  minCallsPerArm: 20,
  maxConcurrentExperiments: 1,
} as const;

export type RolloutGuardrailIssue = {
  code:
    | "traffic_split_out_of_range"
    | "stop_loss_out_of_range"
    | "missing_versions"
    | "same_version"
    | "active_experiment_running";
  message: string;
};

export type RolloutGuardrailInput = {
  controlVersionId?: string | null;
  challengerVersionId?: string | null;
  trafficSplit?: number;
  stopLossThreshold?: number;
};

export function evaluateRolloutGuardrails(input: RolloutGuardrailInput): RolloutGuardrailIssue[] {
  const issues: RolloutGuardrailIssue[] = [];

  if (!input.controlVersionId || !input.challengerVersionId) {
    issues.push({
      code: "missing_versions",
      message: "controlVersionId and challengerVersionId are required.",
    });
  } else if (input.controlVersionId === input.challengerVersionId) {
    issues.push({
      code: "same_version",
      message: "Control and challenger must be different versions.",
    });
  }

  const split = input.trafficSplit ?? 50;
  if (split < EXPERIMENT_GUARDRAILS.minTrafficSplit || split > EXPERIMENT_GUARDRAILS.maxTrafficSplit) {
    issues.push({
      code: "traffic_split_out_of_range",
      message: `Traffic split must be between ${EXPERIMENT_GUARDRAILS.minTrafficSplit} and ${EXPERIMENT_GUARDRAILS.maxTrafficSplit}.`,
    });
  }

  const stopLoss = input.stopLossThreshold ?? 15;
  if (
    stopLoss < EXPERIMENT_GUARDRAILS.minStopLossThreshold ||
    stopLoss > EXPERIMENT_GUARDRAILS.maxStopLossThreshold
  ) {
    issues.push({
      code: "stop_loss_out_of_range",
      message: `Stop-loss threshold must be between ${EXPERIMENT_GUARDRAILS.minStopLossThreshold} and ${EXPERIMENT_GUARDRAILS.maxStopLossThreshold} percent.`,
    });
  }

  return issues;
}

export async function ensureNoConflictingExperiment(): Promise<RolloutGuardrailIssue | null> {
  const running = await prisma.voiceExperiment.findFirst({ where: { status: "running" } });
  if (running) {
    return {
      code: "active_experiment_running",
      message: `An experiment (${running.id}) is already running. Stop or evaluate it before starting a new one.`,
    };
  }
  return null;
}

export async function computeExperimentSummary(experimentId: string) {
  const experiment = await prisma.voiceExperiment.findUnique({ where: { id: experimentId } });
  if (!experiment) {
    return { ok: false, status: 404, error: "Experiment not found" };
  }

  const [controlCalls, challengerCalls, controlReviews, challengerReviews] = await Promise.all([
    experiment.controlVersionId
      ? prisma.voiceCall.count({ where: { configVersionId: experiment.controlVersionId } as any })
      : Promise.resolve(0),
    experiment.challengerVersionId
      ? prisma.voiceCall.count({ where: { configVersionId: experiment.challengerVersionId } as any })
      : Promise.resolve(0),
    experiment.controlVersionId
      ? prisma.voiceCallReview.findMany({ where: { call: { configVersionId: experiment.controlVersionId } as any } as any })
      : Promise.resolve([]),
    experiment.challengerVersionId
      ? prisma.voiceCallReview.findMany({ where: { call: { configVersionId: experiment.challengerVersionId } as any } as any })
      : Promise.resolve([]),
  ]);

  const avg = (items: Array<{ naturalnessScore: number | null }>) => {
    if (items.length === 0) return 0;
    return +(items.reduce((sum, i) => sum + (i.naturalnessScore ?? 0), 0) / items.length).toFixed(2);
  };

  const controlNaturalness = avg(controlReviews);
  const challengerNaturalness = avg(challengerReviews);

  const regression =
    controlNaturalness > 0
      ? +(((controlNaturalness - challengerNaturalness) / controlNaturalness) * 100).toFixed(2)
      : 0;

  const stopLossTriggered = regression > experiment.stopLossThreshold;

  const minCalls = EXPERIMENT_GUARDRAILS.minCallsPerArm;
  const insufficientData = controlCalls < minCalls || challengerCalls < minCalls;

  let winnerVersionId: string | null = null;
  if (stopLossTriggered) {
    winnerVersionId = experiment.controlVersionId;
  } else if (!insufficientData) {
    winnerVersionId =
      challengerNaturalness < controlNaturalness
        ? experiment.controlVersionId
        : experiment.challengerVersionId;
  }

  const summary = {
    controlCalls,
    challengerCalls,
    controlNaturalness,
    challengerNaturalness,
    regressionPercent: regression,
    stopLossTriggered,
    insufficientData,
    minCallsPerArm: minCalls,
    winnerVersionId,
  };

  const updated = await prisma.voiceExperiment.update({
    where: { id: experiment.id },
    data: {
      summaryJson: summary,
      winnerVersionId: winnerVersionId ?? undefined,
      status: stopLossTriggered ? "stopped" : experiment.status,
      endedAt: stopLossTriggered ? new Date() : experiment.endedAt,
    },
  });

  return { ok: true, status: 200, experiment: updated, summary };
}
