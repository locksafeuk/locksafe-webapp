/**
 * LLM Router — unified interface for all AI calls
 *
 * Local-first routes:
 *   AGENT   → llama3.3:70b  (Ollama)
 *   CONTENT → qwen2.5:72b   (Ollama)
 *   FAST    → llama3:70b    (Ollama)
 *   QUALITY → qwen2.5:72b   (Ollama)
 *
 * OpenAI is emergency fallback only and must be explicitly enabled.
 */

export const Models = {
  AGENT:       "AGENT",
  CONTENT:     "CONTENT",
  FAST:        "FAST",
  QUALITY:     "QUALITY",
  /** Hermes 3 (NousResearch) — 8B, fine-tuned for tool-calling / function dispatch */
  HERMES:      "HERMES",
} as const;

export type ModelAlias = typeof Models[keyof typeof Models];

type FallbackSeverity = "low" | "medium" | "high" | "critical";

type ModelConfig = {
  localModel: string;
  openAiFallbackModel: string;
};

const MODEL_CONFIG: Record<ModelAlias, ModelConfig> = {
  AGENT: {
    localModel: "llama3.3:70b",
    openAiFallbackModel: "gpt-4o-mini",
  },
  CONTENT: {
    localModel: "qwen2.5:72b",
    openAiFallbackModel: "gpt-4o-mini",
  },
  FAST: {
    localModel: "llama3:70b",
    openAiFallbackModel: "gpt-4o-mini",
  },
  QUALITY: {
    localModel: "qwen2.5:72b",
    openAiFallbackModel: "gpt-4o",
  },
  HERMES: {
    localModel: "hermes3",
    openAiFallbackModel: "gpt-4o-mini",
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

  // Local-first for all workloads.
  try {
    return await callOllama(localModel, messages, options, startMs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[LLM Router] Local model failed (${localModel}): ${msg}`);

    if (!(await shouldUseOpenAIFallback(options))) {
      throw new Error(
        `[LLM Router] Local model failed and OpenAI fallback is disabled. ` +
        `Enable allowOpenAIFallback with high/critical severity for emergency fallback.`
      );
    }
  }

  return callOpenAI(modelConfig.openAiFallbackModel, messages, options, startMs, true);
}

async function shouldUseOpenAIFallback(options: LLMOptions): Promise<boolean> {
  if (!OPENAI_API_KEY) {
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

  return {
    content:     choice.content ?? "",
    model,
    usedFallback,
    durationMs:  Date.now() - startMs,
    toolCalls,
    promptTokens:     data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  };
}

// ─── Cost helpers ─────────────────────────────────────────────────────────────

/** Cost tracking for budget system — Ollama is near-zero, OpenAI is real cost */
export function estimateLLMCost(modelAlias: ModelAlias, tokens = 1000): number {
  const costPer1k: Record<ModelAlias, number> = {
    AGENT:   0.0001,  // near-zero — local compute only
    CONTENT: 0.0001,
    FAST:    0.00001,
    QUALITY: 0.0001,
    HERMES:  0.00001, // near-zero — local Hermes 3 8B
  };
  return (costPer1k[modelAlias] * tokens) / 1000;
}
