import type { Prisma } from "@prisma/client";

/**
 * LLM Router — unified interface for all AI calls
 *
 * Local-first routes (2026 stack, all overridable via env):
 *   AGENT     → llama4:scout      (Mixture-of-Experts, native tool use)
 *   CONTENT   → qwen3:32b         (thinking mode, long-context content gen)
 *   FAST      → llama3.2:3b       (cheap classification + extraction)
 *   QUALITY   → qwen3:72b         (highest-quality long-form generation)
 *   HERMES    → hermes-4:70b      (Nous Research tool-calling specialist)
 *   REASONING → qwen3:32b         (deliberation / reflection / outcome grading)
 *
 * Env overrides (rollback without code changes):
 *   OLLAMA_MODEL_AGENT, OLLAMA_MODEL_CONTENT, OLLAMA_MODEL_FAST,
 *   OLLAMA_MODEL_QUALITY, OLLAMA_MODEL_HERMES, OLLAMA_MODEL_REASONING
 *
 * OpenAI is emergency fallback only and must be explicitly enabled.
 */

export const Models = {
  AGENT:       "AGENT",
  CONTENT:     "CONTENT",
  FAST:        "FAST",
  QUALITY:     "QUALITY",
  /** Hermes 4 (NousResearch) — 70B, function-calling specialist */
  HERMES:      "HERMES",
  /** Qwen3 thinking model — deliberation / reflection / outcome grading */
  REASONING:   "REASONING",
} as const;

export type ModelAlias = typeof Models[keyof typeof Models];

type FallbackSeverity = "low" | "medium" | "high" | "critical";

type ModelConfig = {
  localModel: string;
  openAiFallbackModel: string;
};

// Read OLLAMA_MODEL_<TIER> first, fall back to 2026 default.
// Empty-string values fall through (Vercel sometimes stores blanks).
function modelFromEnv(tier: string, defaultModel: string): string {
  return process.env[`OLLAMA_MODEL_${tier}`] || defaultModel;
}

const MODEL_CONFIG: Record<ModelAlias, ModelConfig> = {
  AGENT: {
    localModel: modelFromEnv("AGENT", "llama4:scout"),
    openAiFallbackModel: "gpt-4o-mini",
  },
  CONTENT: {
    localModel: modelFromEnv("CONTENT", "qwen3:32b"),
    openAiFallbackModel: "gpt-4o-mini",
  },
  FAST: {
    localModel: modelFromEnv("FAST", "llama3:70b"),
    openAiFallbackModel: "gpt-4o-mini",
  },
  QUALITY: {
    localModel: modelFromEnv("QUALITY", "qwen3:72b"),
    openAiFallbackModel: "gpt-4o",
  },
  HERMES: {
    localModel: modelFromEnv("HERMES", "hermes-4:70b"),
    openAiFallbackModel: "gpt-4o-mini",
  },
  REASONING: {
    localModel: modelFromEnv("REASONING", "qwen3:32b"),
    openAiFallbackModel: "gpt-4o",
  },
};

const SEVERITY_RANK: Record<FallbackSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string; enum?: string[] }>;
      required?: string[];
    };
  };
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: OllamaTool[];
  responseFormat?: "json" | "text";
  timeoutMs?: number;
  allowOpenAIFallback?: boolean;
  fallbackSeverity?: FallbackSeverity;
}

export interface LLMResponse {
  content: string;
  model: string;
  usedFallback: boolean;
  durationMs: number;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  /** Prompt tokens — from Ollama prompt_eval_count or OpenAI usage.prompt_tokens. */
  promptTokens?: number;
  /** Completion tokens — from Ollama eval_count or OpenAI usage.completion_tokens. */
  completionTokens?: number;
}

// Prefer explicit OLLAMA_BASE_URL (Tailscale remote), fall back to local.
// Use `||` (not `??`) so empty-string env values also fall back — Vercel sometimes
// stores blank values which would otherwise short-circuit to an invalid base URL.
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_SECRET   = process.env.OLLAMA_SECRET;
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;
const OPENAI_FALLBACK_ENABLED = process.env.OPENAI_FALLBACK_ENABLED === "true";
const LLM_POLICY_CACHE_TTL_MS = 30_000;

// ─── Circuit breaker ──────────────────────────────────────────────────────────
// Tracks consecutive Ollama failures. After CB_TRIP_THRESHOLD failures the
// circuit opens and all calls bypass Ollama for CB_RESET_MS (30 min). After
// that a lightweight health probe is attempted; on success the circuit closes
// and Telegram is notified in both directions.
//
// Module-level state survives across warm Vercel invocations. A cold start
// resets counters (one extra probe on restart — acceptable).
const CB_TRIP_THRESHOLD = 3;
const CB_RESET_MS       = 30 * 60_000; // 30 min
const ROUTER_ALERT_COOLDOWN_MS = CB_RESET_MS;
const ROUTER_DAILY_ALERT_COOLDOWN_MS = 24 * 60 * 60_000;
const ROUTER_CIRCUIT_TRIPPED_DEDUPE_KEY = "llm-router:ollama-circuit-tripped";
const ROUTER_CIRCUIT_RECOVERED_DEDUPE_KEY = "llm-router:ollama-circuit-recovered";
const ROUTER_FALLBACK_HALF_CAP_DEDUPE_KEY = "llm-router:openai-fallback-half-cap";
const ROUTER_FALLBACK_CAP_HIT_DEDUPE_KEY = "llm-router:openai-fallback-cap-hit";
const ROUTER_CIRCUIT_OPEN_ACTION = "llm-router:circuit-open";
const ROUTER_CIRCUIT_RECOVERED_ACTION = "llm-router:circuit-recovered";
const ROUTER_CIRCUIT_SHARED_AGENT = "system-alerts";
const ROUTER_CIRCUIT_SHARED_PLATFORM = "global";

type CBState = "closed" | "open";
let cbState: CBState   = "closed";
let cbFailures         = 0;
let cbOpenedAt         = 0;

async function notifyRouterAdminAlert(data: {
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  dedupeKey: string;
  cooldownMsOverride: number;
}): Promise<void> {
  try {
    const { sendAdminAlert } = await import("@/lib/telegram");
    await sendAdminAlert(data).catch(() => {});
  } catch {
    // Alert delivery is best effort.
  }
}

type SharedCircuitMarker = {
  action: string;
  createdAt: Date;
};

function toCircuitPayload(details: Record<string, unknown>): Prisma.InputJsonValue {
  return details as Prisma.InputJsonValue;
}

async function loadSharedCircuitMarker(): Promise<SharedCircuitMarker | null> {
  try {
    const { prisma } = await import("@/lib/db");
    return prisma.agentDecision.findFirst({
      where: {
        agent: ROUTER_CIRCUIT_SHARED_AGENT,
        platform: ROUTER_CIRCUIT_SHARED_PLATFORM,
        action: {
          in: [ROUTER_CIRCUIT_OPEN_ACTION, ROUTER_CIRCUIT_RECOVERED_ACTION],
        },
      },
      orderBy: { createdAt: "desc" },
      select: { action: true, createdAt: true },
    }) as Promise<SharedCircuitMarker | null>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[LLM Router] Failed to load shared circuit marker, using local state: ${message}`);
    return null;
  }
}

async function recordSharedCircuitMarker(
  action: typeof ROUTER_CIRCUIT_OPEN_ACTION | typeof ROUTER_CIRCUIT_RECOVERED_ACTION,
  model: string,
  err?: string,
): Promise<void> {
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.agentDecision.create({
      data: {
        agent: ROUTER_CIRCUIT_SHARED_AGENT,
        platform: ROUTER_CIRCUIT_SHARED_PLATFORM,
        action,
        payload: toCircuitPayload({
          model,
          error: err ?? null,
          circuitResetMs: CB_RESET_MS,
        }),
        policySnapshot: toCircuitPayload({
          source: "llm-router",
          model,
        }),
        dryRun: false,
        outcome: "ok",
        outcomeMessage: action,
        executedAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[LLM Router] Failed to persist shared circuit marker: ${message}`);
  }
}

// ─── OpenAI fallback spend cap ────────────────────────────────────────────────
// In-memory daily tracker. Resets at UTC midnight. Survives warm Vercel
// invocations; cold starts reset to zero (acceptable — one extra day of leeway).
const OPENAI_FALLBACK_DAILY_CAP_USD =
  Number(process.env.OPENAI_FALLBACK_DAILY_CAP_USD ?? 5);

let fallbackSpendToday = 0;   // USD accumulated this UTC day
let fallbackSpendDay   = -1;  // UTC day index for reset detection
let alertedHalfCap     = false;

async function probeOllama(): Promise<boolean> {
  const headers: Record<string, string> = {};
  if (OLLAMA_SECRET) headers["X-Ollama-Secret"] = OLLAMA_SECRET;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5_000);
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { headers, signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function ollamaCircuitAllows(): Promise<boolean> {
  const now = Date.now();
  if (cbState === "open" && now - cbOpenedAt < CB_RESET_MS) return false;

  const sharedMarker = await loadSharedCircuitMarker();
  const sharedOpen =
    sharedMarker?.action === ROUTER_CIRCUIT_OPEN_ACTION &&
    now - sharedMarker.createdAt.getTime() < CB_RESET_MS;

  if (sharedOpen) {
    cbState = "open";
    cbOpenedAt = sharedMarker.createdAt.getTime();
    return false;
  }

  const shouldProbe =
    (cbState === "open" && now - cbOpenedAt >= CB_RESET_MS) ||
    sharedMarker?.action === ROUTER_CIRCUIT_OPEN_ACTION;

  if (!shouldProbe) {
    cbState = "closed";
    cbFailures = 0;
    return true;
  }

  const healthy = await probeOllama();
  if (healthy) {
    cbState   = "closed";
    cbFailures = 0;
    cbOpenedAt = 0;
    console.log("[LLM Router] Circuit closed — Ollama recovered");
    await recordSharedCircuitMarker(ROUTER_CIRCUIT_RECOVERED_ACTION, "probe");
    await notifyRouterAdminAlert({
      title:    "✅ Ollama Circuit Recovered",
      message:  "Ollama is reachable again. Agents have switched back to local inference.",
      severity: "info",
      dedupeKey: ROUTER_CIRCUIT_RECOVERED_DEDUPE_KEY,
      cooldownMsOverride: ROUTER_ALERT_COOLDOWN_MS,
    });
  } else {
    cbState = "open";
    cbOpenedAt = now; // extend reset window
    console.log("[LLM Router] Circuit still open — Ollama probe failed");
  }
  return healthy;
}

async function recordOllamaFailure(model: string, err: string): Promise<void> {
  cbFailures++;
  if (cbState === "closed" && cbFailures >= CB_TRIP_THRESHOLD) {
    cbState    = "open";
    cbOpenedAt = Date.now();
    console.error(`[LLM Router] Circuit OPEN after ${cbFailures} failures (last: ${model})`);
    const sharedMarker = await loadSharedCircuitMarker();
    if (sharedMarker?.action === ROUTER_CIRCUIT_OPEN_ACTION) {
      cbOpenedAt = sharedMarker.createdAt.getTime();
      return;
    }

    await recordSharedCircuitMarker(ROUTER_CIRCUIT_OPEN_ACTION, model, err);
    await notifyRouterAdminAlert({
      title:    "🔴 Ollama Circuit Tripped",
      message:  `Ollama failed ${CB_TRIP_THRESHOLD}× in a row. Falling back to OpenAI for 30 min.\n\nLast error (${model}): ${err.slice(0, 200)}`,
      severity: "error",
      dedupeKey: ROUTER_CIRCUIT_TRIPPED_DEDUPE_KEY,
      cooldownMsOverride: ROUTER_ALERT_COOLDOWN_MS,
    });
  }
}

function recordOllamaSuccess(): void {
  if (cbFailures > 0) cbFailures = 0;
}

let llmPolicyCache: {
  value: { openAiFallbackEnabled: boolean; openAiFallbackMinSeverity: FallbackSeverity };
  expiresAt: number;
} | null = null;

// ─── Core router ─────────────────────────────────────────────────────────────

export async function chat(
  modelAlias: ModelAlias,
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const startMs = Date.now();
  const modelConfig = MODEL_CONFIG[modelAlias];
  const localModel = modelConfig.localModel;

  // Local-first for all workloads — skip Ollama if circuit is open.
  if (await ollamaCircuitAllows()) {
    try {
      const result = await callOllama(localModel, messages, options, startMs);
      recordOllamaSuccess();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[LLM Router] Local model failed (${localModel}): ${msg}`);
      await recordOllamaFailure(localModel, msg);

      if (!(await shouldUseOpenAIFallback(options))) {
        throw new Error(
          `[LLM Router] Local model failed and OpenAI fallback is disabled. ` +
          `Enable allowOpenAIFallback with high/critical severity for emergency fallback.`
        );
      }
    }
  } else {
    console.log(`[LLM Router] Circuit OPEN — bypassing Ollama (${localModel}), routing to OpenAI`);
    if (!(await shouldUseOpenAIFallback(options))) {
      throw new Error(
        `[LLM Router] Ollama circuit is open and OpenAI fallback is disabled.`
      );
    }
  }

  return callOpenAI(modelConfig.openAiFallbackModel, messages, options, startMs, true);
}

async function shouldUseOpenAIFallback(options: LLMOptions): Promise<boolean> {
  if (!OPENAI_API_KEY) {
    return false;
  }

  if (await isFallbackCapExceeded()) {
    return false;
  }

  const policy = await getRuntimeLlmPolicy();
  if (!policy.openAiFallbackEnabled && !OPENAI_FALLBACK_ENABLED) {
    return false;
  }

  if (!options.allowOpenAIFallback) {
    return false;
  }

  const severity = options.fallbackSeverity ?? "low";
  if (SEVERITY_RANK[severity] < SEVERITY_RANK[policy.openAiFallbackMinSeverity]) {
    return false;
  }

  if (policy.openAiFallbackEnabled) {
    return true;
  }

  return OPENAI_FALLBACK_ENABLED;
}

async function getRuntimeLlmPolicy(): Promise<{
  openAiFallbackEnabled: boolean;
  openAiFallbackMinSeverity: FallbackSeverity;
}> {
  const now = Date.now();
  if (llmPolicyCache && llmPolicyCache.expiresAt > now) {
    return llmPolicyCache.value;
  }

  const defaultPolicy = {
    openAiFallbackEnabled: false,
    openAiFallbackMinSeverity: "high" as FallbackSeverity,
  };

  try {
    const { prisma } = await import("@/lib/db");
    const globalPolicy = await prisma.marketingPolicy.findUnique({
      where: { platform: "global" },
      select: {
        openAiFallbackEnabled: true,
        openAiFallbackMinSeverity: true,
      },
    });

    const severity = String(globalPolicy?.openAiFallbackMinSeverity ?? "high").toLowerCase();
    const parsedSeverity =
      severity === "low" || severity === "medium" || severity === "high" || severity === "critical"
        ? (severity as FallbackSeverity)
        : "high";

    const value = {
      openAiFallbackEnabled: Boolean(globalPolicy?.openAiFallbackEnabled),
      openAiFallbackMinSeverity: parsedSeverity,
    };

    llmPolicyCache = {
      value,
      expiresAt: now + LLM_POLICY_CACHE_TTL_MS,
    };

    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[LLM Router] Failed to load runtime LLM policy, using defaults: ${message}`);
    llmPolicyCache = {
      value: defaultPolicy,
      expiresAt: now + LLM_POLICY_CACHE_TTL_MS,
    };
    return defaultPolicy;
  }
}

export async function complete(
  modelAlias: ModelAlias,
  prompt: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  return chat(modelAlias, [{ role: "user", content: prompt }], options);
}

// ─── Ollama client ────────────────────────────────────────────────────────────

async function callOllama(
  model: string,
  messages: LLMMessage[],
  options: LLMOptions,
  startMs: number
): Promise<LLMResponse> {
  const timeoutMs = options.timeoutMs ?? 180_000; // 3min — within Vercel Pro 300s limit

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 2048,
    },
  };

  if (options.tools?.length) {
    body.tools = options.tools;
  }

  if (options.responseFormat === "json") {
    body.format = "json";
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (OLLAMA_SECRET) {
      headers["X-Ollama-Secret"] = OLLAMA_SECRET;
    }

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json() as {
      message: { content: string; tool_calls?: Array<{ function: { name: string; arguments: unknown } }> };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const toolCalls = data.message.tool_calls?.map((tc) => ({
      name: tc.function.name,
      arguments: typeof tc.function.arguments === "string"
        ? JSON.parse(tc.function.arguments)
        : (tc.function.arguments as Record<string, unknown>),
    }));

    return {
      content:     data.message.content ?? "",
      model,
      usedFallback: false,
      durationMs:  Date.now() - startMs,
      toolCalls,
      promptTokens:     data.prompt_eval_count,
      completionTokens: data.eval_count,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Spend cap helpers ────────────────────────────────────────────────────────

function calcOpenAICost(model: string, promptTokens: number, completionTokens: number): number {
  const rates: Record<string, [number, number]> = {
    "gpt-4o":      [2.50, 10.00],
    "gpt-4o-mini": [0.15,  0.60],
  };
  const [inRate, outRate] = rates[model] ?? [2.50, 10.00];
  return (promptTokens / 1_000_000) * inRate + (completionTokens / 1_000_000) * outRate;
}

async function recordFallbackSpend(model: string, promptTokens: number, completionTokens: number): Promise<void> {
  const todayDay = Math.floor(Date.now() / 86_400_000);
  if (todayDay !== fallbackSpendDay) {
    fallbackSpendToday = 0;
    fallbackSpendDay   = todayDay;
    alertedHalfCap     = false;
  }
  fallbackSpendToday += calcOpenAICost(model, promptTokens, completionTokens);
  console.log(`[LLM Router] OpenAI fallback spend today: $${fallbackSpendToday.toFixed(4)} / $${OPENAI_FALLBACK_DAILY_CAP_USD} cap`);

  if (!alertedHalfCap && fallbackSpendToday >= OPENAI_FALLBACK_DAILY_CAP_USD * 0.5) {
    alertedHalfCap = true;
    await notifyRouterAdminAlert({
      title:    "⚠️ OpenAI Fallback at 50% Daily Cap",
      message:  `Spent $${fallbackSpendToday.toFixed(2)} of $${OPENAI_FALLBACK_DAILY_CAP_USD} today.\n\nOllama may still be unreachable — check Tailscale + Mac Studio.`,
      severity: "warning",
      dedupeKey: ROUTER_FALLBACK_HALF_CAP_DEDUPE_KEY,
      cooldownMsOverride: ROUTER_DAILY_ALERT_COOLDOWN_MS,
    });
  }
}

async function isFallbackCapExceeded(): Promise<boolean> {
  const todayDay = Math.floor(Date.now() / 86_400_000);
  if (todayDay !== fallbackSpendDay) return false;
  if (fallbackSpendToday < OPENAI_FALLBACK_DAILY_CAP_USD) return false;

  console.error(`[LLM Router] OpenAI fallback daily cap ($${OPENAI_FALLBACK_DAILY_CAP_USD}) exceeded — blocking.`);
  await notifyRouterAdminAlert({
    title:    "🚨 OpenAI Fallback Cap HIT — Blocked",
    message:  `Daily cap of $${OPENAI_FALLBACK_DAILY_CAP_USD} reached. All OpenAI fallback is BLOCKED until midnight UTC.\n\nRestore Ollama or raise OPENAI_FALLBACK_DAILY_CAP_USD.`,
    severity: "error",
    dedupeKey: ROUTER_FALLBACK_CAP_HIT_DEDUPE_KEY,
    cooldownMsOverride: ROUTER_DAILY_ALERT_COOLDOWN_MS,
  });
  return true;
}

// ─── OpenAI client ────────────────────────────────────────────────────────────

async function callOpenAI(
  model: string,
  messages: LLMMessage[],
  options: LLMOptions,
  startMs: number,
  usedFallback: boolean
): Promise<LLMResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error("[LLM Router] Neither OLLAMA_BASE_URL nor OPENAI_API_KEY is configured");
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens:  options.maxTokens ?? 2048,
  };

  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  if (options.tools?.length) {
    body.tools = options.tools.map((t) => ({ type: "function", function: t.function }));
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI returned HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json() as {
    choices: Array<{
      message: {
        content: string | null;
        tool_calls?: Array<{ function: { name: string; arguments: string } }>;
      };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const choice = data.choices[0].message;

  const toolCalls = choice.tool_calls?.map((tc) => ({
    name:      tc.function.name,
    arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
  }));

  const promptTokens     = data.usage?.prompt_tokens     ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  await recordFallbackSpend(model, promptTokens, completionTokens);

  return {
    content:     choice.content ?? "",
    model,
    usedFallback,
    durationMs:  Date.now() - startMs,
    toolCalls,
    promptTokens,
    completionTokens,
  };
}

// ─── Cost helpers ─────────────────────────────────────────────────────────────

/** Cost tracking for budget system — Ollama is near-zero, OpenAI is real cost */
export function estimateLLMCost(modelAlias: ModelAlias, tokens = 1000): number {
  const costPer1k: Record<ModelAlias, number> = {
    AGENT:     0.0001,  // near-zero — local compute only
    CONTENT:   0.0001,
    FAST:      0.00001,
    QUALITY:   0.0001,
    HERMES:    0.00001, // near-zero — local Hermes 4 70B
    REASONING: 0.0001,  // local qwen3 thinking, OpenAI fallback billed elsewhere
  };
  return (costPer1k[modelAlias] * tokens) / 1000;
}
