/**
 * Engineering-health sensor (read-only, deterministic).
 *
 * Cheap code-debt metrics over the webapp `src/` tree so the Engineer agent has
 * a continuous signal it can trend over time and escalate from. This is a
 * TRIAGE signal — it flags "a deep review is warranted", it does NOT replace a
 * Claude-grade code/security review (the scheduled Claude run is the authority).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentTool, ToolResult } from "@/agents/core/types";

const execFileP = promisify(execFile);

async function countMatches(pattern: string): Promise<number> {
  try {
    // grep -rIoE: recurse, skip binaries, print each match on its own line.
    const { stdout } = await execFileP("grep", ["-rIoE", pattern, "src"], {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
      timeout: 20000,
    });
    return stdout.split("\n").filter(Boolean).length;
  } catch (e) {
    // grep exits 1 when there are no matches — that's a zero, not an error.
    if ((e as { code?: number })?.code === 1) return 0;
    throw e;
  }
}

/** Critical areas where missing tests are high-risk (money / auth / webhooks). */
const CRITICAL_AREAS = [
  "src/app/api/payments",
  "src/app/api/webhooks",
  "src/app/api/auth",
];

async function hasAnyTest(dir: string): Promise<boolean> {
  try {
    const full = path.resolve(process.cwd(), dir);
    const { stdout } = await execFileP(
      "grep",
      ["-rIlE", "(describe|it|test)\\(", full],
      { timeout: 10000, maxBuffer: 5 * 1024 * 1024 },
    );
    return stdout.split("\n").some((l) => /\.test\.|__tests__/.test(l));
  } catch {
    return false;
  }
}

export interface EngineeringHealth {
  checkedAt: string;
  metrics: {
    prismaAsAny: number;
    asAny: number;
    anyType: number;
    tsIgnore: number;
    eslintDisable: number;
    todos: number;
  };
  criticalPathsWithoutTests: string[];
}

const THRESHOLDS = { prismaAsAny: 50, anyType: 250, todos: 15, eslintDisable: 150 };

/** Pure: derive triage flags + a needs-review verdict. Unit-tested. */
export function deriveEngineeringFlags(h: EngineeringHealth): { flags: string[]; needsReview: boolean } {
  const flags: string[] = [];
  const m = h.metrics;
  if (m.prismaAsAny > THRESHOLDS.prismaAsAny)
    flags.push(`${m.prismaAsAny} \`prisma as any\` casts — DB-boundary type safety is largely off; schedule a typing pass + review.`);
  if (m.anyType > THRESHOLDS.anyType)
    flags.push(`${m.anyType} \`: any\` annotations — broad type erosion.`);
  if (m.todos > THRESHOLDS.todos)
    flags.push(`${m.todos} TODO/FIXME/HACK markers — triage the real ones.`);
  if (m.eslintDisable > THRESHOLDS.eslintDisable)
    flags.push(`${m.eslintDisable} eslint-disable directives — many un-audited carve-outs.`);
  for (const p of h.criticalPathsWithoutTests)
    flags.push(`Critical path has no tests: ${p} — money/auth/webhook code must be tested.`);
  return { flags, needsReview: flags.length > 0 };
}

export const getEngineeringHealthTool: AgentTool = {
  name: "getEngineeringHealth",
  description:
    "Read-only code-debt snapshot of the webapp (counts of `prisma as any`, `: any`, @ts-ignore, eslint-disable, TODO/FIXME, and critical money/auth/webhook paths missing tests) with triage flags + a needsReview verdict. Use to trend debt over time and escalate when a deep Claude review is warranted. This is a SIGNAL, not an authoritative review — never declare the code secure from this.",
  category: "analytics",
  permissions: ["engineer", "cto", "system"],
  parameters: [],
  async execute(): Promise<ToolResult> {
    try {
      const [prismaAsAny, asAny, anyType, tsIgnore, eslintDisable, todos] = await Promise.all([
        countMatches("prisma as any"),
        countMatches("as any"),
        countMatches(": any"),
        countMatches("@ts-(ignore|expect-error)"),
        countMatches("eslint-disable"),
        countMatches("TODO|FIXME|HACK"),
      ]);

      const testPresence = await Promise.all(CRITICAL_AREAS.map(hasAnyTest));
      const criticalPathsWithoutTests = CRITICAL_AREAS.filter((_, i) => !testPresence[i]);

      const health: EngineeringHealth = {
        checkedAt: new Date().toISOString(),
        metrics: { prismaAsAny, asAny, anyType, tsIgnore, eslintDisable, todos },
        criticalPathsWithoutTests,
      };
      const { flags, needsReview } = deriveEngineeringFlags(health);
      return { success: true, data: { ...health, flags, needsReview } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "engineering health scan failed" };
    }
  },
};

export const engineeringHealthTools: AgentTool[] = [getEngineeringHealthTool];
