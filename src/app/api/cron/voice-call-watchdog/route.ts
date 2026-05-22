import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendAdminAlert } from "@/lib/telegram";

const CRON_SECRET = process.env.CRON_SECRET || "your-cron-secret-key";

const STALE_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.VOICE_CALL_WATCHDOG_STALE_MINUTES || "3", 10) || 3,
);
const ALERT_COOLDOWN_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.VOICE_CALL_WATCHDOG_ALERT_COOLDOWN_MINUTES || "15", 10) || 15,
);
const LOOKBACK_HOURS = Math.max(
  1,
  Number.parseInt(process.env.VOICE_CALL_WATCHDOG_LOOKBACK_HOURS || "12", 10) || 12,
);

function redactPhone(phone?: string | null): string {
  if (!phone) return "unknown";
  const clean = phone.replace(/\s+/g, "");
  if (clean.length <= 4) return clean;
  return `${"*".repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const vercelCron = request.headers.get("x-vercel-cron");

  if (token !== CRON_SECRET && !vercelCron) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_MINUTES * 60_000);
  const lookbackCutoff = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60_000);

  try {
    const staleCalls = await prisma.voiceCall.findMany({
      where: {
        callStatus: "in_progress",
        startedAt: {
          lte: staleCutoff,
          gte: lookbackCutoff,
        },
      },
      select: {
        id: true,
        retellCallId: true,
        callerPhone: true,
        startedAt: true,
        outcomeDetails: true,
      },
      orderBy: { startedAt: "asc" },
      take: 100,
    });

    let checked = 0;
    let alerted = 0;
    let skippedCooldown = 0;
    let failedToAlert = 0;

    for (const call of staleCalls) {
      checked += 1;

      const durationMinutes = Math.max(
        1,
        Math.floor((now.getTime() - call.startedAt.getTime()) / 60_000),
      );

      const outcomeDetails = asObject(call.outcomeDetails);
      const watchdog = asObject(outcomeDetails.watchdog);
      const lastInProgressAlertAtRaw = watchdog.lastInProgressAlertAt;
      const lastInProgressAlertAt =
        typeof lastInProgressAlertAtRaw === "string" ? new Date(lastInProgressAlertAtRaw) : null;

      if (
        lastInProgressAlertAt &&
        now.getTime() - lastInProgressAlertAt.getTime() < ALERT_COOLDOWN_MINUTES * 60_000
      ) {
        skippedCooldown += 1;
        continue;
      }

      const sent = await sendAdminAlert({
        title: "Voice AI call stuck in progress",
        message:
          `Retell call ${call.retellCallId} has been in-progress for ${durationMinutes}m ` +
          `(caller ${redactPhone(call.callerPhone)}). ` +
          `Expected call_ended webhook may be missing or delayed.`,
        severity: "error",
        bypassPolicyGate: true,
      });

      if (!sent) {
        failedToAlert += 1;
        continue;
      }

      const currentAlertCount =
        typeof watchdog.alertCount === "number" && Number.isFinite(watchdog.alertCount)
          ? watchdog.alertCount
          : 0;

      const nextOutcomeDetails = {
        ...outcomeDetails,
        watchdog: {
          ...watchdog,
          lastInProgressAlertAt: now.toISOString(),
          alertCount: currentAlertCount + 1,
          staleDurationMinutes: durationMinutes,
        },
      };

      await prisma.voiceCall.update({
        where: { id: call.id },
        data: {
          flaggedForReview: true,
          outcomeDetails: nextOutcomeDetails,
        },
      });

      alerted += 1;
    }

    return NextResponse.json({
      success: true,
      checked,
      staleCalls: staleCalls.length,
      alerted,
      skippedCooldown,
      failedToAlert,
      config: {
        staleMinutes: STALE_MINUTES,
        cooldownMinutes: ALERT_COOLDOWN_MINUTES,
        lookbackHours: LOOKBACK_HOURS,
      },
    });
  } catch (error) {
    console.error("[voice-call-watchdog] cron failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
