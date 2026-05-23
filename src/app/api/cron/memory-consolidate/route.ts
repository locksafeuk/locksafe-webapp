/**
 * Cron: weekly memory consolidation.
 *
 * For each active agent, summarise recent short-term memories into a small
 * number of strategic lessons that get promoted to `type="long"`. The original
 * short-term rows are then soft-expired (90d TTL) so they age out instead of
 * disappearing immediately — keeps the audit trail intact.
 *
 * Scheduled Sunday 06:00 UTC via vercel.json so it runs ahead of the Monday
 * heartbeats (Opportunity Scout at 04:00 UTC the next morning will see the
 * consolidated memories... wait — Monday 04:00 is BEFORE Sunday's 06:00 finishes
 * processing? No: 06:00 Sunday is 22h before 04:00 Monday. We're fine.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import { chat } from "@/lib/llm-router";


const SYSTEM_PROMPT = `You are the memory consolidator for an autonomous agent at LockSafe UK.
Read a list of short-term agent memories and distil them into the MINIMUM set of strategic lessons.

Output STRICT JSON only:
{
  "lessons": [
    { "content": "imperative lesson sentence", "importance": 0.6-0.95 }
  ]
}

Rules:
- Maximum 5 lessons.
- Each lesson MUST be a concrete imperative ("Boost X for Y", "Avoid Z when...").
- Importance: 0.95 for repeatedly-confirmed cross-cutting lessons, 0.6 for one-off observations.
- Deduplicate aggressively. If two memories say the same thing, merge them.
- No emojis, no markdown, no preamble.`;

interface ConsolidatedLesson {
  content: string;
  importance: number;
}

interface AgentCounters {
  agentName: string;
  shortTermSeen: number;
  lessonsCreated: number;
  consolidated: number;
  error?: string;
}

async function consolidateForAgent(agentId: string, agentName: string): Promise<AgentCounters> {
  const counters: AgentCounters = {
    agentName,
    shortTermSeen: 0,
    lessonsCreated: 0,
    consolidated: 0,
  };

  // Pull recent short-term memories that have been re-accessed (≥2) so we focus
  // on stuff that's actually been useful.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const shortTerm = await prisma.agentMemory.findMany({
    where: {
      agentId,
      type: "short",
      lastAccessedAt: { gte: cutoff },
      accessCount: { gte: 2 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ importance: "desc" }, { lastAccessedAt: "desc" }],
    take: 50,
  });

  counters.shortTermSeen = shortTerm.length;
  if (shortTerm.length < 3) return counters;

  const userPrompt = `Agent: ${agentName}
Memories (newest first):
${shortTerm.map((m, i) => `${i + 1}. [${m.category}|imp ${m.importance.toFixed(2)}|seen ${m.accessCount}×] ${m.content}`).join("\n")}

Produce the consolidated lessons JSON now.`;

  let lessons: ConsolidatedLesson[] = [];
  try {
    const resp = await chat(
      "REASONING",
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.3,
        responseFormat: "json",
        timeoutMs: 90_000,
        allowOpenAIFallback: true,
        fallbackSeverity: "medium",
      },
    );

    const parsed = JSON.parse(resp.content);
    if (Array.isArray(parsed.lessons)) {
      lessons = parsed.lessons
        .filter(
          (l: unknown): l is ConsolidatedLesson =>
            !!l &&
            typeof (l as ConsolidatedLesson).content === "string" &&
            typeof (l as ConsolidatedLesson).importance === "number",
        )
        .slice(0, 5);
    }
  } catch (err) {
    counters.error = err instanceof Error ? err.message : String(err);
    return counters;
  }

  // Persist consolidated lessons as long-term memories.
  for (const lesson of lessons) {
    await prisma.agentMemory.create({
      data: {
        agentId,
        type: "long",
        category: "pattern",
        content: lesson.content,
        importance: Math.min(0.95, Math.max(0.5, lesson.importance)),
        metadata: JSON.stringify({
          scope: "shared",
          strategicCategory: "strategic",
          source: "memory-consolidation",
          consolidatedFrom: shortTerm.length,
          tags: ["consolidated", "strategic"],
        }),
      },
    });
    counters.lessonsCreated++;
  }

  // Soft-expire the consolidated short-term rows so they age out naturally.
  const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const expired = await prisma.agentMemory.updateMany({
    where: {
      id: { in: shortTerm.map((m) => m.id) },
      expiresAt: null,
    },
    data: { expiresAt: ninetyDays },
  });
  counters.consolidated = expired.count;

  return counters;
}

async function run(request: NextRequest) {
  const startTime = Date.now();
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    where: { heartbeatEnabled: true },
    select: { id: true, name: true },
  });

  const results: AgentCounters[] = [];
  for (const a of agents) {
    try {
      results.push(await consolidateForAgent(a.id, a.name));
    } catch (err) {
      results.push({
        agentName: a.name,
        shortTermSeen: 0,
        lessonsCreated: 0,
        consolidated: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    durationMs: Date.now() - startTime,
    agentsProcessed: results.length,
    totalLessonsCreated: results.reduce((a, r) => a + r.lessonsCreated, 0),
    results,
  });
}

export const POST = run;
export const GET = run;
