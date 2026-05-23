/**
 * Monthly budget reset for all agents.
 *
 * Schedule: 1st of each month at 00:05 UTC.
 * Resets Agent.budgetUsedUsd to 0 for every agent row.
 *
 * Auth:
 *   - Authorization: Bearer $CRON_SECRET, OR
 *   - x-vercel-cron header (Vercel Cron)
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { sendAdminAlert } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.agent.updateMany({
    data: { budgetUsedUsd: 0 },
  });

  await sendAdminAlert({
    title: "🔄 Agent Budgets Reset",
    message: `Monthly budget reset complete. ${result.count} agent(s) reset to $0 used.`,
    severity: "info",
  });

  return NextResponse.json({
    success: true,
    agentsReset: result.count,
    resetAt: new Date().toISOString(),
  });
}
