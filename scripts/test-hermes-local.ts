/**
 * Hermes Local Integration Test
 *
 * Validates that the local Hermes agent stack is reachable and responding.
 * This script intentionally has NO OpenAI fallback — if Ollama is down it
 * fails loudly so production issues are immediately visible.
 *
 * Usage (from locksafe-webapp/):
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-hermes-local.ts
 *
 * Required env (auto-loaded from .env.local):
 *   OLLAMA_BASE_URL   — defaults to http://localhost:11434
 *   OLLAMA_MODEL_HERMES — defaults to hermes-4:70b
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

// llm-router reads OLLAMA_MODEL_HERMES at module-load time via modelFromEnv(),
// so we must set the env var from the pre-flight BEFORE importing the module.
// Use a lazy dynamic import inside runHermesTest() after preflight() completes.

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function ok(msg: string): void {
  console.log(`  PASS  ${msg}`);
}

function fail(msg: string): void {
  console.log(`  FAIL  ${msg}`);
}

function info(msg: string): void {
  console.log(`        ${msg}`);
}

// ─── Pre-flight: confirm Ollama is reachable and has a Hermes model ───────────

async function preflight(): Promise<string> {
  section("PRE-FLIGHT");
  info(`Ollama base URL: ${OLLAMA_BASE_URL}`);

  let models: string[] = [];
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as { models: Array<{ name: string }> };
    models = (data.models ?? []).map((m) => m.name);
  } catch (err) {
    fail(`Ollama not reachable at ${OLLAMA_BASE_URL}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  ok(`Ollama reachable — ${models.length} model(s) loaded`);

  const hermesModel =
    models.find((n) => n.startsWith("hermes-4:")) ??
    models.find((n) => n.startsWith("hermes3:")) ??
    models.find((n) => n.toLowerCase().includes("hermes"));

  const envOverride = process.env.OLLAMA_MODEL_HERMES;

  if (hermesModel) {
    ok(`Hermes model found : ${hermesModel}`);
    if (!envOverride) {
      process.env.OLLAMA_MODEL_HERMES = hermesModel;
    }
  } else {
    info(`No Hermes model found in Ollama. Available: ${models.slice(0, 6).join(", ")}${models.length > 6 ? "…" : ""}`);
    info(`Will attempt with OLLAMA_MODEL_HERMES=${envOverride ?? "hermes-4:70b (default)"}`);
  }

  const effectiveModel = process.env.OLLAMA_MODEL_HERMES ?? "hermes-4:70b";
  info(`Effective model    : ${effectiveModel}`);

  // Check which model is currently hot in VRAM.
  // If a different model is loaded, Ollama must swap it out — this can take 2–5 min for large models.
  try {
    const psRes = await fetch(`${OLLAMA_BASE_URL}/api/ps`, { signal: AbortSignal.timeout(5_000) });
    if (psRes.ok) {
      const psData = (await psRes.json()) as { models?: Array<{ name: string; size_vram?: number }> };
      const hot = psData.models ?? [];
      if (hot.length === 0) {
        info(`Hot in VRAM        : none (clean swap — Hermes will load fresh)`);
      } else {
        const hotNames = hot.map((m) => `${m.name} (${m.size_vram ? Math.round(m.size_vram / 1e9) + "GB" : "?"} VRAM)`);
        const hermesIsHot = hot.some((m) => m.name === effectiveModel);
        if (hermesIsHot) {
          ok(`Hot in VRAM        : ${hotNames.join(", ")} — Hermes is already loaded, fast response expected`);
        } else {
          info(`Hot in VRAM        : ${hotNames.join(", ")}`);
          console.log();
          console.log(`  ⚠  WARNING: The target model (${effectiveModel}) is NOT currently loaded in VRAM.`);
          console.log(`     Ollama must unload ${hotNames.join(", ")} and load Hermes before responding.`);
          console.log(`     This model swap can take 3–10 minutes for large models.`);
          console.log(`     The test will wait up to 300s — re-run once Hermes is warm for a faster result.`);
          console.log();
        }
      }
    }
  } catch {
    // /api/ps is informational only
  }

  return effectiveModel;
}

// ─── Main test ─────────────────────────────────────────────────────────────────

async function runHermesTest(): Promise<void> {
  const effectiveModel = await preflight();

  section("HERMES CHAT");
  info("Sending prompt to local Hermes agent…");
  info(`Timeout: 300s | allowOpenAIFallback: false`);

  const startMs = Date.now();
  const { chat, Models } = await import("../src/lib/llm-router");

  let response: Awaited<ReturnType<typeof chat>>;

  try {
    response = await chat(
      Models.HERMES,
      [
        {
          role: "system",
          content:
            "You are the COO agent for Locksafe, a UK locksmith dispatch platform. " +
            "Your role is to monitor platform health, flag operational risks, and recommend actions. " +
            "Respond concisely and professionally.",
        },
        {
          role: "user",
          content:
            "Provide a brief platform health summary. Cover: job dispatch readiness, " +
            "any operational risks to monitor today, and one recommended action to keep " +
            "the platform running smoothly. Keep it under 150 words.",
        },
      ],
      {
        temperature: 0.3,
        timeoutMs: 300_000,
        allowOpenAIFallback: false,
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isModelSwapTimeout =
      msg.includes("OpenAI fallback is disabled") ||
      msg.toLowerCase().includes("aborted") ||
      msg.toLowerCase().includes("timeout");
    section("RESULT");
    fail(`Hermes chat failed: ${msg}`);
    if (isModelSwapTimeout) {
      info("Likely cause: Ollama is still swapping the model into VRAM (>300s).");
      info("Wait for the current model to unload, then re-run this script.");
      info(`You can monitor with: curl ${OLLAMA_BASE_URL}/api/ps`);
    } else {
      info("Check that Ollama is running and the Hermes model is pulled.");
      info(`  ollama pull ${effectiveModel}`);
    }
    process.exitCode = 1;
    return;
  }

  const durationMs = Date.now() - startMs;

  section("HERMES RESPONSE");
  console.log();
  console.log(response.content);
  console.log();

  section("DIAGNOSTICS");
  info(`Model         : ${response.model}`);
  info(`Duration      : ${durationMs}ms`);
  info(`Prompt tokens : ${response.promptTokens ?? "n/a"}`);
  info(`Output tokens : ${response.completionTokens ?? "n/a"}`);
  info(`Used fallback : ${response.usedFallback}`);

  section("RESULT");

  if (response.usedFallback) {
    fail("Response was served by the OpenAI fallback, not local Hermes.");
    info("The local Ollama model may be unavailable or the circuit breaker is open.");
    process.exitCode = 1;
    return;
  }

  if (!response.content || response.content.trim().length === 0) {
    fail("Hermes returned an empty response.");
    process.exitCode = 1;
    return;
  }

  ok(`Local Hermes agent responded successfully via model: ${response.model}`);
}

runHermesTest().catch((err) => {
  section("RESULT");
  fail(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
