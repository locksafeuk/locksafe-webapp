import { NextRequest, NextResponse } from "next/server";
import { chat, Models } from "@/lib/llm-router";
import { getOllamaRuntimeDecision } from "@/lib/ollama-runtime";

/**
 * GET /api/agents/_diag
 *
 * Authenticated diagnostic endpoint that proves Hermes/Ollama (and the
 * OpenAI fallback) are reachable from the Vercel runtime. Returns a
 * redacted env summary plus the result of a real LLM ping.
 */

const CRON_SECRET = process.env.CRON_SECRET;

function envInfo(name: string) {
  const v = process.env[name];
  if (v === undefined) return { name, set: false };
  if (v === "") return { name, set: true, empty: true };
  return {
    name,
    set: true,
    length: v.length,
    prefix: v.length > 12 ? v.slice(0, 8) + "…" : v,
  };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!CRON_SECRET || (auth !== `Bearer ${CRON_SECRET}` && !isVercelCron)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const out: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    runtime: {
      node: process.version,
      region: process.env.VERCEL_REGION ?? null,
      env: process.env.VERCEL_ENV ?? null,
    },
    envs: [
      envInfo("AGENTS_ENABLED"),
      envInfo("OLLAMA_BASE_URL"),
      envInfo("OLLAMA_SECRET"),
      envInfo("OPENAI_API_KEY"),
      envInfo("OPENAI_FALLBACK_ENABLED"),
      envInfo("CRON_SECRET"),
    ],
  };
  const ollamaRuntime = getOllamaRuntimeDecision();
  out.ollamaRuntime = ollamaRuntime;

  // 1. Raw reachability check — hit /api/tags on the configured Ollama URL
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  out.ollamaUrl = ollamaUrl;
  if (!ollamaRuntime.enabled) {
    out.tagsSkipped = ollamaRuntime.reason;
  } else {
    try {
      const tagsRes = await fetch(`${ollamaUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
      });
      out.tagsHttp = tagsRes.status;
      if (tagsRes.ok) {
        const tags = (await tagsRes.json()) as { models?: Array<{ name: string }> };
        out.modelsAvailable = tags.models?.map((m) => m.name) ?? [];
      } else {
        out.tagsError = await tagsRes.text().catch(() => "<no body>");
      }
    } catch (e) {
      out.tagsError = e instanceof Error ? e.message : String(e);
    }
  }

  // 2. Real chat call via the router (Hermes-first, OpenAI fallback allowed)
  try {
    const t0 = Date.now();
    const resp = await chat(
      Models.HERMES,
      [{ role: "user", content: 'Reply with exactly the word "PONG" and nothing else.' }],
      {
        temperature: 0,
        maxTokens: 8,
        timeoutMs: 30_000,
        allowOpenAIFallback: true,
        fallbackSeverity: "critical",
      },
    );
    out.chat = {
      ok: true,
      durationMs: Date.now() - t0,
      usedFallback: resp.usedFallback,
      model: resp.model,
      content: (resp.content || "").slice(0, 80),
    };
  } catch (e) {
    out.chat = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json(out);
}
