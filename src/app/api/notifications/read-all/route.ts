import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// PATCH - Mark all notifications as read for a user
export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const locksmithId = searchParams.get("locksmithId");

    if (!customerId && !locksmithId) {
      return NextResponse.json(
        { success: false, error: "customerId or locksmithId is required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { read: false };

    if (customerId) {
      where.customerId = customerId;
    }
    if (locksmithId) {
      where.locksmithId = locksmithId;
    }

    const result = await prisma.notification.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
  } catch (error: unknown) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
