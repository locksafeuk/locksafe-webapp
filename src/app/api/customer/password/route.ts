import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession, hashPassword, verifyPassword } from "@/lib/auth";

// PUT - Change password
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session || session.type !== "customer") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Get customer with password hash
    const customer = await prisma.customer.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!customer || !customer.passwordHash) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Verify current password
    if (!verifyPassword(currentPassword, customer.passwordHash)) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Update password
    await prisma.customer.update({
      where: { id: session.id },
      data: {
        passwordHash: hashPassword(newPassword),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
