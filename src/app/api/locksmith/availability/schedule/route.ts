import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Per-day schedule shape: { mon: { enabled: true, start: "08:00", end: "18:00" }, ... }
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export interface DaySchedule { enabled: boolean; start: string; end: string }
export type WeeklySchedule = Record<DayKey, DaySchedule>;

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const DEFAULT_WEEKLY: WeeklySchedule = {
  mon: { enabled: true,  start: "08:00", end: "18:00" },
  tue: { enabled: true,  start: "08:00", end: "18:00" },
  wed: { enabled: true,  start: "08:00", end: "18:00" },
  thu: { enabled: true,  start: "08:00", end: "18:00" },
  fri: { enabled: true,  start: "08:00", end: "18:00" },
  sat: { enabled: false, start: "09:00", end: "14:00" },
  sun: { enabled: false, start: "09:00", end: "14:00" },
};

function validateWeekly(weekly: unknown): WeeklySchedule | null {
  if (typeof weekly !== "object" || weekly === null) return null;
  const result = {} as WeeklySchedule;
  for (const key of DAY_KEYS) {
    const day = (weekly as Record<string, unknown>)[key];
    if (typeof day !== "object" || day === null) return null;
    const { enabled, start, end } = day as Record<string, unknown>;
    if (typeof enabled !== "boolean") return null;
    if (typeof start !== "string" || !TIME_RE.test(start)) return null;
    if (typeof end !== "string" || !TIME_RE.test(end)) return null;
    result[key] = { enabled, start, end };
  }
  return result;
}

// GET - Fetch locksmith availability schedule
export async function GET(request: NextRequest) {
  try {
    const locksmithId = new URL(request.url).searchParams.get("locksmithId");
    if (!locksmithId) {
      return NextResponse.json({ success: false, error: "locksmithId required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locksmith = await (prisma.locksmith as any).findUnique({
      where: { id: locksmithId },
      select: {
        id: true,
        isAvailable: true,
        scheduleEnabled: true,
        scheduleOverridden: true,
        scheduleWeekly: true,
        scheduleTimezone: true,
      },
    }) as { id: string; isAvailable: boolean; scheduleEnabled: boolean; scheduleOverridden: boolean; scheduleWeekly: WeeklySchedule | null; scheduleTimezone: string | null } | null;

    if (!locksmith) {
      return NextResponse.json({ success: false, error: "Locksmith not found" }, { status: 404 });
    }

    const weekly = (locksmith.scheduleWeekly as WeeklySchedule | null) ?? DEFAULT_WEEKLY;

    return NextResponse.json({
      success: true,
      isAvailable: locksmith.isAvailable,
      schedule: {
        enabled: locksmith.scheduleEnabled,
        overridden: locksmith.scheduleOverridden,
        timezone: locksmith.scheduleTimezone ?? "Europe/London",
        weekly,
      },
    });
  } catch (error) {
    console.error("[schedule GET]", error);
    return NextResponse.json({ success: false, error: "Failed to fetch schedule" }, { status: 500 });
  }
}

// POST - Save locksmith availability schedule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locksmithId, enabled, weekly } = body as {
      locksmithId: string;
      enabled: boolean;
      weekly: unknown;
    };

    if (!locksmithId) {
      return NextResponse.json({ success: false, error: "locksmithId required" }, { status: 400 });
    }

    const validWeekly = validateWeekly(weekly);
    if (!validWeekly) {
      return NextResponse.json(
        { success: false, error: "Invalid weekly schedule format. Provide { mon..sun: { enabled, start HH:MM, end HH:MM } }" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma.locksmith as any).update({
      where: { id: locksmithId },
      data: {
        scheduleEnabled: enabled ?? false,
        scheduleWeekly: validWeekly as object,
        // Clear override when locksmith saves a new schedule — fresh start
        scheduleOverridden: false,
      },
      select: {
        id: true,
        scheduleEnabled: true,
        scheduleOverridden: true,
        scheduleWeekly: true,
        scheduleTimezone: true,
      },
    }) as { id: string; scheduleEnabled: boolean; scheduleOverridden: boolean; scheduleWeekly: WeeklySchedule; scheduleTimezone: string | null };

    return NextResponse.json({
      success: true,
      message: updated.scheduleEnabled ? "Schedule enabled" : "Schedule disabled",
      schedule: {
        enabled: updated.scheduleEnabled,
        overridden: updated.scheduleOverridden,
        timezone: updated.scheduleTimezone ?? "Europe/London",
        weekly: updated.scheduleWeekly as WeeklySchedule,
      },
    });
  } catch (error) {
    console.error("[schedule POST]", error);
    return NextResponse.json({ success: false, error: "Failed to save schedule" }, { status: 500 });
  }
}
