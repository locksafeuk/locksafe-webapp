/**
 * Agent Heartbeat API Route
 *
 * Triggers heartbeat for all due agents.
 * Should be called by a cron job every 5 minutes.
 *
 * DISABLED: Set AGENTS_ENABLED=true in .env to enable agents.
 */

import { NextRequest, NextResponse } from "next/server";
import { runAgentHeartbeats, initializeAgentSystem } from "@/agents";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET;
const AGENTS_ENABLED = process.env.AGENTS_ENABLED === "true";

export async function POST(req: NextRequest) {
  try {
    // Check if agents are enabled
    if (!AGENTS_ENABLED) {
      console.log("[Heartbeat API] Agents are DISABLED. Set AGENTS_ENABLED=true in .env to enable.");
      return NextResponse.json({
        success: false,
        message: "Agents are disabled. Set AGENTS_ENABLED=true in .env to enable.",
        disabled: true,
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }
    // Verify authorization - allow cron secret OR admin session
    const authHeader = req.headers.get("authorization");
    const hasCronAuth = !CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`;

    // Check admin authentication from request cookies (same approach as /api/admin/auth)
    let hasAdminAuth = false;
    let adminEmail: string | undefined;
    const token = req.cookies.get("auth_token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload?.type === "admin") {
        hasAdminAuth = true;
        adminEmail = payload.email;
      }
    }

    console.log("[Heartbeat API] Auth check:", {
      hasCronAuth,
      hasAdminAuth,
      hasCronSecret: !!CRON_SECRET,
      adminEmail,
      hasToken: !!token,
    });

    if (!hasCronAuth && !hasAdminAuth) {
      return NextResponse.json(
        { error: "Unauthorized", details: "Admin authentication required" },
        { status: 401 }
      );
    }

    // Check for force flag in request body
    let forceRun = false;
    try {
      const body = await req.json();
      forceRun = body?.force === true;
    } catch {
      // No body or invalid JSON, continue without force
    }

    // Initialize system if needed (first run)
    await initializeAgentSystem();

    // If force flag is set, reset nextHeartbeat for all active agents
    if (forceRun) {
      await prisma.agent.updateMany({
        where: { status: "active", heartbeatEnabled: true },
        data: { nextHeartbeat: null },
      });
      console.log("[Heartbeat API] Force flag set - reset nextHeartbeat for all agents");
    }

    // Run heartbeats
    const result = await runAgentHeartbeats();

    return NextResponse.json({
      success: result.success,
      message: `Heartbeat completed for ${result.agentsRun} agents`,
      stats: {
        agentsRun: result.agentsRun,
        totalActions: result.totalActions,
        totalCost: result.totalCost,
      },
      results: result.results,
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Heartbeat API] Error:", error);
    return NextResponse.json(
      {
        error: "Heartbeat failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}
