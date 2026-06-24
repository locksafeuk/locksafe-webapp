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
import { sendAdminAlert } from "@/lib/telegram";
import { verifyCronAuth } from "@/lib/cron-auth";

const AGENTS_ENABLED = process.env.AGENTS_ENABLED === "true";

// ─── Alert deduplication ─────────────────────────────────────────────────────
// Prevents the same error from paging every 5-minute heartbeat cycle.
// Module-level state persists across warm Vercel invocations; a cold start
// resets it (acceptable — one extra alert on restart).
const COOLDOWN_DEFAULT_MS = 30 * 60_000;  // 30 min for general errors
const COOLDOWN_QUOTA_MS   = 60 * 60_000;  // 60 min for billing/quota errors

let lastAlertFingerprint = "";
let lastAlertAt = 0;

function isQuotaError(errors: string[]): boolean {
  return errors.some(e => /429|insufficient_quota|quota|billing/i.test(e));
}

function cleanErrors(errors: string[]): string[] {
  return errors.map(e => {
    // Extract just the OpenAI "message" field from raw JSON blobs
    try {
      const match = e.match(/"message":\s*"([^"]+)"/);
      if (match) {
        const prefix = e.slice(0, e.indexOf("{")).trim();
        return `${prefix} ${match[1]}`.trim();
      }
    } catch { /* ignore */ }
    return e;
  });
}

function shouldAlert(fingerprint: string, quota: boolean): boolean {
  const cooldown = quota ? COOLDOWN_QUOTA_MS : COOLDOWN_DEFAULT_MS;
  const sameError = fingerprint === lastAlertFingerprint;
  const withinCooldown = (Date.now() - lastAlertAt) < cooldown;
  return !(sameError && withinCooldown);
}

function errorFingerprint(errors: string[]): string {
  // Count + first ~80 chars of first error (strips dynamic timestamps/IDs)
  return `${errors.length}:${errors[0]?.slice(0, 80) ?? ""}`;
}

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
    const hasCronAuth = verifyCronAuth(req);

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

    // ── Fallback-only: let the Mac runner (Ollama) own execution ──────────────
    // If a primary agent runner is alive (any agent heart-beated recently), skip
    // this serverless run so agents stay on local Ollama. Only take over when the
    // primary has gone silent. `force:true` in the body bypasses this.
    const FALLBACK_STALE_MIN = Number(process.env.AGENT_HEARTBEAT_FALLBACK_STALE_MINUTES ?? "15");
    if (!forceRun && FALLBACK_STALE_MIN > 0) {
      try {
        const { default: prismaHb } = await import("@/lib/db");
        const newest = await prismaHb.agent.findFirst({
          where: { lastHeartbeat: { not: null } },
          orderBy: { lastHeartbeat: "desc" },
          select: { lastHeartbeat: true },
        });
        const ageMin = newest?.lastHeartbeat
          ? (Date.now() - new Date(newest.lastHeartbeat).getTime()) / 60000
          : Infinity;
        if (ageMin < FALLBACK_STALE_MIN) {
          console.log(`[Heartbeat API] Primary runner alive (${ageMin.toFixed(1)}m ago < ${FALLBACK_STALE_MIN}m) — skipping serverless run; agents stay on local Ollama.`);
          return NextResponse.json({ success: true, skipped: true, reason: "primary-runner-alive", lastHeartbeatAgeMinutes: Math.round(ageMin), timestamp: new Date().toISOString() }, { status: 200 });
        }
      } catch (e) {
        console.warn("[Heartbeat API] fallback staleness check failed, proceeding:", e);
      }
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

    // Alert on actionable errors via Telegram.
    // Paused-agent messages are operationally expected and should not page.
    const actionableErrors = (result.errors || []).filter(
      (e) => !/\bis paused\b/i.test(e),
    );
    if (actionableErrors.length > 0) {
      const quota = isQuotaError(actionableErrors);
      const fingerprint = errorFingerprint(actionableErrors);

      if (shouldAlert(fingerprint, quota)) {
        lastAlertFingerprint = fingerprint;
        lastAlertAt = Date.now();

        const cleaned = cleanErrors(actionableErrors);
        const title = quota
          ? "⚠️ Agent LLM Quota Exhausted"
          : "🚨 Agent Heartbeat Error";
        const suffix = quota
          ? "\n\nAction required: top up OpenAI billing or disable fallback (OPENAI_FALLBACK_ENABLED=false)."
          : "";

        const dedupeKey = quota ? "heartbeat:quota-error" : "heartbeat:agent-error";
        const cooldownMs = quota ? COOLDOWN_QUOTA_MS : COOLDOWN_DEFAULT_MS;
        sendAdminAlert({
          title,
          message: `${cleaned.length} agent(s) failed:\n\n${cleaned.slice(0, 5).join("\n")}${suffix}`,
          severity: quota ? "warning" : "error",
          dedupeKey,
          cooldownMsOverride: cooldownMs,
        }).catch(() => {});
      } else {
        console.log(`[Heartbeat API] Suppressed duplicate alert (fingerprint: ${fingerprint})`);
      }
    } else {
      // Errors cleared — reset fingerprint so next real error always pages
      if (lastAlertFingerprint) {
        lastAlertFingerprint = "";
        lastAlertAt = 0;
      }
      if ((result.errors || []).length > 0) {
        console.log("[Heartbeat API] Suppressed paused-agent heartbeat errors");
      }
    }

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
