import { config as loadEnv } from "dotenv";
import fs from "fs";
import path from "path";

loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/db";
import { chat, Models } from "@/lib/llm-router";
import { RETELL_SIMULATION_SCENARIOS, scoreSimulationOutput } from "@/lib/retell-simulations";
import { computeExperimentSummary } from "@/lib/retell-experiments";

type EvalOutput = {
  naturalnessScore: number;
  accuracyScore: number;
  empathyScore: number;
  complianceScore: number;
  shouldEscalate: boolean;
  labels: string[];
  notes: string;
  fieldsCollected: string[];
  promptSection: "REALISM_RULES" | "TOOL_TRIGGER_POLICY" | "INTAKE_REQUIREMENTS" | "ESCALATION_POLICY" | "IDENTITY_AND_PERSONA" | "PRICING_GUARDRAILS";
  promptPatch: string;
};

type ParsedArgs = {
  limit: number;
  lookbackDays: number;
  writeReviews: boolean;
  autoExperiment: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const arg = (key: string, fallback: string) => {
    const hit = argv.find((x) => x.startsWith(`--${key}=`));
    if (!hit) return fallback;
    const [, value] = hit.split("=");
    return value ?? fallback;
  };

  const boolArg = (key: string, fallback: boolean) => {
    const value = arg(key, String(fallback)).toLowerCase();
    return value === "true" || value === "1" || value === "yes";
  };

  return {
    limit: Number.parseInt(arg("limit", "18"), 10),
    lookbackDays: Number.parseInt(arg("lookbackDays", "14"), 10),
    writeReviews: boolArg("writeReviews", true),
    autoExperiment: boolArg("autoExperiment", true),
  };
}

function clampScore(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function safeArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean);
}

function parseEval(content: string): EvalOutput {
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  const allowedSections = new Set([
    "REALISM_RULES",
    "TOOL_TRIGGER_POLICY",
    "INTAKE_REQUIREMENTS",
    "ESCALATION_POLICY",
    "IDENTITY_AND_PERSONA",
    "PRICING_GUARDRAILS",
  ]);

  const section = typeof parsed?.promptSection === "string" && allowedSections.has(parsed.promptSection)
    ? parsed.promptSection
    : "REALISM_RULES";

  return {
    naturalnessScore: clampScore(parsed?.naturalnessScore),
    accuracyScore: clampScore(parsed?.accuracyScore),
    empathyScore: clampScore(parsed?.empathyScore),
    complianceScore: clampScore(parsed?.complianceScore),
    shouldEscalate: Boolean(parsed?.shouldEscalate),
    labels: safeArray(parsed?.labels),
    notes: typeof parsed?.notes === "string" ? parsed.notes.slice(0, 500) : "",
    fieldsCollected: safeArray(parsed?.fieldsCollected),
    promptSection: section as EvalOutput["promptSection"],
    promptPatch: typeof parsed?.promptPatch === "string" ? parsed.promptPatch.slice(0, 400) : "",
  };
}

function buildEvalPrompt(call: {
  retellCallId: string;
  callCategory: string | null;
  urgencyLevel: string | null;
  outcome: string | null;
  summary: string | null;
  transcript: any;
}) {
  const transcriptText = Array.isArray(call.transcript)
    ? call.transcript
        .slice(0, 24)
        .map((m: any) => `${m?.role ?? "unknown"}: ${m?.content ?? ""}`)
        .join("\n")
    : "";

  const system = [
    "You are a strict QA evaluator for a locksmith receptionist voice AI.",
    "Return JSON only.",
    "Score each metric from 1 to 5.",
    "Identify if escalation is required.",
    "Return realistic labels and one high-impact prompt patch.",
  ].join(" ");

  const user = [
    "Evaluate this call and return exactly this JSON schema:",
    "{",
    '  "naturalnessScore": number,',
    '  "accuracyScore": number,',
    '  "empathyScore": number,',
    '  "complianceScore": number,',
    '  "shouldEscalate": boolean,',
    '  "labels": string[],',
    '  "notes": string,',
    '  "fieldsCollected": string[],',
    '  "promptSection": "REALISM_RULES" | "TOOL_TRIGGER_POLICY" | "INTAKE_REQUIREMENTS" | "ESCALATION_POLICY" | "IDENTITY_AND_PERSONA" | "PRICING_GUARDRAILS",',
    '  "promptPatch": string',
    "}",
    "",
    `callId: ${call.retellCallId}`,
    `category: ${call.callCategory ?? "unknown"}`,
    `urgency: ${call.urgencyLevel ?? "unknown"}`,
    `outcome: ${call.outcome ?? "unknown"}`,
    `summary: ${call.summary ?? ""}`,
    "transcript:",
    transcriptText || "(empty)",
  ].join("\n");

  return { system, user };
}

function nowTag() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const since = new Date(Date.now() - args.lookbackDays * 24 * 60 * 60 * 1000);

  console.log("[retell-local-evaluator] Starting local evaluation run...");
  console.log(`[retell-local-evaluator] limit=${args.limit} lookbackDays=${args.lookbackDays} writeReviews=${args.writeReviews} autoExperiment=${args.autoExperiment}`);

  const activeConfig = await prisma.voiceAgentConfig.findFirst({ where: { isActive: true } });
  if (!activeConfig) {
    throw new Error("No active voice config found.");
  }

  const calls = await prisma.voiceCall.findMany({
    where: {
      startedAt: { gte: since },
      callStatus: "completed",
      transcript: { not: null },
    } as any,
    orderBy: { startedAt: "desc" },
    take: args.limit,
    select: {
      id: true,
      retellCallId: true,
      callCategory: true,
      urgencyLevel: true,
      outcome: true,
      summary: true,
      transcript: true,
      configVersionId: true,
      startedAt: true,
    },
  });

  if (calls.length === 0) {
    console.log("[retell-local-evaluator] No eligible calls found.");
    return;
  }

  const evaluations: Array<{
    callId: string;
    retellCallId: string;
    configVersionId: string | null;
    eval: EvalOutput;
  }> = [];

  for (const call of calls) {
    const { system, user } = buildEvalPrompt(call as any);

    try {
      const response = await chat(
        Models.HERMES,
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        {
          responseFormat: "json",
          temperature: 0.1,
          timeoutMs: 120000,
          allowOpenAIFallback: false,
        }
      );

      const parsed = parseEval(response.content);
      evaluations.push({
        callId: call.id,
        retellCallId: call.retellCallId,
        configVersionId: call.configVersionId ?? null,
        eval: parsed,
      });

      console.log(
        `[retell-local-evaluator] scored call=${call.retellCallId} nat=${parsed.naturalnessScore} acc=${parsed.accuracyScore} emp=${parsed.empathyScore} cmp=${parsed.complianceScore}`
      );

      if (args.writeReviews) {
        const existing = await prisma.voiceCallReview.findFirst({
          where: {
            callId: call.id,
            reviewerId: "local-hermes-evaluator",
          },
          orderBy: { createdAt: "desc" },
        });

        if (!existing) {
          await prisma.voiceCallReview.create({
            data: {
              callId: call.id,
              reviewerId: "local-hermes-evaluator",
              labels: parsed.labels,
              notes: parsed.notes,
              naturalnessScore: parsed.naturalnessScore,
              accuracyScore: parsed.accuracyScore,
              empathyScore: parsed.empathyScore,
              complianceScore: parsed.complianceScore,
              shouldEscalate: parsed.shouldEscalate,
              isGoldenExample: parsed.naturalnessScore >= 4 && parsed.accuracyScore >= 4 && parsed.complianceScore >= 4,
            },
          });
        }
      }
    } catch (error: any) {
      console.warn(`[retell-local-evaluator] failed call=${call.retellCallId}: ${error?.message ?? String(error)}`);
    }
  }

  if (evaluations.length === 0) {
    console.log("[retell-local-evaluator] No successful evaluations completed.");
    return;
  }

  const avg = (selector: (x: (typeof evaluations)[number]) => number) => {
    return +(evaluations.reduce((sum, item) => sum + selector(item), 0) / evaluations.length).toFixed(2);
  };

  const metrics = {
    count: evaluations.length,
    avgNaturalness: avg((x) => x.eval.naturalnessScore),
    avgAccuracy: avg((x) => x.eval.accuracyScore),
    avgEmpathy: avg((x) => x.eval.empathyScore),
    avgCompliance: avg((x) => x.eval.complianceScore),
    escalationRate: +((evaluations.filter((x) => x.eval.shouldEscalate).length / evaluations.length) * 100).toFixed(1),
  };

  const patchRank = new Map<string, { section: string; patch: string; count: number }>();
  for (const row of evaluations) {
    if (!row.eval.promptPatch) continue;
    const key = `${row.eval.promptSection}::${row.eval.promptPatch}`;
    const current = patchRank.get(key);
    patchRank.set(key, {
      section: row.eval.promptSection,
      patch: row.eval.promptPatch,
      count: (current?.count ?? 0) + 1,
    });
  }

  const topPromptPatches = Array.from(patchRank.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const collectedUnion = Array.from(
    new Set(evaluations.flatMap((x) => x.eval.fieldsCollected).filter(Boolean))
  );

  const simulationRuns = RETELL_SIMULATION_SCENARIOS.map((scenario) => {
    const simulation = scoreSimulationOutput({
      transcript: "",
      collectedFields: collectedUnion,
      naturalnessScore: metrics.avgNaturalness,
      escalated: scenario.expected.requiresEscalation,
      scenario,
    });

    return {
      scenario: scenario.key,
      passed: simulation.passed,
      score: simulation.score,
      failureReason: simulation.failureReason,
      expected: scenario.expected,
    };
  });

  const simulationPassRate = +((simulationRuns.filter((x) => x.passed).length / simulationRuns.length) * 100).toFixed(1);

  let experimentAction: Record<string, unknown> = { action: "skipped" };

  if (args.autoExperiment) {
    const running = await prisma.voiceExperiment.findFirst({
      where: { status: "running" },
      orderBy: { createdAt: "desc" },
    });

    if (running) {
      const summary = await computeExperimentSummary(running.id);
      experimentAction = {
        action: "evaluated_running",
        experimentId: running.id,
        ok: summary.ok,
        status: summary.status,
        summary: summary.ok ? summary.summary : summary.error,
      };
    } else {
      const versions = await prisma.voiceAgentConfigVersion.findMany({
        where: { configId: activeConfig.id },
        orderBy: { createdAt: "desc" },
        take: 2,
      });

      if (versions.length >= 2) {
        const challenger = versions[0];
        const control = versions[1];

        const created = await prisma.voiceExperiment.create({
          data: {
            name: `Local Eval Candidate v${control.version} vs v${challenger.version}`,
            status: "running",
            controlVersionId: control.id,
            challengerVersionId: challenger.id,
            trafficSplit: 50,
            stopLossThreshold: 15,
            createdBy: "local-hermes-evaluator",
            startedAt: new Date(),
          },
        });

        experimentAction = {
          action: "created_candidate",
          experimentId: created.id,
          controlVersionId: control.id,
          challengerVersionId: challenger.id,
        };
      } else {
        experimentAction = {
          action: "not_enough_versions",
          found: versions.length,
        };
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    args,
    metrics,
    simulation: {
      passRate: simulationPassRate,
      runs: simulationRuns,
    },
    topPromptPatches,
    experimentAction,
    sampleCalls: evaluations.slice(0, 12).map((x) => ({
      retellCallId: x.retellCallId,
      configVersionId: x.configVersionId,
      naturalnessScore: x.eval.naturalnessScore,
      accuracyScore: x.eval.accuracyScore,
      empathyScore: x.eval.empathyScore,
      complianceScore: x.eval.complianceScore,
      labels: x.eval.labels,
      promptSection: x.eval.promptSection,
      promptPatch: x.eval.promptPatch,
    })),
  };

  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const tag = nowTag();
  const jsonPath = path.join(reportsDir, `retell-local-eval-${tag}.json`);
  const mdPath = path.join(reportsDir, `retell-local-eval-${tag}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    "# Retell Local Evaluator Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Calls scored: ${metrics.count}`,
    `Avg naturalness: ${metrics.avgNaturalness}`,
    `Avg accuracy: ${metrics.avgAccuracy}`,
    `Avg empathy: ${metrics.avgEmpathy}`,
    `Avg compliance: ${metrics.avgCompliance}`,
    `Escalation rate: ${metrics.escalationRate}%`,
    `Simulation pass rate: ${simulationPassRate}%`,
    "",
    "## Top Prompt Patches",
    ...(topPromptPatches.length
      ? topPromptPatches.map((x, i) => `${i + 1}. [${x.section}] (${x.count}) ${x.patch}`)
      : ["No prompt patches generated."]),
    "",
    "## Experiment Action",
    "```json",
    JSON.stringify(experimentAction, null, 2),
    "```",
  ].join("\n");

  fs.writeFileSync(mdPath, md);

  console.log(`[retell-local-evaluator] Report written: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`[retell-local-evaluator] Report written: ${path.relative(process.cwd(), mdPath)}`);
  console.log("[retell-local-evaluator] Completed.");
}

main()
  .catch((error) => {
    console.error("[retell-local-evaluator] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
