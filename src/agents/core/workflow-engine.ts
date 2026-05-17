/**
 * Lightweight Workflow Engine
 *
 * Runs multi-step agent workflows sequentially.
 * Each step can read/write to shared context and the DB.
 * Failed steps are retried once, then logged and skipped (non-fatal by default).
 */

import { sendAdminAlert } from "@/lib/telegram";

export interface WorkflowContext {
  workflowId: string;
  data: Record<string, unknown>;
  results: Record<string, WorkflowStepResult>;
  errors: string[];
}

export interface WorkflowStepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

export interface WorkflowStep {
  name: string;
  /** Return value is stored in context.results[step.name] */
  action: (ctx: WorkflowContext) => Promise<unknown>;
  /** If false, step is skipped (no error). Default: true */
  condition?: (ctx: WorkflowContext) => boolean;
  /** Number of retry attempts on failure. Default: 1 */
  retries?: number;
  /** If true, a step failure aborts the workflow. Default: false */
  critical?: boolean;
}

/**
 * Execute a named workflow sequentially.
 * Returns the final context — callers can inspect results and errors.
 */
export async function runWorkflow(
  name: string,
  steps: WorkflowStep[],
  initialData: Record<string, unknown> = {}
): Promise<WorkflowContext> {
  const ctx: WorkflowContext = {
    workflowId: `${name}-${Date.now()}`,
    data: initialData,
    results: {},
    errors: [],
  };

  console.log(`[Workflow:${name}] Starting (${steps.length} steps)`);

  for (const step of steps) {
    // Check condition
    if (step.condition && !step.condition(ctx)) {
      console.log(`[Workflow:${name}] Skipping step: ${step.name}`);
      ctx.results[step.name] = { success: true, output: "skipped", durationMs: 0 };
      continue;
    }

    const maxAttempts = 1 + (step.retries ?? 1);
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startMs = Date.now();
      try {
        const output = await step.action(ctx);
        ctx.results[step.name] = { success: true, output, durationMs: Date.now() - startMs };
        console.log(`[Workflow:${name}] Step "${step.name}" ✓ (${Date.now() - startMs}ms)`);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[Workflow:${name}] Step "${step.name}" failed (attempt ${attempt}/${maxAttempts}):`, lastError);
        if (attempt === maxAttempts) {
          ctx.results[step.name] = { success: false, error: lastError, durationMs: Date.now() - startMs };
          ctx.errors.push(`${step.name}: ${lastError}`);

          if (step.critical) {
            console.error(`[Workflow:${name}] Critical step failed — aborting`);
            return ctx;
          }
        }
      }
    }
  }

  const failed = Object.values(ctx.results).filter((r) => !r.success).length;
  console.log(`[Workflow:${name}] Complete — ${steps.length - failed}/${steps.length} steps succeeded`);

  return ctx;
}
