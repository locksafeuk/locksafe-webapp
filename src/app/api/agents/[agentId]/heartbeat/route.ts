/**
 * Single Agent Heartbeat API Route
 *
 * Triggers heartbeat for a specific agent.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { runCEOHeartbeat } from "@/agents/ceo/agent";
import { runCOOHeartbeat } from "@/agents/coo/agent";
import { runCMOHeartbeat } from "@/agents/cmo/agent";
import { runCTOHeartbeat } from "@/agents/cto/agent";
import { runCopywriterHeartbeat } from "@/agents/cmo/subagents/copywriter/agent";
import { runAdsSpecialistHeartbeat } from "@/agents/cmo/subagents/ads-specialist/agent";

async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return false;

    const payload = await verifyToken(token);
    return payload?.type === "admin";
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    // Verify admin auth
    const hasAdminAuth = await isAdminAuthenticated();
    if (!hasAdminAuth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { agentId } = await params;

    // Get agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Run the appropriate heartbeat based on agent name
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | null = null;

    try {
      switch (agent.name) {
        case "ceo":
          await runCEOHeartbeat();
          break;
        case "cto":
          await runCTOHeartbeat();
          break;
        case "coo":
          await runCOOHeartbeat();
          break;
        case "cmo":
          await runCMOHeartbeat();
          break;
        case "copywriter":
          await runCopywriterHeartbeat();
          break;
        case "ads-specialist":
          await runAdsSpecialistHeartbeat();
          break;
        default:
          return NextResponse.json(
            { error: `Unknown agent: ${agent.name}` },
            { status: 400 }
          );
      }
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : "Unknown error";
    }

    const duration = Date.now() - startTime;

    // Update agent last heartbeat
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        lastHeartbeat: new Date(),
      },
    });

    return NextResponse.json({
      success,
      agentName: agent.displayName,
      duration,
      errorMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Single Agent Heartbeat] Error:", error);
    return NextResponse.json(
      {
        error: "Heartbeat failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
