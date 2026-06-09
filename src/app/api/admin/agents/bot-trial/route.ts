/**
 * /api/admin/agents/bot-trial — safe trial harness for the agentic WhatsApp bot.
 *
 * Runs the REAL bot brain (handleLocksmithAIChat on qwen3:32b + tools) against a
 * real locksmith's live data, but in DRY-RUN mode: read tools execute for real,
 * mutating tools (accept/decline/availability) only REPORT what they would do —
 * nothing is changed, and NO WhatsApp message is sent.
 *
 *   GET  ?candidates=8   → a few locksmiths to pick from (id, name, status)
 *   POST { locksmithId, message, history? } → { reply, trace }
 *
 * Multi-turn: pass the running [{role,content}] history back on each POST.
 * Auth: admin JWT cookie (same as the rest of /api/admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { handleLocksmithAIChat } from "@/lib/locksmith-whatsapp-adapter";
import { handleCustomerLockie } from "@/lib/customer-lockie";
import type { LLMMessage } from "@/lib/llm-router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const n = Math.min(Number(request.nextUrl.searchParams.get("candidates") ?? 8) || 8, 25);
  const persona = request.nextUrl.searchParams.get("persona") === "customer" ? "customer" : "locksmith";

  if (persona === "customer") {
    const customers = await prisma.customer.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { updatedAt: "desc" },
      take: n,
    });
    return NextResponse.json({ persona, count: customers.length, customers });
  }

  const locksmiths = await prisma.locksmith.findMany({
    where: { isActive: true },
    select: { id: true, name: true, companyName: true, isActive: true, isAvailable: true },
    orderBy: { updatedAt: "desc" },
    take: n,
  });
  return NextResponse.json({ persona, count: locksmiths.length, locksmiths });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    persona?: "locksmith" | "customer";
    locksmithId?: string;
    phone?: string;
    message?: string;
    history?: Array<{ role?: string; content?: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const persona = body.persona === "customer" ? "customer" : "locksmith";
  const message = body.message;
  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Only carry forward clean user/assistant turns into the model context.
  const historyOverride: LLMMessage[] = (body.history ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) }));

  const trace: string[] = [];
  const startedAt = Date.now();

  if (persona === "customer") {
    const phone = body.phone?.trim();
    if (!phone) {
      return NextResponse.json({ error: "phone is required for customer trials" }, { status: 400 });
    }
    const reply = await handleCustomerLockie(phone, message.trim(), {
      dryRun: true,
      historyOverride,
      traceSink: trace,
    });
    return NextResponse.json({
      dryRun: true,
      persona,
      phone,
      reply: reply ?? "(model returned nothing — Ollama may be unreachable)",
      toolCalls: trace,
      latencyMs: Date.now() - startedAt,
    });
  }

  const { locksmithId } = body;
  if (!locksmithId) {
    return NextResponse.json({ error: "locksmithId is required" }, { status: 400 });
  }
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    select: { id: true, name: true, phone: true },
  });
  if (!locksmith) {
    return NextResponse.json({ error: "Locksmith not found" }, { status: 404 });
  }

  const reply = await handleLocksmithAIChat(
    locksmith.id,
    locksmith.name,
    `trial:${locksmith.id}`, // synthetic phone — never persisted, never messaged
    message.trim(),
    { dryRun: true, historyOverride, traceSink: trace },
  );

  return NextResponse.json({
    dryRun: true,
    persona,
    locksmith: { id: locksmith.id, name: locksmith.name },
    reply: reply ?? "(model returned nothing — Ollama may be unreachable)",
    toolCalls: trace,
    latencyMs: Date.now() - startedAt,
  });
}
