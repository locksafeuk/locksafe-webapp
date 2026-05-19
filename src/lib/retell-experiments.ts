import { prisma } from "@/lib/db";

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
  const winnerVersionId =
    stopLossTriggered || challengerNaturalness < controlNaturalness
      ? experiment.controlVersionId
      : experiment.challengerVersionId;

  const summary = {
    controlCalls,
    challengerCalls,
    controlNaturalness,
    challengerNaturalness,
    regressionPercent: regression,
    stopLossTriggered,
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
