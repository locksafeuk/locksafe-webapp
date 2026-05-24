export {};

type JsonRecord = Record<string, unknown>;

type CheckResult = {
  ok: boolean;
  statusCode: number;
  body?: JsonRecord;
  error?: string;
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function classifyModel(model: string | null | undefined): "local" | "openai" | "unknown" {
  if (!model) return "unknown";
  const m = model.toLowerCase();
  if (/hermes|llama|qwen|mistral|gemma|deepseek|phi/.test(m)) return "local";
  if (/gpt|o1|o3|o4|openai/.test(m)) return "openai";
  return "unknown";
}

async function fetchJson(url: string, init?: RequestInit): Promise<CheckResult> {
  try {
    const response = await fetch(url, init);
    let body: JsonRecord | undefined;

    try {
      body = (await response.json()) as JsonRecord;
    } catch {
      body = undefined;
    }

    return {
      ok: response.ok,
      statusCode: response.status,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function printHeader(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function main(): Promise<void> {
  const baseUrl = (process.env.VERIFY_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk").replace(/\/$/, "");
  const cronSecret = process.env.VERIFY_CRON_SECRET || process.env.CRON_SECRET;
  const adminCookie = process.env.VERIFY_ADMIN_AUTH_TOKEN;
  const minLocalPct = envNumber("VERIFY_MIN_LOCAL_PCT", 90);

  let failures = 0;

  console.log("Agent runtime verification");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Minimum local percentage target: ${minLocalPct}%`);

  printHeader("Public failover health");
  const failover = await fetchJson(`${baseUrl}/api/health/llm-failover`);
  if (!failover.ok || !failover.body) {
    failures++;
    console.log(`FAIL: GET /api/health/llm-failover (${failover.statusCode}) ${failover.error || "no response body"}`);
  } else {
    const status = String(failover.body.status || "unknown");
    const checks = (failover.body.checks || {}) as JsonRecord;
    const ollama = (checks.ollama || {}) as JsonRecord;
    const openaiBackup = (checks.openaiBackup || {}) as JsonRecord;

    console.log(`Status: ${status}`);
    console.log(`Ollama check: ${String(ollama.state || "unknown")} (${String(ollama.message || "")})`);
    console.log(`OpenAI backup: ${String(openaiBackup.state || "unknown")} (${String(openaiBackup.message || "")})`);

    if (status === "unhealthy") {
      failures++;
      console.log("FAIL: LLM failover health is unhealthy");
    }
    if (String(ollama.state || "").toLowerCase() === "error") {
      failures++;
      console.log("FAIL: Ollama health check is in error state");
    }
    if (status === "degraded" && String(ollama.state || "").toLowerCase() !== "ok") {
      failures++;
      console.log("FAIL: LLM health is degraded and Ollama is not healthy");
    }
  }

  printHeader("Authenticated runtime diag (/api/agents/_diag)");
  if (!cronSecret) {
    console.log("SKIP: VERIFY_CRON_SECRET or CRON_SECRET not set");
  } else {
    const diag = await fetchJson(`${baseUrl}/api/agents/_diag`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    if (!diag.ok || !diag.body) {
      failures++;
      console.log(`FAIL: GET /api/agents/_diag (${diag.statusCode}) ${diag.error || "no response body"}`);
    } else {
      const ollamaRuntime = (diag.body.ollamaRuntime || {}) as JsonRecord;
      const chat = (diag.body.chat || {}) as JsonRecord;
      const model = typeof chat.model === "string" ? chat.model : null;
      const usedFallback = Boolean(chat.usedFallback);

      console.log(`Ollama runtime enabled: ${String(ollamaRuntime.enabled)}`);
      if (ollamaRuntime.reason) {
        console.log(`Ollama runtime reason: ${String(ollamaRuntime.reason)}`);
      }
      console.log(`Diag chat model: ${model || "unknown"}`);
      console.log(`Diag chat used fallback: ${usedFallback}`);

      if (ollamaRuntime.enabled !== true) {
        failures++;
        console.log("FAIL: Ollama runtime is disabled in production diag");
      }
      if (usedFallback) {
        failures++;
        console.log("FAIL: Diag chat used OpenAI fallback");
      }
      if (classifyModel(model) === "openai") {
        failures++;
        console.log("FAIL: Diag chat model classified as OpenAI");
      }
    }
  }

  printHeader("Admin status mix (/api/agents/status)");
  if (!adminCookie) {
    console.log("SKIP: VERIFY_ADMIN_AUTH_TOKEN not set");
  } else {
    const status = await fetchJson(`${baseUrl}/api/agents/status`, {
      headers: {
        Cookie: `auth_token=${adminCookie}`,
      },
    });

    if (!status.ok || !status.body) {
      failures++;
      console.log(`FAIL: GET /api/agents/status (${status.statusCode}) ${status.error || "no response body"}`);
    } else {
      const system = (status.body.system || {}) as JsonRecord;
      const runtime = (system.llmRuntime || {}) as JsonRecord;
      const localPct = runtime.localPct === null || runtime.localPct === undefined
        ? null
        : Number(runtime.localPct);
      const openaiCount = Number(runtime.openaiCount || 0);
      const total = Number(runtime.total || 0);
      const lastModel = runtime.lastModel ? String(runtime.lastModel) : null;

      console.log(`Hermes mode enabled: ${String(system.hermesModeEnabled)}`);
      console.log(`24h executions: ${total}, OpenAI: ${openaiCount}, Local %: ${localPct === null ? "n/a" : `${localPct}%`}`);
      console.log(`Last model: ${lastModel || "unknown"}`);

      if (system.hermesModeEnabled !== true) {
        failures++;
        console.log("FAIL: Hermes mode is disabled in /api/agents/status");
      }
      if (localPct !== null && localPct < minLocalPct) {
        failures++;
        console.log(`FAIL: Local model ratio ${localPct}% is below target ${minLocalPct}%`);
      }
    }
  }

  printHeader("Result");
  if (failures > 0) {
    console.log(`FAILED with ${failures} issue(s)`);
    process.exitCode = 1;
    return;
  }

  console.log("PASS: agent runtime checks look healthy");
}

main().catch((error) => {
  console.error("[verify-agents-runtime] fatal:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
