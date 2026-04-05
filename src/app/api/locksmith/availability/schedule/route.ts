import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET - Get locksmith availability schedule
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locksmithId = searchParams.get("locksmithId");

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "Locksmith ID is required" },
        { status: 400 }
      );
    }

    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: {
        id: true,
        isAvailable: true,
        scheduleEnabled: true,
        scheduleTimezone: true,
        scheduleStartTime: true,
        scheduleEndTime: true,
        scheduleDays: true,
      },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      schedule: {
        enabled: locksmith.scheduleEnabled,
        timezone: locksmith.scheduleTimezone,
        startTime: locksmith.scheduleStartTime,
        endTime: locksmith.scheduleEndTime,
        days: locksmith.scheduleDays,
      },
      isAvailable: locksmith.isAvailable,
    });
  } catch (error) {
    console.error("Error fetching availability schedule:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}

// POST - Update locksmith availability schedule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      locksmithId,
      enabled,
      timezone,
      startTime,
      endTime,
      days,
    } = body;

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "Locksmith ID is required" },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (startTime && !timeRegex.test(startTime)) {
      return NextResponse.json(
        { success: false, error: "Invalid start time format. Use HH:MM" },
        { status: 400 }
      );
    }
    if (endTime && !timeRegex.test(endTime)) {
      return NextResponse.json(
        { success: false, error: "Invalid end time format. Use HH:MM" },
        { status: 400 }
      );
    }

    // Validate days
    const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    if (days && Array.isArray(days)) {
      for (const day of days) {
        if (!validDays.includes(day.toLowerCase())) {
          return NextResponse.json(
            { success: false, error: `Invalid day: ${day}` },
            { status: 400 }
          );
        }
      }
    }

    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        scheduleEnabled: enabled ?? false,
        scheduleTimezone: timezone ?? "Europe/London",
        scheduleStartTime: startTime ?? null,
        scheduleEndTime: endTime ?? null,
        scheduleDays: days ?? [],
      },
      select: {
        id: true,
        scheduleEnabled: true,
        scheduleTimezone: true,
        scheduleStartTime: true,
        scheduleEndTime: true,
        scheduleDays: true,
      },
    });

    return NextResponse.json({
      success: true,
      schedule: {
        enabled: locksmith.scheduleEnabled,
        timezone: locksmith.scheduleTimezone,
        startTime: locksmith.scheduleStartTime,
        endTime: locksmith.scheduleEndTime,
        days: locksmith.scheduleDays,
      },
      message: locksmith.scheduleEnabled
        ? "Availability schedule enabled"
        : "Availability schedule disabled",
    });
  } catch (error) {
    console.error("Error updating availability schedule:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}
