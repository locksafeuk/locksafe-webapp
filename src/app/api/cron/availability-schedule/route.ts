import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import prisma from "@/lib/db";
import { sendNativePush } from "@/lib/native-push";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
interface DaySchedule { enabled: boolean; start: string; end: string }
type WeeklySchedule = Record<DayKey, DaySchedule>;

/**
 * Returns whether the current moment in Europe/London falls inside the
 * locksmith's scheduled window for today.
 */
function getScheduleState(weekly: WeeklySchedule): { inWindow: boolean } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short", // Mon, Tue, Wed …
  });
  const parts = formatter.formatToParts(new Date());

  let hour = "00", minute = "00", weekdayShort = "Mon";
  for (const p of parts) {
    if (p.type === "hour")    hour = p.value;
    if (p.type === "minute")  minute = p.value;
    if (p.type === "weekday") weekdayShort = p.value;
  }

  // en-GB short weekday → our 3-letter lowercase key
  const dayKey = weekdayShort.toLowerCase().slice(0, 3) as DayKey;
  const day = weekly[dayKey];
  if (!day?.enabled) return { inWindow: false };

  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMins(day.start);
  const end   = toMins(day.end);
  const cur   = toMins(`${hour}:${minute}`);

  // Support overnight windows (e.g. 22:00–06:00)
  const inWindow = end < start ? cur >= start || cur < end : cur >= start && cur < end;
  return { inWindow };
}

// GET — runs every 15 min via Vercel cron
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locksmiths = await (prisma.locksmith as any).findMany({
      where: { scheduleEnabled: true, isActive: true },
      select: {
        id: true,
        isAvailable: true,
        scheduleOverridden: true,
        scheduleWeekly: true,
        nativeDeviceToken: true,
        nativeTokenType: true,
        nativeTokenPlatform: true,
      },
    }) as Array<{
      id: string;
      isAvailable: boolean;
      scheduleOverridden: boolean;
      scheduleWeekly: WeeklySchedule | null;
      nativeDeviceToken: string | null;
      nativeTokenType: string | null;
      nativeTokenPlatform: string | null;
    }>;

    const results = { enabled: 0, disabled: 0, skipped: 0, errors: 0 };

    for (const ls of locksmiths) {
      try {
        if (!ls.scheduleWeekly) { results.skipped++; continue; }

        const { inWindow } = getScheduleState(ls.scheduleWeekly);

        if (inWindow) {
          // Only enable if not manually overridden mid-shift
          if (!ls.isAvailable && !ls.scheduleOverridden) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma.locksmith as any).update({
              where: { id: ls.id },
              data: { isAvailable: true, lastAvailabilityChange: new Date() },
            });
            results.enabled++;

            if (ls.nativeDeviceToken && ls.nativeTokenPlatform) {
              await sendNativePush(
                ls.nativeDeviceToken,
                ls.nativeTokenType ?? "apns",
                ls.nativeTokenPlatform,
                { title: "Your shift has started 🟢", body: "You're now available and will receive job notifications.", data: { type: "schedule_start" } },
              ).catch(() => {/* best-effort */});
            }
          } else {
            results.skipped++;
          }
        } else {
          // Outside window
          if (ls.isAvailable) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma.locksmith as any).update({
              where: { id: ls.id },
              data: { isAvailable: false, scheduleOverridden: false, lastAvailabilityChange: new Date() },
            });
            results.disabled++;

            if (ls.nativeDeviceToken && ls.nativeTokenPlatform) {
              await sendNativePush(
                ls.nativeDeviceToken,
                ls.nativeTokenType ?? "apns",
                ls.nativeTokenPlatform,
                { title: "Your shift has ended 🔴", body: "You've been set as unavailable — your scheduled hours have finished.", data: { type: "schedule_end" } },
              ).catch(() => {/* best-effort */});
            }
          } else if (ls.scheduleOverridden) {
            // Shift ended while already offline — clear stale override flag
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma.locksmith as any).update({
              where: { id: ls.id },
              data: { scheduleOverridden: false },
            });
            results.skipped++;
          } else {
            results.skipped++;
          }
        }
      } catch (err) {
        console.error(`[availability-schedule] locksmith ${ls.id}:`, err);
        results.errors++;
      }
    }

    console.log(`[availability-schedule] ${JSON.stringify(results)}`);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[availability-schedule] fatal:", error);
    return NextResponse.json({ success: false, error: "Cron failed" }, { status: 500 });
  }
}
