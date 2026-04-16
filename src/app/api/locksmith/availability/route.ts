import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isLocksmithAuthenticated } from "@/lib/auth";

// GET - Get locksmith availability status
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify locksmith is authenticated
    const session = await isLocksmithAuthenticated();
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
    const session = await isLocksmithAuthenticated();
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

    const locksmith = await prisma.locksmith.update({
      where: { id: locksmithId },
      data: {
        isAvailable,
        lastAvailabilityChange: new Date(),
      },
      select: {
        id: true,
        name: true,
        isAvailable: true,
        lastAvailabilityChange: true,
      },
    });

    return NextResponse.json({
      success: true,
      isAvailable: locksmith.isAvailable,
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
