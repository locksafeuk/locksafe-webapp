/**
 * LLM Router — unified interface for all AI calls
 *
 * Routes to:
 *   AGENT   → llama3.3:70b  (Ollama) — tool-calling, structured reasoning, decisions
 *   CONTENT → qwen2.5:72b   (Ollama) — social copy, ad copy, blog drafts
 *   FAST    → llama3:70b    (Ollama) — summaries, routing, cheap tasks
 *   QUALITY → gpt-4o        (OpenAI) — final quality review, high-stakes only
 *
 * Ollama is called locally (localhost:11434) or via Tailscale (OLLAMA_BASE_URL).
 * Falls back to OpenAI gpt-4o-mini if Ollama is unreachable.
 */

export const Models = {
  AGENT:   "AGENT",
  CONTENT: "CONTENT",
  FAST:    "FAST",
  QUALITY: "QUALITY",
} as const;

export type ModelAlias = typeof Models[keyof typeof Models];

/** Internal map from alias to actual model name */
const MODEL_NAMES: Record<ModelAlias, string> = {
  AGENT:   "llama3.3:70b",
  CONTENT: "qwen2.5:72b",
  FAST:    "llama3:70b",
  QUALITY: "gpt-4o",
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
}

export interface LLMResponse {
  content: string;
  model: string;
  usedFallback: boolean;
  durationMs: number;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
}

// Prefer explicit OLLAMA_BASE_URL (Tailscale remote), fall back to local
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_SECRET   = process.env.OLLAMA_SECRET;
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;

// ─── Core router ─────────────────────────────────────────────────────────────

export async function chat(
  modelAlias: ModelAlias,
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const startMs = Date.now();
  const modelName = MODEL_NAMES[modelAlias];

  // QUALITY always uses OpenAI
  if (modelAlias === "QUALITY") {
    return callOpenAI(modelName, messages, options, startMs, false);
  }

  // Ollama models — try local/Tailscale, fall back to OpenAI on failure
  try {
    return await callOllama(modelName, messages, options, startMs);
  } catch (err) {
    console.warn(`[LLM Router] Ollama unreachable (${modelName}), falling back to OpenAI:`, err instanceof Error ? err.message : err);
  }

  // Fallback — use gpt-4o-mini (cheap, fast)
  return callOpenAI("gpt-4o-mini", messages, options, startMs, true);
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
  };
}

// ─── Cost helpers ─────────────────────────────────────────────────────────────

/** Cost tracking for budget system — Ollama is near-zero, OpenAI is real cost */
export function estimateLLMCost(modelAlias: ModelAlias, tokens = 1000): number {
  const costPer1k: Record<ModelAlias, number> = {
    AGENT:   0.0001,  // near-zero — local compute only
    CONTENT: 0.0001,
    FAST:    0.00001,
    QUALITY: 0.005,   // gpt-4o: ~$5/1M input tokens
  };
  return (costPer1k[modelAlias] * tokens) / 1000;
}
