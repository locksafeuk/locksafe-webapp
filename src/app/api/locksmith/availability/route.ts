import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getLocksmithFromRequest } from "@/lib/auth";
import { getAvailabilityBlock } from "@/lib/locksmith-completeness";

// GET - Get locksmith availability status
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify locksmith is authenticated
    const session = await getLocksmithFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const locksmithId = searchParams.get("locksmithId");

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "Locksmith ID is required" },
        { status: 400 }
      );
    }

    // SECURITY: Verify the locksmith is accessing their own availability
    if (session.id !== locksmithId) {
      return NextResponse.json(
        { success: false, error: "Forbidden - You can only access your own availability" },
        { status: 403 }
      );
    }

    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: {
        id: true,
        isAvailable: true,
        lastAvailabilityChange: true,
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
      isAvailable: locksmith.isAvailable,
      lastChanged: locksmith.lastAvailabilityChange,
    });
  } catch (error) {
    console.error("Error fetching availability status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch availability status" },
      { status: 500 }
    );
  }
}

// POST - Toggle locksmith availability
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify locksmith is authenticated
    const session = await getLocksmithFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { locksmithId, isAvailable } = body;

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "Locksmith ID is required" },
        { status: 400 }
      );
    }

    // SECURITY: Verify the locksmith is updating their own availability
    if (session.id !== locksmithId) {
      return NextResponse.json(
        { success: false, error: "Forbidden - You can only update your own availability" },
        { status: 403 }
      );
    }

    if (typeof isAvailable !== "boolean") {
      return NextResponse.json(
        { success: false, error: "isAvailable must be a boolean" },
        { status: 400 }
      );
    }

    // Guard: can't go AVAILABLE without a base postcode — otherwise dispatch
    // can't match you and your "Available" status is a silent lie.
    if (isAvailable === true) {
      const block = await getAvailabilityBlock(locksmithId);
      if (block) {
        return NextResponse.json(
          {
            success: false,
            error: "base_location_required",
            message: block.message,
            deepLink: block.deepLink,
            alsoMissing: block.alsoMissing,
          },
          { status: 400 },
        );
      }
    }

    // If the locksmith is manually going OFFLINE while a schedule is active,
    // flag it so the cron doesn't auto-re-enable them mid-shift.
    // The override is cleared automatically when the shift ends.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = await (prisma.locksmith as any).findUnique({
      where: { id: locksmithId },
      select: { scheduleEnabled: true },
    }) as { scheduleEnabled: boolean } | null;
    const setOverride = !isAvailable && (current?.scheduleEnabled ?? false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locksmith = await (prisma.locksmith as any).update({
      where: { id: locksmithId },
      data: {
        isAvailable,
        lastAvailabilityChange: new Date(),
        ...(setOverride ? { scheduleOverridden: true } : {}),
        // If manually coming back ONLINE, clear any prior override
        ...(!isAvailable ? {} : { scheduleOverridden: false }),
      },
      select: {
        id: true,
        name: true,
        isAvailable: true,
        scheduleOverridden: true,
        lastAvailabilityChange: true,
      },
    }) as { id: string; name: string; isAvailable: boolean; scheduleOverridden: boolean; lastAvailabilityChange: Date | null };

    return NextResponse.json({
      success: true,
      isAvailable: locksmith.isAvailable,
      scheduleOverridden: locksmith.scheduleOverridden,
      lastChanged: locksmith.lastAvailabilityChange,
      message: locksmith.isAvailable
        ? "You are now available and will receive job notifications"
        : "You are now unavailable and will not receive job notifications",
    });
  } catch (error) {
    console.error("Error toggling availability:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update availability status" },
      { status: 500 }
    );
  }
}
