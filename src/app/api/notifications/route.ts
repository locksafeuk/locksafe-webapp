import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const locksmithId = searchParams.get("locksmithId");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!customerId && !locksmithId) {
      return NextResponse.json(
        { success: false, error: "customerId or locksmithId is required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {};

    if (customerId) {
      where.customerId = customerId;
    }
    if (locksmithId) {
      where.locksmithId = locksmithId;
    }
    if (unreadOnly) {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: {
        ...where,
        read: false,
      },
    });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error: unknown) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      locksmithId,
      jobId,
      type,
      title,
      message,
      actionUrl,
      actionLabel,
      data,
    } = body;

    if (!customerId && !locksmithId) {
      return NextResponse.json(
        { success: false, error: "customerId or locksmithId is required" },
        { status: 400 }
      );
    }

    if (!type || !title || !message) {
      return NextResponse.json(
        { success: false, error: "type, title, and message are required" },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.create({
      data: {
        customerId,
        locksmithId,
        jobId,
        type,
        title,
        message,
        actionUrl,
        actionLabel,
        data,
      },
    });

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error: unknown) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
