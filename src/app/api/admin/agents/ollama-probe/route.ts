/**
 * Admin: Probe Ollama connectivity from Vercel and optionally reset the circuit breaker.
 * GET  — probe only, returns { reachable, latencyMs, models? }
 * POST — probe + inject circuit-recovered marker if healthy
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_SECRET = process.env.OLLAMA_SECRET;

const ROUTER_CIRCUIT_SHARED_AGENT = "system-alerts";
const ROUTER_CIRCUIT_SHARED_PLATFORM = "global";
const ROUTER_CIRCUIT_OPEN_ACTION = "llm-router:circuit-open";
const ROUTER_CIRCUIT_RECOVERED_ACTION = "llm-router:circuit-recovered";

async function adminAuth(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token");
  if (!token) return false;
  const payload = await verifyToken(token.value);
  return payload?.type === "admin";
}

async function probe(): Promise<{ reachable: boolean; latencyMs: number; models?: string[] }> {
  const headers: Record<string, string> = {};
  if (OLLAMA_SECRET) headers["X-Ollama-Secret"] = OLLAMA_SECRET;

  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { headers, signal: ctrl.signal });
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    if (!res.ok) return { reachable: false, latencyMs };
    const json = await res.json() as { models?: Array<{ name: string }> };
    const models = json.models?.map((m) => m.name) ?? [];
    return { reachable: true, latencyMs, models };
  } catch {
    return { reachable: false, latencyMs: Date.now() - start };
  }
}

async function circuitState() {
  const marker = await prisma.agentDecision.findFirst({
    where: {
      agent: ROUTER_CIRCUIT_SHARED_AGENT,
      platform: ROUTER_CIRCUIT_SHARED_PLATFORM,
      action: { in: [ROUTER_CIRCUIT_OPEN_ACTION, ROUTER_CIRCUIT_RECOVERED_ACTION] },
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, createdAt: true },
  });
  return marker;
}

export async function GET(request: NextRequest) {
  if (!(await adminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [probeResult, marker] = await Promise.all([probe(), circuitState()]);
  return NextResponse.json({
    ollamaBaseUrl: OLLAMA_BASE_URL,
    probe: probeResult,
    circuitMarker: marker
      ? { action: marker.action, age: `${Math.round((Date.now() - marker.createdAt.getTime()) / 1000)}s ago` }
      : null,
  });
}

export async function POST(request: NextRequest) {
  if (!(await adminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const probeResult = await probe();

  if (probeResult.reachable) {
    // Write a recovery marker so all Vercel instances close the circuit
    await prisma.agentDecision.create({
      data: {
        agent: ROUTER_CIRCUIT_SHARED_AGENT,
        platform: ROUTER_CIRCUIT_SHARED_PLATFORM,
        action: ROUTER_CIRCUIT_RECOVERED_ACTION,
        payload: { model: "admin-probe", error: null, circuitResetMs: 1_800_000 },
        policySnapshot: { source: "admin-ollama-probe" },
        dryRun: false,
        outcome: "ok",
      },
    });
    return NextResponse.json({
      ollamaBaseUrl: OLLAMA_BASE_URL,
      probe: probeResult,
      circuitReset: true,
      message: "Ollama is reachable — circuit breaker recovery marker written. Agents will route locally.",
    });
  }

  return NextResponse.json({
    ollamaBaseUrl: OLLAMA_BASE_URL,
    probe: probeResult,
    circuitReset: false,
    message: "Ollama probe failed — circuit breaker left open. Check Tailscale Funnel and Ollama service.",
  });
}
