const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

type RuntimeEnv = NodeJS.ProcessEnv;

function parseBoolean(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export function getOllamaBaseUrl(env: RuntimeEnv = process.env): string {
  return env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
}

export function getOllamaRuntimeDecision(env: RuntimeEnv = process.env): {
  enabled: boolean;
  reason?: string;
  baseUrl: string;
} {
  const baseUrl = getOllamaBaseUrl(env);
  const override = parseBoolean(env.OLLAMA_RUNTIME_ENABLED);

  if (override === true) {
    return { enabled: true, baseUrl };
  }

  if (override === false) {
    return {
      enabled: false,
      baseUrl,
      reason: "disabled via OLLAMA_RUNTIME_ENABLED=false",
    };
  }

  // Default (no explicit OLLAMA_RUNTIME_ENABLED): on serverless (Vercel) with no
  // reachable Ollama endpoint (base URL unset or pointing at localhost), disable
  // the local runtime and route LLM calls to OpenAI. This keeps the OpenAI
  // fallback effectively PERMANENT in prod — prod never hits the dead localhost
  // Ollama, so the circuit breaker can't trip and force-block OpenAI.
  //
  // A home/Tailscale Ollama is still used whenever OLLAMA_BASE_URL explicitly
  // points at it (non-localhost), and local dev (localhost Ollama reachable)
  // is unaffected because it doesn't run on Vercel.
  const onServerless = !!env.VERCEL || !!env.VERCEL_ENV;
  const baseIsLocalhost =
    !env.OLLAMA_BASE_URL || /(?:^|\/\/)(?:localhost|127\.0\.0\.1)/i.test(baseUrl);
  if (onServerless && baseIsLocalhost) {
    return {
      enabled: false,
      baseUrl,
      reason: "serverless runtime with no reachable Ollama (localhost) — routing LLM to OpenAI",
    };
  }

  return { enabled: true, baseUrl };
}

export function isOllamaRuntimeEnabled(env: RuntimeEnv = process.env): boolean {
  return getOllamaRuntimeDecision(env).enabled;
}