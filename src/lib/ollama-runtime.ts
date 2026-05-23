const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

type RuntimeEnv = NodeJS.ProcessEnv;

function parseBoolean(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function getHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isTailscaleHostname(value: string): boolean {
  const hostname = getHostname(value);
  return hostname.endsWith(".ts.net");
}

function isVercelRuntime(env: RuntimeEnv): boolean {
  return env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
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

  if (isVercelRuntime(env) && isTailscaleHostname(baseUrl)) {
    return {
      enabled: false,
      baseUrl,
      reason: "disabled in Vercel runtime for Tailscale ts.net Ollama endpoint",
    };
  }

  return { enabled: true, baseUrl };
}

export function isOllamaRuntimeEnabled(env: RuntimeEnv = process.env): boolean {
  return getOllamaRuntimeDecision(env).enabled;
}