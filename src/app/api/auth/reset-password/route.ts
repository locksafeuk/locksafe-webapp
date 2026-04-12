import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, userType } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Try to find user by reset token in both tables
    let user: any = null;
    let isLocksmith = false;

    // If userType is specified, only check that type
    if (userType === "locksmith") {
      user = await prisma.locksmith.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(), // Token must not be expired
          },
        },
      });
      isLocksmith = true;
    } else if (userType === "customer") {
      user = await prisma.customer.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(), // Token must not be expired
          },
        },
      });
      isLocksmith = false;
    } else {
      // Check both if userType not specified
      user = await prisma.customer.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        user = await prisma.locksmith.findFirst({
          where: {
            resetToken: token,
            resetTokenExpiry: {
              gt: new Date(),
            },
          },
        });
        if (user) {
          isLocksmith = true;
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    // Update password and clear reset token
    if (isLocksmith) {
      await prisma.locksmith.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(password),
          resetToken: null,
          resetTokenExpiry: null,
        },
      });
    } else {
      await prisma.customer.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(password),
          resetToken: null,
          resetTokenExpiry: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully. You can now login with your new password.",
      userType: isLocksmith ? "locksmith" : "customer",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
