/**
 * /api/cron/messaging-health-monitor — watchdog for the outbound messaging layer.
 *
 * WhatsApp is our primary onboarding channel, yet a run of Twilio Error 63016
 * ("outside the 24h window — use a template") failed silently because nothing
 * watched delivery. This scans recent sends + provider readiness and, while
 * anything is broken, nags a deduped Telegram alert at most once every 2h so a
 * sustained messaging outage can't go unnoticed again. Silent when healthy.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runMessagingHealthCheck } from "@/lib/messaging-health";
import { sendAdminAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await runMessagingHealthCheck();

  if (health.status !== "healthy") {
    const unhealthy = health.status === "unhealthy";
    const t = health.twilio;
    const codeLines = t.byErrorCode
      .slice(0, 5)
      .map((e) => `   • ${e.code} ×${e.count} — ${e.hint}`)
      .join("\n");

    await sendAdminAlert({
      title: unhealthy ? "🛑 Messaging BROKEN (WhatsApp/SMS)" : "⚠️ Messaging degraded",
      message:
        `Provider: ${health.provider}\n` +
        `Delivery (last ${t.windowHours}h): ${t.failed} failed / ${t.delivered} delivered\n` +
        (codeLines ? `Top errors:\n${codeLines}\n` : "") +
        (health.whatsappTemplates.state !== "ok"
          ? `Templates: ${health.whatsappTemplates.message}\n`
          : "") +
        `\n${
          unhealthy
            ? "A real delivery break (systemic errors or high failure rate). Check the template/provider/sender, then re-check."
            : "Some sends are failing. If these are invalid/landline numbers it's lead-list data quality, not an outage — clean the list."
        }`,
      severity: unhealthy ? "error" : "warning",
      dedupeKey: `messaging-health:${health.status}`,
      cooldownMsOverride: 2 * 60 * 60 * 1000, // at most once every 2h while broken
    }).catch(() => {});
  }

  return NextResponse.json({
    status: health.status,
    provider: health.provider,
    twilio: {
      failed: health.twilio.failed,
      delivered: health.twilio.delivered,
      byErrorCode: health.twilio.byErrorCode,
    },
    whatsappTemplates: {
      state: health.whatsappTemplates.state,
      missing: health.whatsappTemplates.missing,
    },
  });
}
