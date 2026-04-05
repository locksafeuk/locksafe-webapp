import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function POST(request: NextRequest) {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token
    let decoded: { id: string; type: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { id: string; type: string };
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    if (decoded.type !== "customer") {
      return NextResponse.json(
        { success: false, error: "Not a customer account" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { customerId } = body;

    // Verify the customer ID matches the token
    if (customerId !== decoded.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Update customer with terms acceptance
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        termsAcceptedAt: new Date(),
        onboardingCompleted: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Terms accepted successfully",
      customer: {
        id: customer.id,
        termsAcceptedAt: customer.termsAcceptedAt,
        onboardingCompleted: customer.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error("Error accepting terms:", error);
    return NextResponse.json(
      { success: false, error: "Failed to accept terms" },
      { status: 500 }
    );
  }
}
