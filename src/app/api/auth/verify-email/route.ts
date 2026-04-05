import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      );
    }

    // Find customer by verification token
    const customer = await prisma.customer.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: {
          gt: new Date(), // Token must not be expired
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Invalid or expired verification link. Please request a new one." },
        { status: 400 }
      );
    }

    // Mark email as verified and clear token
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Email verified successfully! You can now access all features.",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

// Resend verification email
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!customer) {
      return NextResponse.json({
        success: true,
        message: "If an account exists, we've sent a new verification email.",
      });
    }

    if (customer.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "Your email is already verified.",
      });
    }

    // Generate new verification token
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let verificationToken = "";
    for (let i = 0; i < 64; i++) {
      verificationToken += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // Send verification email
    const { sendVerificationEmail } = await import("@/lib/email");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    await sendVerificationEmail(customer.email!, {
      customerName: customer.name,
      verificationUrl,
    });

    return NextResponse.json({
      success: true,
      message: "Verification email sent! Please check your inbox.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
