import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Helper function to check if current time is within schedule
function isWithinSchedule(
  scheduleStartTime: string,
  scheduleEndTime: string,
  scheduleDays: string[],
  timezone: string
): boolean {
  try {
    // Get current time in the locksmith's timezone
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "long",
    };

    const formatter = new Intl.DateTimeFormat("en-US", options);
    const parts = formatter.formatToParts(now);

    let currentHour = "00";
    let currentMinute = "00";
    let currentDay = "monday";

    for (const part of parts) {
      if (part.type === "hour") currentHour = part.value;
      if (part.type === "minute") currentMinute = part.value;
      if (part.type === "weekday") currentDay = part.value.toLowerCase();
    }

    const currentTime = `${currentHour}:${currentMinute}`;

    // Check if current day is in schedule
    if (!scheduleDays.map(d => d.toLowerCase()).includes(currentDay)) {
      return false;
    }

    // Parse times for comparison
    const [startHour, startMin] = scheduleStartTime.split(":").map(Number);
    const [endHour, endMin] = scheduleEndTime.split(":").map(Number);
    const [currHour, currMin] = [parseInt(currentHour), parseInt(currentMinute)];

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const currentMinutes = currHour * 60 + currMin;

    // Handle overnight schedules (e.g., 22:00 - 06:00)
    if (endMinutes < startMinutes) {
      // Overnight schedule
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    // Normal schedule (e.g., 08:00 - 20:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (error) {
    console.error("Error checking schedule:", error);
    return false;
  }
}

// GET - Cron job to update availability based on schedules
// This should run every 5-15 minutes via Vercel cron or similar
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all locksmiths with schedule enabled
    const locksmiths = await prisma.locksmith.findMany({
      where: {
        scheduleEnabled: true,
        scheduleStartTime: { not: null },
        scheduleEndTime: { not: null },
        scheduleDays: { isEmpty: false },
      },
      select: {
        id: true,
        name: true,
        isAvailable: true,
        scheduleEnabled: true,
        scheduleTimezone: true,
        scheduleStartTime: true,
        scheduleEndTime: true,
        scheduleDays: true,
      },
    });

    let updatedCount = 0;
    const updates: Array<{ id: string; name: string; newStatus: boolean }> = [];

    for (const locksmith of locksmiths) {
      if (!locksmith.scheduleStartTime || !locksmith.scheduleEndTime) continue;

      const shouldBeAvailable = isWithinSchedule(
        locksmith.scheduleStartTime,
        locksmith.scheduleEndTime,
        locksmith.scheduleDays,
        locksmith.scheduleTimezone
      );

      // Only update if status needs to change
      if (locksmith.isAvailable !== shouldBeAvailable) {
        await prisma.locksmith.update({
          where: { id: locksmith.id },
          data: {
            isAvailable: shouldBeAvailable,
            lastAvailabilityChange: new Date(),
          },
        });

        updates.push({
          id: locksmith.id,
          name: locksmith.name,
          newStatus: shouldBeAvailable,
        });
        updatedCount++;

        console.log(
          `[Availability Schedule] ${locksmith.name}: ${locksmith.isAvailable ? "Available" : "Unavailable"} -> ${shouldBeAvailable ? "Available" : "Unavailable"}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${locksmiths.length} locksmiths with schedules`,
      updated: updatedCount,
      updates: updates.map(u => ({
        name: u.name,
        status: u.newStatus ? "now available" : "now unavailable",
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error processing availability schedules:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process schedules" },
      { status: 500 }
    );
  }
}
