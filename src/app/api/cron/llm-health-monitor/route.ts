/**
 * /api/cron/llm-health-monitor — watchdog for the LLM layer (Ollama + fallback).
 *
 * The circuit breaker already pings once when Ollama trips, but a single alert
 * is easy to miss — which is how a ~22h outage went unnoticed. This runs on a
 * schedule and, while the LLM layer is anything other than healthy, sends a
 * deduped Telegram alert at most once every 2h, so a sustained outage keeps
 * nagging until it's fixed. Silent when everything's healthy.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runLLMFailoverHealthCheck } from "@/lib/llm-failover-health";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await runLLMFailoverHealthCheck();

  if (health.status !== "healthy") {
    const o = health.checks.ollama;
    const b = health.checks.openaiBackup;
    const unhealthy = health.status === "unhealthy";
    await sendAdminAlert({
      title: unhealthy ? "🛑 LLM layer UNHEALTHY" : "⚠️ LLM degraded — Ollama unreachable",
      message:
        `Ollama: ${o.state}${o.message ? ` — ${o.message}` : ""}\n` +
        `OpenAI backup: ${b.state}${b.message ? ` — ${b.message}` : ""}\n` +
        `Endpoint: ${health.config.ollamaBaseUrl}\n\n` +
        (unhealthy
          ? "No working LLM path — agents, content + the WhatsApp bot are failing. Fix now: run infra/ollama/setup.sh on the Mac Studio, or check the OpenAI fallback."
          : "Running on the PAID OpenAI fallback. Bring the Mac Studio's proxy + funnel back: run infra/ollama/setup.sh."),
      severity: unhealthy ? "error" : "warning",
      dedupeKey: `llm-health:${health.status}`,
      cooldownMsOverride: 2 * 60 * 60 * 1000, // at most once every 2h while down
    }).catch(() => {});
  }

  return NextResponse.json({
    status: health.status,
    ollama: health.checks.ollama.state,
    openaiBackup: health.checks.openaiBackup.state,
    ollamaBaseUrl: health.config.ollamaBaseUrl,
  });
}
