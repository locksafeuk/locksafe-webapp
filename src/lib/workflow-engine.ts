/**
 * WorkflowEngine — lightweight sequential step runner for agent workflows.
 *
 * Usage:
 *   const result = await new WorkflowEngine<MyCtx>("my-workflow")
 *     .step("step-one", async (ctx) => { ...; return ctx; })
 *     .step("step-two", async (ctx) => { ...; return ctx; })
 *     .run({ initialValue: true });
 *
 * Each step receives the context produced by the previous step.
 * On failure the engine stops and returns success:false with the failed step name.
 */

export interface WorkflowStepResult {
  name: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface WorkflowResult<T> {
  success: boolean;
  context: T;
  steps: WorkflowStepResult[];
  totalDurationMs: number;
}

type StepFn<T> = (ctx: T) => Promise<T | void>;

export class WorkflowEngine<T extends Record<string, unknown> = Record<string, unknown>> {
  private readonly _name: string;
  private readonly _steps: Array<{ name: string; fn: StepFn<T> }> = [];

  constructor(name: string) {
    this._name = name;
  }

  step(name: string, fn: StepFn<T>): this {
    this._steps.push({ name, fn });
    return this;
  }

  async run(initialContext: T): Promise<WorkflowResult<T>> {
    const start = Date.now();
    let ctx = { ...initialContext };
    const stepResults: WorkflowStepResult[] = [];

    console.log(`[WorkflowEngine] "${this._name}" starting (${this._steps.length} steps)`);

    for (const { name, fn } of this._steps) {
      const stepStart = Date.now();
      try {
        const next = await fn(ctx);
        if (next !== undefined && next !== null) {
          ctx = next as T;
        }
        const durationMs = Date.now() - stepStart;
        stepResults.push({ name, success: true, durationMs });
        console.log(`[WorkflowEngine] ✓ ${name} (${durationMs}ms)`);
      } catch (err) {
        const durationMs = Date.now() - stepStart;
        const error = err instanceof Error ? err.message : String(err);
        stepResults.push({ name, success: false, durationMs, error });
        console.error(`[WorkflowEngine] ✗ ${name}: ${error}`);
        return { success: false, context: ctx, steps: stepResults, totalDurationMs: Date.now() - start };
      }
    }

    const totalDurationMs = Date.now() - start;
    console.log(`[WorkflowEngine] "${this._name}" done in ${totalDurationMs}ms`);
    return { success: true, context: ctx, steps: stepResults, totalDurationMs };
  }
}
