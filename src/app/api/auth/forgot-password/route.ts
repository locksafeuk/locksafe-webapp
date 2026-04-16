import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

// Generate a random token
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userType } = body; // userType can be "customer" or "locksmith" (optional)

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase();

    // Try to find user in both customer and locksmith tables
    let user: any = null;
    let isLocksmith = false;

    // If userType is specified, only check that type
    if (userType === "locksmith") {
      user = await prisma.locksmith.findUnique({
        where: { email: emailLower },
      });
      isLocksmith = true;
    } else if (userType === "customer") {
      user = await prisma.customer.findUnique({
        where: { email: emailLower },
      });
      isLocksmith = false;
    } else {
      // Check both if userType not specified
      user = await prisma.customer.findUnique({
        where: { email: emailLower },
      });

      if (!user) {
        user = await prisma.locksmith.findUnique({
          where: { email: emailLower },
        });
        if (user) {
          isLocksmith = true;
        }
      }
    }

    // Always return success to prevent email enumeration
    if (!user || !user.passwordHash) {
      // Wait a bit to simulate processing
      await new Promise(resolve => setTimeout(resolve, 500));
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, we've sent a password reset link.",
      });
    }

    // Generate reset token
    const resetToken = generateToken();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token to database
    if (isLocksmith) {
      await prisma.locksmith.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      });
    } else {
      await prisma.customer.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      });
    }

    // Send reset email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}${isLocksmith ? '&type=locksmith' : ''}`;

    await sendPasswordResetEmail(user.email!, {
      customerName: user.name,
      resetUrl,
    });

    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, we've sent a password reset link.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
