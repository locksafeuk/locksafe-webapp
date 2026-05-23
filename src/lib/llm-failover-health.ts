import { chat, Models } from "@/lib/llm-router";
import { getOllamaRuntimeDecision } from "@/lib/ollama-runtime";

type CheckState = "ok" | "degraded" | "error" | "unconfigured";

export interface LLMFailoverCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  config: {
    ollamaBaseUrl: string;
    ollamaRuntimeEnabled: boolean;
    ollamaRuntimeReason?: string;
    openaiConfigured: boolean;
    enableOpenAIFallback: boolean;
    ollamaStrict: boolean;
    ollamaAgentStrict: boolean;
  };
  checks: {
    ollama: { state: CheckState; latencyMs?: number; message?: string };
    openaiBackup: { state: CheckState; latencyMs?: number; message?: string };
    routerLive: {
      state: CheckState;
      latencyMs?: number;
      usedFallback?: boolean;
      model?: string;
      message?: string;
    };
    emergencyFallback: { state: CheckState; sampleModel: string; sampleContent: string };
  };
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ENABLE_OPENAI_FALLBACK =
  (process.env.ENABLE_OPENAI_FALLBACK ?? process.env.OPENAI_FALLBACK_ENABLED ?? "true").toLowerCase() !== "false";
const OLLAMA_STRICT = (process.env.OLLAMA_STRICT ?? "false").toLowerCase() === "true";
const OLLAMA_AGENT_STRICT = (process.env.OLLAMA_AGENT_STRICT ?? "false").toLowerCase() === "true";
const OLLAMA_RUNTIME = getOllamaRuntimeDecision();

function classifyStatus(result: LLMFailoverCheckResult["checks"]): LLMFailoverCheckResult["status"] {
  const ollamaOk = result.ollama.state === "ok" || result.ollama.state === "unconfigured";
  const backupUsable =
    result.openaiBackup.state === "ok" ||
    (result.openaiBackup.state === "unconfigured" && !ENABLE_OPENAI_FALLBACK);
  const routerOk = result.routerLive.state === "ok";
  const routerUsable = result.routerLive.state === "ok" || result.routerLive.state === "degraded";

  if (ollamaOk && routerOk) return "healthy";
  if (ollamaOk || routerUsable || backupUsable) return "degraded";
  return "unhealthy";
}

async function checkOllama() {
  if (!OLLAMA_RUNTIME.enabled) {
    return {
      state: "unconfigured" as const,
      message: OLLAMA_RUNTIME.reason,
    };
  }

  const t0 = Date.now();
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return {
        state: "error" as const,
        latencyMs: Date.now() - t0,
        message: `HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return {
      state: "ok" as const,
      latencyMs: Date.now() - t0,
      message: `models=${data.models?.length ?? 0}`,
    };
  } catch (err) {
    return {
      state: "error" as const,
      latencyMs: Date.now() - t0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkOpenAIBackup() {
  if (!ENABLE_OPENAI_FALLBACK) {
    return {
      state: "unconfigured" as const,
      message: "ENABLE_OPENAI_FALLBACK=false",
    };
  }

  if (!OPENAI_API_KEY) {
    return {
      state: "unconfigured" as const,
      message: "OPENAI_API_KEY missing",
    };
  }

  const t0 = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(7000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      return {
        state: "error" as const,
        latencyMs: Date.now() - t0,
        message: `HTTP ${res.status}`,
      };
    }

    return {
      state: "ok" as const,
      latencyMs: Date.now() - t0,
      message: "reachable",
    };
  } catch (err) {
    return {
      state: "error" as const,
      latencyMs: Date.now() - t0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRouterLive() {
  const t0 = Date.now();
  try {
    const response = await chat(
      Models.FAST,
      [{ role: "user", content: "Return exactly: ok" }],
      { maxTokens: 12, temperature: 0, timeoutMs: 12000 }
    );

    return {
      state:
        !OLLAMA_RUNTIME.enabled || !(response.model === "emergency-fallback" || response.usedFallback)
          ? ("ok" as const)
          : ("degraded" as const),
      latencyMs: Date.now() - t0,
      usedFallback: response.usedFallback,
      model: response.model,
      message: response.content.slice(0, 80),
    };
  } catch (err) {
    return {
      state: "error" as const,
      latencyMs: Date.now() - t0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runLLMFailoverHealthCheck(): Promise<LLMFailoverCheckResult> {
  const [ollama, openaiBackup, routerLive] = await Promise.all([
    checkOllama(),
    checkOpenAIBackup(),
    checkRouterLive(),
  ]);

  const fallbackSample = {
    model: "emergency-fallback",
    content: "AI is temporarily unavailable (both Ollama and cloud fallback failed). Please retry shortly.",
  };

  const checks = {
    ollama,
    openaiBackup,
    routerLive,
    emergencyFallback: {
      state: "ok" as const,
      sampleModel: fallbackSample.model,
      sampleContent: fallbackSample.content,
    },
  };

  return {
    status: classifyStatus(checks),
    timestamp: new Date().toISOString(),
    config: {
      ollamaBaseUrl: OLLAMA_BASE_URL,
      ollamaRuntimeEnabled: OLLAMA_RUNTIME.enabled,
      ollamaRuntimeReason: OLLAMA_RUNTIME.reason,
      openaiConfigured: Boolean(OPENAI_API_KEY),
      enableOpenAIFallback: ENABLE_OPENAI_FALLBACK,
      ollamaStrict: OLLAMA_STRICT,
      ollamaAgentStrict: OLLAMA_AGENT_STRICT,
    },
    checks,
  };
}
